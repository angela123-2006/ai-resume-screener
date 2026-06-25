from sqlalchemy import Column, Integer, Float, Text, ForeignKey, DateTime, JSON, Boolean, String
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.database import Base


class Score(Base):

    __tablename__ = "scores"

    id             = Column(Integer, primary_key=True, index=True)
    match_score    = Column(Float, nullable=False)

    strengths      = Column(Text, nullable=True)
    missing_skills = Column(Text, nullable=True)

    summary        = Column(Text, nullable=True)
    explanation    = Column(JSON, nullable=True)

    recruiter_notified = Column(Boolean, default=False, nullable=False)
    notified       = Column(Boolean, default=False, nullable=False)
    status         = Column(String, default="applied", nullable=False)
    interview_invited_at = Column(DateTime, nullable=True)

    confidence     = Column(String, default="medium", nullable=False)
    recruiter_flagged = Column(Boolean, default=False, nullable=False)
    recruiter_override_note = Column(Text, nullable=True)

    created_at     = Column(DateTime, default=datetime.utcnow)

    resume_id      = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    job_id         = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)

    resume         = relationship("Resume", back_populates="scores")
    job            = relationship("Job", back_populates="scores")