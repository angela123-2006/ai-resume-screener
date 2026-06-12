from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.job import Job
from app.schemas.job import JobCreate, JobResponse 
from app.utils.security import require_role, get_current_user_payload

router = APIRouter()


# -------- CREATE JOB — recruiter only -------- #

@router.post("/create", response_model=JobResponse)
def create_job(
    job: JobCreate,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    new_job = Job(
        title=job.title,
        description=job.description
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job


# -------- GET ALL JOBS — everyone -------- #

@router.get("/all", response_model=list[JobResponse])
def get_all_jobs(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
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
    return job




@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": f"Job {job_id} deleted successfully"}