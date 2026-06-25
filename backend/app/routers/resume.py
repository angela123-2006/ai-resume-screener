from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os, fitz, uuid

from app.database.session import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.score import Score
from app.models.job import Job
from app.utils.security import verify_token, require_role
from app.services.skill_extractor import extract_skills_from_resume
from app.schemas.resume import ResumeStatusUpdate
from app.services.email_service import email_service

router = APIRouter()
oauth2_scheme = HTTPBearer()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def extract_text_from_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text


def parse_resume_background_task(resume_id: int):
    import logging
    logger = logging.getLogger(__name__)
    
    from app.database.database import SessionLocal
    from app.models.resume import Resume
    
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return
            
        # 1. Extract text from PDF
        text = extract_text_from_pdf(resume.filepath)
        
        # 2. Extract skills using Gemini
        extracted_skills = extract_skills_from_resume(text)
        
        # 3. Update resume fields
        resume.extracted_text = text
        resume.extracted_skills = extracted_skills
        resume.parsing_status = "completed"
        
        db.commit()
    except Exception as e:
        logger.error(f"Error during async resume parsing: {e}", exc_info=True)
        try:
            db.rollback()
            resume = db.query(Resume).filter(Resume.id == resume_id).first()
            if resume:
                resume.parsing_status = "failed"
                resume.extracted_skills = {"error": str(e)}
                db.commit()
        except Exception as rollback_err:
            logger.error(f"Failed to save failed parsing status: {rollback_err}", exc_info=True)
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = verify_token(token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# -------- UPLOAD — candidate only -------- #

@router.post("/upload")
def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_id: int | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ["candidate", "recruiter"]:
        raise HTTPException(
            status_code=403,
            detail="Only candidates or recruiters can upload resumes"
        )

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF files accepted")

    job = None
    if job_id is not None:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if current_user.role == "recruiter" and job.recruiter_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to upload to this job")
    else:
        if current_user.role == "candidate":
            raise HTTPException(status_code=400, detail="Job ID is required for candidates")

    filename = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    resume = Resume(
        filename=filename,
        filepath=file_path,
        extracted_text=None,
        extracted_skills=None,
        user_id=current_user.id,
        job_id=job.id if job else None,
        parsing_status="processing"
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    # Spawn background parsing task
    background_tasks.add_task(parse_resume_background_task, resume.id)

    return {
        "message":          "Resume upload complete. AI parsing started.",
        "resume_id":        resume.id,
        "uploaded_by":      current_user.email,
        "filename":         filename,
        "parsing_status":   resume.parsing_status
    }


# -------- CANDIDATE — own resumes only -------- #

@router.get("/my-resumes")
def get_my_resumes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=403,
            detail="Only candidates can access this endpoint"
        )

    resumes = db.query(Resume).filter(Resume.user_id == current_user.id).all()
    return [
        {
            "resume_id":   r.id,
            "filename":    r.filename,
            "uploaded_at": r.uploaded_at,
        }
        for r in resumes
    ]


# -------- RECRUITER — all resumes -------- #

@router.get("/all")
def get_all_resumes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "recruiter":
        raise HTTPException(status_code=403, detail="Not authorized")

    raw_resumes = (
        db.query(Resume)
        .outerjoin(Job, Job.id == Resume.job_id)
        .filter(
            (Job.recruiter_id == current_user.id) |
            ((Resume.job_id == None) & (Resume.user_id == current_user.id))
        )
        .all()
    )
    
    # Dedup in Python because PostgreSQL cannot do DISTINCT on JSON columns
    resumes = list({r.id: r for r in raw_resumes}.values())
    return [
        {
            "resume_id":    r.id,
            "filename":     r.filename,
            "uploaded_by":  r.user.email if r.user else "Unknown",
            "uploaded_at":  r.uploaded_at,
            "status":       r.status,
            "job_id":       r.job_id,
            "job_title":    r.job.title if r.job else None,
        }
        for r in resumes
    ]

# -------- RECRUITER — specific job applicants -------- #

@router.get("/job/{job_id}/applicants")
def get_job_applicants(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view applicants")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.recruiter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view applicants for this job")
        
    results = (
        db.query(Resume, Score)
        .outerjoin(Score, (Score.resume_id == Resume.id) & (Score.job_id == job_id))
        .filter(Resume.job_id == job_id)
        .all()
    )
    
    return [
        {
            "resume_id": r.id,
            "filename": r.filename,
            "uploaded_by": r.user.email if r.user else "Unknown",
            "uploaded_at": r.uploaded_at,
            "status": r.status,
            "match_score": s.match_score if s else None
        }
        for r, s in results
    ]

# -------- GET ONE — authorized only -------- #

@router.get("/{resume_id}")
def get_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        logger.debug(f"[GET_RESUME] Resume {resume_id} not found in database.")
        raise HTTPException(status_code=404, detail="Resume not found")
        
    logger.debug(
        f"[GET_RESUME] User {current_user.email} (Role: {current_user.role}, ID: {current_user.id}) "
        f"requesting Resume ID: {resume.id}, linked job_id: {resume.job_id}, owner user_id: {resume.user_id}."
    )

    if current_user.role == "candidate":
        if resume.user_id != current_user.id:
            logger.debug(
                f"[GET_RESUME] Access Denied: Candidate user ID {current_user.id} "
                f"does not match resume owner user ID {resume.user_id}."
            )
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "recruiter":
        if resume.job:
            if resume.job.recruiter_id != current_user.id:
                logger.debug(
                    f"[GET_RESUME] Access Denied: Recruiter user ID {current_user.id} "
                    f"does not match job recruiter ID {resume.job.recruiter_id}."
                )
                raise HTTPException(status_code=403, detail="Not authorized to view this resume")
        else:
            if resume.user_id != current_user.id:
                logger.debug(
                    f"[GET_RESUME] Access Denied: Recruiter user ID {current_user.id} "
                    f"did not upload this job-less resume (resume.user_id = {resume.user_id})."
                )
                raise HTTPException(status_code=403, detail="Not authorized to view this resume")
    elif current_user.role == "company_admin":
        if resume.job:
            if resume.job.company_id != current_user.company_id:
                logger.debug(
                    f"[GET_RESUME] Access Denied: Company Admin company ID {current_user.company_id} "
                    f"does not match job company ID {resume.job.company_id}."
                )
                raise HTTPException(status_code=403, detail="Not authorized to view this resume")
        else:
            uploader = db.query(User).filter(User.id == resume.user_id).first()
            if not uploader or uploader.company_id != current_user.company_id:
                logger.debug(
                    f"[GET_RESUME] Access Denied: Job-less resume uploader company ID does not match admin company ID."
                )
                raise HTTPException(status_code=403, detail="Not authorized to view this resume")
            
    return {
        "resume_id": resume.id,
        "filename": resume.filename,
        "uploaded_by": resume.user.email if resume.user else "Unknown",
        "uploaded_at": resume.uploaded_at,
        "extracted_text": resume.extracted_text,
        "extracted_skills": resume.extracted_skills,
        "parsing_status": resume.parsing_status
    }


# -------- DELETE — owner only -------- #

@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if resume.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own resumes"
        )

    db.delete(resume)
    db.commit()

    return {"message": f"Resume {resume_id} deleted successfully"}


