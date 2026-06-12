from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os, fitz, uuid

from app.database.session import get_db
from app.models.user import User
from app.models.resume import Resume
from app.utils.security import verify_token, require_role
from app.services.skill_extractor import extract_skills_from_resume

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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ✅ only candidates can upload resumes
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=403,
            detail="Only candidates can upload resumes"
        )

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF files accepted")

    filename = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    text = extract_text_from_pdf(file_path)

    # ✅ extract skills using Gemini
    extracted_skills = extract_skills_from_resume(text)

    resume = Resume(
        filename=filename,
        filepath=file_path,
        extracted_text=text,
        extracted_skills=extracted_skills,
        user_id=current_user.id
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return {
        "message":          "Resume uploaded successfully",
        "resume_id":        resume.id,
        "uploaded_by":      current_user.email,
        "filename":         filename,
        "extracted_text":   text[:500],
        "extracted_skills": extracted_skills
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
    payload: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db)
):
    resumes = db.query(Resume).join(User).all()
    return [
        {
            "resume_id":    r.id,
            "filename":     r.filename,
            "uploaded_by":  r.user.email,
            "uploaded_at":  r.uploaded_at,
        }
        for r in resumes
    ]


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