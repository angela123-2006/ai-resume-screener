from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobCreate, JobResponse 
from app.utils.security import require_role, get_current_user_payload
from app.services.email_service import email_service

router = APIRouter()


# Helper to send email in background
def send_job_email_task(email: str, job_title: str):
    html = email_service.get_job_created_template(job_title)
    email_service.send_email(
        to_email=email,
        subject=f"Position Published: {job_title}",
        html_content=html
    )


# -------- CREATE JOB — recruiter only -------- #

@router.post("/create", response_model=JobResponse)
def create_job(
    job: JobCreate,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_job = Job(
        title=job.title,
        description=job.description,
        location_type=job.location_type,
        location=job.location,
        recruiter_id=user.id,
        company_id=user.company_id
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Notify Recruiter
    recruiter_email = payload.get("sub")
    if recruiter_email:
        background_tasks.add_task(
            send_job_email_task,
            recruiter_email,
            new_job.title
        )

    return new_job


# -------- GET MY POSTED JOBS — recruiter only -------- #

@router.get("/my", response_model=list[JobResponse])
def get_my_jobs(
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return db.query(Job).filter(Job.recruiter_id == user.id).all()


# -------- GET ALL JOBS — everyone -------- #

@router.get("/all", response_model=list[JobResponse])
def get_all_jobs(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "recruiter":
        return db.query(Job).filter(Job.recruiter_id == user.id).all()
    elif user.role == "company_admin":
        return db.query(Job).filter(Job.company_id == user.company_id).all()
    
    return db.query(Job).all()


# -------- GET SINGLE JOB — everyone -------- #

@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "recruiter" and job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    elif user.role == "company_admin" and job.company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    return job


# -------- UPDATE JOB — owner recruiter only -------- #

@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    job_data: JobCreate,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this job")

    job.title = job_data.title
    job.description = job_data.description
    job.location_type = job_data.location_type
    job.location = job_data.location

    db.commit()
    db.refresh(job)
    return job


# -------- DELETE JOB — owner recruiter only -------- #

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.recruiter_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")

    db.delete(job)
    db.commit()
    return {"message": f"Job {job_id} deleted successfully"}