# -------- RE-EXTRACT SKILLS — owner only -------- #

@router.post("/{resume_id}/extract-skills")
def re_extract_skills(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if resume.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only re-extract skills for your own resumes"
        )

    skills = extract_skills_from_resume(resume.extracted_text)
    resume.extracted_skills = skills
    db.commit()
    db.refresh(resume)

    return {
        "resume_id": resume.id,
        "extracted_skills": skills
    }

# -------- UPDATE RESUME STATUS — authorized recruiter only -------- #

@router.patch("/{resume_id}/status")
def update_resume_status(
    resume_id: int,
    status_update: ResumeStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can update resume status")

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = resume.job
    if not job:
        raise HTTPException(status_code=404, detail="Resume is not associated with a job")

    if job.recruiter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update status for this job")

    resume.status = status_update.status
    db.commit()
    db.refresh(resume)

    # Attempt to send notification email in background
    import re
    candidate_email = None
    if resume.extracted_text:
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', resume.extracted_text)
        if email_match:
            candidate_email = email_match.group(0)
            
    if not candidate_email and resume.user:
        candidate_email = resume.user.email
        
    candidate_name = resume.user.name if resume.user and resume.user.name else "Candidate"
    
    if candidate_email and status_update.send_email:
        company_name = job.company.name if job.company else "Our Company"
        background_tasks.add_task(
            email_service.send_and_log_status_update_email,
            candidate_email,
            candidate_name,
            job.title,
            company_name,
            resume.status,
            resume.id
        )

    return {
        "resume_id": resume.id,
        "status": resume.status,
        "message": "Status updated successfully"
    }