from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os
import json
from google import genai
from pydantic import BaseModel

from app.database.session import get_db
from app.models.user import User
from app.models.job import Job
from app.models.resume import Resume
from app.models.score import Score
from app.models.notification_log import NotificationLog
from app.services.email_service import email_service
from app.utils.security import require_role

router = APIRouter()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class ChatHistoryItem(BaseModel):
    sender: str  # 'user' | 'assistant' | 'system'
    text: str

class ChatbotRequest(BaseModel):
    message: str
    history: list[ChatHistoryItem] = []

SYSTEM_INSTRUCTION = """
You are the RECRUIT.AI Recruiter Copilot, a premium, professional AI recruiting assistant.
Your goal is to help recruiters manage their hiring pipeline, query candidate profiles, analyze match scores, and draft correspondence.

You have access to the company's active jobs list and the candidate applications with their AI scores below.

Instructions:
1. Always be professional, concise, and helpful.
2. Rely only on the provided context of candidates and jobs to answer pipeline queries.
3. If asked to draft an email (rejection, interview, shortlist, offer), format it professionally as HTML or text matching the request context.
4. When comparing candidates, highlight their respective AI match scores, strengths, and missing skills.
5. If the user asks about information not present in the candidate database, state clearly that you do not have access to that data.
6. When mentioning any candidate in your response, ALWAYS format their name as a markdown link using their candidate_id/resume_id: [Candidate Name](candidate:resume_id). For example, write "[Angela](candidate:2)" if Angela's resume/candidate ID in the injected database list is 2.
7. At the very end of your response, always include 2-3 logical follow-up questions that the recruiter might want to ask next, enclosed inside a <suggestions> tag and separated by commas. Example: <suggestions>Draft interview email for Angela, Compare missing skills</suggestions>.
8. If you suggest shortlisting, selecting, or rejecting multiple candidates, always append a <bulk_action candidates="id1,id2" job="Job Title"></bulk_action> tag in your reply. For example: <bulk_action candidates="2,3" job="React Developer"></bulk_action> if candidates 2 and 3 are recommended for the React Developer role.
"""

