from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import json

from app.database.session import get_db
from app.models.resume import Resume
from app.models.job import Job
from app.models.score import Score
from app.models.user import User
from app.schemas.score import ScoreResponse, ScoreStatusUpdate, ScoreOverrideRequest
from app.utils.security import get_current_user_payload
from app.services.ai_scorer import score_resume, build_explanation
from app.services.email_service import email_service

router = APIRouter()


# =========================================================
# EMAIL HELPERS
# =========================================================

def send_recruiter_email_task(
    email: str,
    job_title: str,
    resume_filename: str,
    score: float,
    strengths_json: str,
    missing_json: str,
    summary: str
):
    try:
        strengths = json.loads(strengths_json or "[]")
        missing = json.loads(missing_json or "[]")
        html = email_service.get_match_score_template(
            job_title=job_title,
            resume_filename=resume_filename,
            score=score,
            strengths=strengths,
            missing=missing,
            summary=summary
        )
        email_service.send_email(
            to_email=email,
            subject=f"Pipeline Match Alert: {job_title} ({score}%)",
            html_content=html
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[EMAIL ERROR] {str(e)}", exc_info=True)

def send_candidate_match_email_task(email: str, job_title: str, score: float):
    try:
        html = email_service.get_candidate_match_template(job_title, score)
        email_service.send_email(
            to_email=email,
            subject=f"Strong Match Found: {job_title}",
            html_content=html
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[EMAIL ERROR] {str(e)}", exc_info=True)

def send_interview_invite_email_task(email: str, job_title: str):
    try:
        html = email_service.get_interview_invite_template(job_title)
        email_service.send_email(
            to_email=email,
            subject=f"Interview Invitation: {job_title}",
            html_content=html
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[EMAIL ERROR] {str(e)}", exc_info=True)

def send_rejection_email_task(email: str, job_title: str):
    try:
        html = email_service.get_rejection_template(job_title)
        email_service.send_email(
            to_email=email,
            subject=f"Application Update: {job_title}",
            html_content=html
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[EMAIL ERROR] {str(e)}", exc_info=True)

# =========================================================
# SCORING ENDPOINT
# =========================================================

@router.post("/{resume_id}/score/{job_id}", response_model=ScoreResponse)
def score_a_resume(
    resume_id: int,
    job_id: int,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.role == "recruiter" and job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to score resumes for this job")
    elif user.role == "company_admin" and job.company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    existing = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()

    # =====================================================
    # AI SCORING
    # =====================================================
    text_length = len(resume.extracted_text or "")
    if text_length < 200:
        confidence = "low"
    elif text_length < 1000:
        confidence = "medium"
    else:
        confidence = "high"

    result = score_resume(resume.extracted_text, job.description)
    explanation = build_explanation(resume.extracted_skills, result)

    if existing:
        existing.match_score = result.get("match_score", 0)
        existing.strengths = json.dumps(result.get("strengths", []))
        existing.missing_skills = json.dumps(result.get("missing_skills", []))
        existing.summary = result.get("summary", "")
        existing.explanation = explanation
        existing.confidence = confidence
        db.commit()
        db.refresh(existing)
        score = existing
    else:
        score = Score(
            resume_id=resume_id,
            job_id=job_id,
            match_score=result.get("match_score", 0),
            strengths=json.dumps(result.get("strengths", [])),
            missing_skills=json.dumps(result.get("missing_skills", [])),
            summary=result.get("summary", ""),
            explanation=explanation,
            confidence=confidence
        )
        db.add(score)
        db.commit()
        db.refresh(score)

    # =====================================================
    # RECRUITER EMAIL NOTIFICATION (NON-BLOCKING)
    # =====================================================
    if score.match_score >= 70:
        recruiter_email = getattr(job.recruiter, "email", None)

        if recruiter_email:
            background_tasks.add_task(
                send_recruiter_email_task,
                recruiter_email,
                job.title,
                resume.filename,
                score.match_score,
                score.strengths,
                score.missing_skills,
                score.summary
            )

    # =====================================================
    # CANDIDATE EMAIL NOTIFICATION (TRIGGER A)
    # =====================================================
    if score.match_score >= 80 and not score.notified:
        candidate_email = getattr(resume.user, "email", None)
        if candidate_email:
            background_tasks.add_task(
                send_candidate_match_email_task,
                candidate_email,
                job.title,
                score.match_score
            )
            score.notified = True
            db.commit()
            db.refresh(score)

    return score


# =========================================================
# GET RESUME SCORES
# =========================================================

@router.get("/{resume_id}/scores")
def get_resume_scores(
    resume_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    scores = db.query(Score).filter(Score.resume_id == resume_id).all()

    return [
        {
            "score_id": s.id,
            "job_id": s.job_id,
            "match_score": s.match_score,
            "strengths": json.loads(s.strengths),
            "missing_skills": json.loads(s.missing_skills),
            "summary": s.summary,
            "explanation": s.explanation,
            "status": s.status,
            "confidence": s.confidence,
            "recruiter_flagged": s.recruiter_flagged,
            "recruiter_override_note": s.recruiter_override_note,
            "scored_at": s.created_at
        }
        for s in scores
    ]

# =========================================================
# UPDATE SCORE STATUS
# =========================================================

@router.patch("/{resume_id}/{job_id}/status", response_model=ScoreResponse)
def update_score_status(
    resume_id: int,
    job_id: int,
    status_update: ScoreStatusUpdate,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    if payload.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can update status")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update status for this job")
        
    valid_statuses = ["applied", "pending", "shortlisted", "interview", "interview_invited", "rejected", "hired"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        
    score = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()
    
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
        
    score.status = status_update.status
    db.commit()
    db.refresh(score)
    
    # Trigger status update email if send_email is True
    candidate_email = getattr(score.resume.user, "email", None) if score.resume else None
    candidate_name = getattr(score.resume.user, "name", "Candidate") if (score.resume and score.resume.user and score.resume.user.name) else "Candidate"
    
    if candidate_email and status_update.send_email:
        company_name = job.company.name if job.company else "Our Company"
        background_tasks.add_task(
            email_service.send_and_log_status_update_email,
            candidate_email,
            candidate_name,
            job.title,
            company_name,
            score.status,
            score.resume_id
        )
        
    return score

# =========================================================
# INVITE CANDIDATE (TRIGGER B)
# =========================================================

@router.post("/{resume_id}/invite/{job_id}", response_model=ScoreResponse)
def invite_candidate(
    resume_id: int,
    job_id: int,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    if payload.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can invite candidates")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to invite candidates for this job")
        
    score = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()
    
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
        
    score.status = "interview_invited"
    score.interview_invited_at = datetime.utcnow()
    db.commit()
    db.refresh(score)
    
    # Send email
    candidate_email = getattr(score.resume.user, "email", None)
    if candidate_email:
        background_tasks.add_task(
            send_interview_invite_email_task,
            candidate_email,
            score.job.title
        )
        
    return score



# =========================================================
# JOB RANKINGS
# =========================================================

@router.get("/job/{job_id}/rankings")
def get_job_rankings(
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if user.role == "recruiter" and job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    elif user.role == "company_admin" and job.company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    scores = (
        db.query(Score)
        .filter(Score.job_id == job_id)
        .order_by(Score.match_score.desc())
        .all()
    )

    return [
        {
            "rank": rank,
            "resume_id": score.resume_id,
            "score": score.match_score,
            "summary": score.summary,
            "status": score.resume.status if score.resume else "pending",
            "confidence": score.confidence,
            "recruiter_flagged": score.recruiter_flagged,
            "recruiter_override_note": score.recruiter_override_note
        }
        for rank, score in enumerate(scores, start=1)
    ]

# =========================================================
# SCORE OVERRIDE
# =========================================================

@router.patch("/{resume_id}/{job_id}/override", response_model=ScoreResponse)
def override_score(
    resume_id: int,
    job_id: int,
    override_data: ScoreOverrideRequest,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    if payload.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can override scores")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to override score for this job")
        
    score = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()
    
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
        
    score.recruiter_flagged = override_data.flagged
    score.recruiter_override_note = override_data.note
    db.commit()
    db.refresh(score)
    return score


# =========================================================
# SCORE EXPLANATION
# =========================================================

@router.get("/{resume_id}/score/{job_id}/explain")
def explain_score(
    resume_id: int,
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if user.role == "recruiter" and job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    elif user.role == "company_admin" and job.company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    score = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()

    if not score:
        raise HTTPException(status_code=404, detail="Score not found. Run scoring first.")

    return {
        "resume_id": resume_id,
        "job_id": job_id,
        "match_score": score.match_score,
        "explanation": score.explanation
    }