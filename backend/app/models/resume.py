from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.database import Base

class Resume(Base):
    __tablename__ = "resumes"

    id               = Column(Integer, primary_key=True, index=True)
    filename         = Column(String, nullable=False)
    filepath         = Column(String, nullable=False)
    extracted_text   = Column(Text, nullable=True)
    extracted_skills = Column(JSON, nullable=True)
    uploaded_at      = Column(DateTime, default=datetime.utcnow)
    status           = Column(String, default="pending", nullable=False)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id           = Column(Integer, ForeignKey("jobs.id"), nullable=True)

    user             = relationship("User", back_populates="resumes")
    job              = relationship("Job", back_populates="resumes")
    scores           = relationship("Score", back_populates="resume", cascade="all, delete-orphan")