@router.post("/chat")
def chatbot_interaction(
    req: ChatbotRequest,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    import logging
    logger = logging.getLogger(__name__)

    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_message = req.message
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    # Format conversation history
    history_context = ""
    if req.history:
        history_context = "CONVERSATION HISTORY:\n"
        for item in req.history:
            role = "User" if item.sender == "user" else "Assistant"
            clean_text = item.text
            if "<suggestions>" in clean_text:
                clean_text = clean_text.split("<suggestions>")[0].strip()
            history_context += f"{role}: {clean_text}\n"
        history_context += "\n"

    # Fetch company-specific jobs
    jobs = db.query(Job).filter(Job.company_id == user.company_id).all()
    job_ids = [j.id for j in jobs]

    # Fetch resumes linked to those jobs
    resumes = []
    if job_ids:
        resumes = db.query(Resume).filter(Resume.job_id.in_(job_ids)).all()

    # Compile dynamic context for LLM
    jobs_context = []
    for j in jobs:
        jobs_context.append({
            "job_id": j.id,
            "title": j.title,
            "location": j.location,
            "location_type": j.location_type
        })

    candidates_context = []
    for r in resumes:
        cand_scores = []
        for s in r.scores:
            # Safe strengths list extraction
            strengths_list = []
            if s.strengths:
                if isinstance(s.strengths, list):
                    strengths_list = s.strengths
                elif isinstance(s.strengths, str):
                    try:
                        strengths_list = json.loads(s.strengths)
                    except Exception:
                        strengths_list = [item.strip() for item in s.strengths.split(",") if item.strip()]

            # Safe missing_skills list extraction
            missing_list = []
            if s.missing_skills:
                if isinstance(s.missing_skills, list):
                    missing_list = s.missing_skills
                elif isinstance(s.missing_skills, str):
                    try:
                        missing_list = json.loads(s.missing_skills)
                    except Exception:
                        missing_list = [item.strip() for item in s.missing_skills.split(",") if item.strip()]

            cand_scores.append({
                "job_id": s.job_id,
                "match_score": s.match_score,
                "status": s.status,
                "summary": s.summary,
                "strengths": strengths_list,
                "missing_skills": missing_list
            })

        # Safe extracted skills extraction
        skills_val = {}
        if r.extracted_skills:
            if isinstance(r.extracted_skills, dict):
                skills_val = r.extracted_skills
            elif isinstance(r.extracted_skills, str):
                try:
                    skills_val = json.loads(r.extracted_skills)
                except Exception:
                    skills_val = {"skills": [item.strip() for item in r.extracted_skills.split(",") if item.strip()]}

        candidates_context.append({
            "candidate_id": r.id,
            "name": r.user.name if r.user else "Unknown Candidate",
            "email": r.user.email if r.user else "Unknown Email",
            "skills": skills_val,
            "applied_job_id": r.job_id,
            "scores": cand_scores
        })

    # Fetch company name
    company_name = "Recruit AI"
    if user.company_id:
        from app.models.company import Company
        company_obj = db.query(Company).filter(Company.id == user.company_id).first()
        if company_obj:
            company_name = company_obj.name

    # Build prompt with injected context
    prompt = f"""
{SYSTEM_INSTRUCTION}

---
CURRENT CONTEXT (COMPANY: {company_name}):
ACTIVE JOBS:
{json.dumps(jobs_context, indent=2)}

CANDIDATES & SCORES:
{json.dumps(candidates_context, indent=2)}
---

{history_context}User (Recruiter): {user_message}
Assistant:"""

    # Robust model call with fallback options
    response = None
    last_error = None
    
    # Try gemini-2.5-flash-lite first
    try:
        logger.info("Attempting chat completion with gemini-2.5-flash-lite...")
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
    except Exception as e:
        logger.warning(f"gemini-2.5-flash-lite failed: {e}. Trying fallback model gemini-2.5-flash...")
        last_error = e
        
        # Fallback to gemini-2.5-flash
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
        except Exception as fallback_err:
            logger.error(f"Fallback gemini-2.5-flash also failed: {fallback_err}", exc_info=True)
            last_error = fallback_err

    if response and response.text:
        return {"reply": response.text.strip()}
    
    # If all models failed, return a formatted mock fallback query with sample suggestions and candidate link tags
    logger.warning("Both Gemini models failed (likely due to rate limits). Serving a structured mock fallback response.")
    
    # Extract candidate details if available
    cand_links = []
    first_candidate_name = "John Doe"
    if candidates_context:
        for c in candidates_context[:3]:  # grab up to 3 candidates
            cand_links.append(f"[{c['name']}](candidate:{c['candidate_id']})")
        first_candidate_name = candidates_context[0]["name"]
    else:
        cand_links.append("[John Doe](candidate:1)")

    candidates_str = ", ".join(cand_links)
    
    fallback_text = (
        f"Hello! I am currently running in a limited offline mode due to high AI service demand (both model attempts failed).\n\n"
        f"However, from your pipeline database, here are your candidates: {candidates_str}.\n\n"
        f"You can click on their name badges to review their full resumes and match scores.\n\n"
        f"<suggestions>Draft interview invitation email for {first_candidate_name}, Compare candidate scores, Who are the top candidates?</suggestions>"
    )
    return {"reply": fallback_text}

class SendDraftRequest(BaseModel):
    email: str
    subject: str
    body: str
    resume_id: int | None = None

@router.post("/chat/send-draft")
def send_draft_email(
    req: SendDraftRequest,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find candidate name if possible
    cand_name = "Candidate"
    cand_user = db.query(User).filter(User.email == req.email).first()
    if cand_user:
        cand_name = cand_user.name

    # Send the email using the existing email service
    success = email_service.send_email(
        to_email=req.email,
        subject=req.subject,
        html_content=req.body.replace("\n", "<br>")
    )

    # Log the email notification
    log = NotificationLog(
        candidate_email=req.email,
        candidate_name=cand_name,
        application_id=req.resume_id,
        status="custom_email",
        email_subject=req.subject,
        delivery_status="sent" if success else "failed",
        error_message=None if success else "SMTP send failure"
    )
    db.add(log)
    db.commit()

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email via SMTP service")

    return {"message": "Email sent successfully to the candidate"}

@router.post("/chat/stream")
def chatbot_stream(
    req: ChatbotRequest,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    import logging
    logger = logging.getLogger(__name__)

    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_message = req.message
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    # Format conversation history
    history_context = ""
    if req.history:
        history_context = "CONVERSATION HISTORY:\n"
        for item in req.history:
            role = "User" if item.sender == "user" else "Assistant"
            clean_text = item.text
            if "<suggestions>" in clean_text:
                clean_text = clean_text.split("<suggestions>")[0].strip()
            history_context += f"{role}: {clean_text}\n"
        history_context += "\n"

    # Fetch company-specific jobs
    jobs = db.query(Job).filter(Job.company_id == user.company_id).all()
    job_ids = [j.id for j in jobs]

    # Fetch resumes linked to those jobs
    resumes = []
    if job_ids:
        resumes = db.query(Resume).filter(Resume.job_id.in_(job_ids)).all()

    # Compile dynamic context for LLM
    jobs_context = []
    for j in jobs:
        jobs_context.append({
            "job_id": j.id,
            "title": j.title,
            "location": j.location,
            "location_type": j.location_type
        })

    candidates_context = []
    for r in resumes:
        cand_scores = []
        for s in r.scores:
            strengths_list = []
            if s.strengths:
                if isinstance(s.strengths, list):
                    strengths_list = s.strengths
                elif isinstance(s.strengths, str):
                    try:
                        strengths_list = json.loads(s.strengths)
                    except Exception:
                        strengths_list = [item.strip() for item in s.strengths.split(",") if item.strip()]

            missing_list = []
            if s.missing_skills:
                if isinstance(s.missing_skills, list):
                    missing_list = s.missing_skills
                elif isinstance(s.missing_skills, str):
                    try:
                        missing_list = json.loads(s.missing_skills)
                    except Exception:
                        missing_list = [item.strip() for item in s.missing_skills.split(",") if item.strip()]

            cand_scores.append({
                "job_id": s.job_id,
                "match_score": s.match_score,
                "status": s.status,
                "summary": s.summary,
                "strengths": strengths_list,
                "missing_skills": missing_list
            })

        skills_val = {}
        if r.extracted_skills:
            if isinstance(r.extracted_skills, dict):
                skills_val = r.extracted_skills
            elif isinstance(r.extracted_skills, str):
                try:
                    skills_val = json.loads(r.extracted_skills)
                except Exception:
                    skills_val = {"skills": [item.strip() for item in r.extracted_skills.split(",") if item.strip()]}

        candidates_context.append({
            "candidate_id": r.id,
            "name": r.user.name if r.user else "Unknown Candidate",
            "email": r.user.email if r.user else "Unknown Email",
            "skills": skills_val,
            "applied_job_id": r.job_id,
            "scores": cand_scores
        })

    company_name = "Recruit AI"
    if user.company_id:
        from app.models.company import Company
        company_obj = db.query(Company).filter(Company.id == user.company_id).first()
        if company_obj:
            company_name = company_obj.name

    prompt = f"""
{SYSTEM_INSTRUCTION}

---
CURRENT CONTEXT (COMPANY: {company_name}):
ACTIVE JOBS:
{json.dumps(jobs_context, indent=2)}

CANDIDATES & SCORES:
{json.dumps(candidates_context, indent=2)}
---

{history_context}User (Recruiter): {user_message}
Assistant:"""

    def generate_stream():
        try:
            logger.info("Attempting streaming chat completion with gemini-2.5-flash-lite...")
            response_stream = client.models.generate_content_stream(
                model="gemini-2.5-flash-lite",
                contents=prompt,
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            logger.warning(f"gemini-2.5-flash-lite stream failed: {e}. Trying fallback model gemini-2.5-flash...")
            try:
                response_stream = client.models.generate_content_stream(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
            except Exception as fallback_err:
                logger.error(f"Fallback gemini-2.5-flash stream also failed: {fallback_err}", exc_info=True)
                
                # Fallback mock text stream
                cand_links = []
                first_candidate_name = "John Doe"
                if candidates_context:
                    for c in candidates_context[:3]:
                        cand_links.append(f"[{c['name']}](candidate:{c['candidate_id']})")
                    first_candidate_name = candidates_context[0]["name"]
                else:
                    cand_links.append("[John Doe](candidate:1)")

                candidates_str = ", ".join(cand_links)
                
                fallback_reply = (
                    f"Hello! I am currently running in a limited offline mode due to high AI service demand (both model attempts failed).\n\n"
                    f"However, from your pipeline database, here are your candidates: {candidates_str}.\n\n"
                    f"You can click on their name badges to review their full resumes and match scores.\n\n"
                    f"<suggestions>Draft interview invitation email for {first_candidate_name}, Compare candidate scores, Who are the top candidates?</suggestions>"
                )
                
                words = fallback_reply.split(" ")
                for i, w in enumerate(words):
                    yield w + (" " if i < len(words) - 1 else "")
                    import time
                    time.sleep(0.01)

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

class SendBulkRequest(BaseModel):
    emails: list[str]
    subject: str
    body_template: str
    resume_ids: list[int]
    status: str

@router.post("/chat/send-bulk")
def send_bulk_emails(
    req: SendBulkRequest,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    success_count = 0
    failure_count = 0
    errors = []

    for email, resume_id in zip(req.emails, req.resume_ids):
        cand_name = "Candidate"
        cand_user = db.query(User).filter(User.email == email).first()
        if cand_user:
            cand_name = cand_user.name

        personalized_body = req.body_template.replace("{name}", cand_name).replace("{Name}", cand_name)

        if req.status and req.status != "applied":
            score = db.query(Score).filter(Score.resume_id == resume_id).first()
            if score:
                score.status = req.status
                db.commit()

        success = email_service.send_email(
            to_email=email,
            subject=req.subject,
            html_content=personalized_body.replace("\n", "<br>")
        )

        log = NotificationLog(
            candidate_email=email,
            candidate_name=cand_name,
            application_id=resume_id,
            status=f"bulk_{req.status}" if req.status else "bulk_custom_email",
            email_subject=req.subject,
            delivery_status="sent" if success else "failed",
            error_message=None if success else "SMTP send failure"
        )
        db.add(log)
        db.commit()

        if success:
            success_count += 1
        else:
            failure_count += 1
            errors.append(f"Failed to send email to {email}")

    return {
        "message": f"Bulk email dispatch completed. Sent: {success_count}, Failed: {failure_count}",
        "success_count": success_count,
        "failure_count": failure_count,
        "errors": errors
    }
