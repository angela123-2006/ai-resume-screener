from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.notification_log import NotificationLog
from app.routers.resume import get_current_user
from app.services.email_service import email_service

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


class TestEmailRequest(BaseModel):
    to_email: str

@router.post("/test-email")
def test_email(req: TestEmailRequest):

    success = email_service.send_email(
        to_email=req.to_email,
        subject="ATS Email Test",
        html_content="""
        <h2>SMTP Test Successful</h2>
        <p>Your ATS Email Notification System is working.</p>
        """
    )

    if success:
        return {
            "success": True,
            "message": "Email sent successfully"
        }

    return {
        "success": False,
        "message": "Email failed"
    }

@router.get("/resume/{resume_id}")
def get_resume_notifications(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Strict Recruiter / User Isolation checks (matches get_resume)
    if current_user.role == "candidate":
        if resume.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "recruiter":
        if resume.job:
            if resume.job.recruiter_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized to view notifications for this resume")
        else:
            if resume.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized to view notifications for this resume")
    elif current_user.role == "company_admin":
        if resume.job:
            if resume.job.company_id != current_user.company_id:
                raise HTTPException(status_code=403, detail="Not authorized to view notifications for this resume")
        else:
            uploader = db.query(User).filter(User.id == resume.user_id).first()
            if not uploader or uploader.company_id != current_user.company_id:
                raise HTTPException(status_code=403, detail="Not authorized to view notifications for this resume")

    logs = db.query(NotificationLog).filter(NotificationLog.application_id == resume_id).order_by(NotificationLog.sent_at.desc()).all()
    return logs

from app.models.job import Job

@router.get("/company")
def get_company_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "recruiter" and current_user.role != "company_admin":
        raise HTTPException(status_code=403, detail="Only recruiters and company admins can view company communication logs.")

    if not current_user.company_id:
        return []

    # Fetch jobs belonging to this recruiter's company
    jobs = db.query(Job).filter(Job.company_id == current_user.company_id).all()
    job_ids = [j.id for j in jobs]

    if not job_ids:
        return []

    # Fetch resumes linked to these company jobs
    resumes = db.query(Resume).filter(Resume.job_id.in_(job_ids)).all()
    resume_ids = [r.id for r in resumes]

    if not resume_ids:
        return []

    # Fetch notifications belonging to these applications
    logs = db.query(NotificationLog).filter(NotificationLog.application_id.in_(resume_ids)).order_by(NotificationLog.sent_at.desc()).all()
    return logs

class InboundWebhookRequest(BaseModel):
    sender_email: str
    subject: str
    body: str

@router.post("/inbound-webhook")
def receive_inbound_reply(
    req: InboundWebhookRequest,
    db: Session = Depends(get_db)
):
    # Find candidate user
    cand_user = db.query(User).filter(User.email == req.sender_email).first()
    cand_name = cand_user.name if cand_user else "Candidate"

    # Try to find the latest resume (application) for this candidate user
    resume_id = None
    if cand_user:
        resume = db.query(Resume).filter(Resume.user_id == cand_user.id).order_by(Resume.uploaded_at.desc()).first()
        if resume:
            resume_id = resume.id

    # Log the incoming reply in our notification log database
    log = NotificationLog(
        candidate_email=req.sender_email,
        candidate_name=cand_name,
        application_id=resume_id,
        status="candidate_reply", # special action type for inbound replies
        email_subject=req.subject,
        delivery_status="received", # incoming reply is received
        error_message=None
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "message": f"Inbound reply logged successfully for {req.sender_email}"
    }