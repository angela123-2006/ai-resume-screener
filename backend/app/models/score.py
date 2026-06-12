from sqlalchemy import Column, Integer, Float, Text, ForeignKey, DateTime, JSON
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
    created_at     = Column(DateTime, default=datetime.utcnow)

    resume_id      = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    job_id         = Column(Integer, ForeignKey("jobs.id"), nullable=False)

    resume         = relationship("Resume", back_populates="scores")
    job            = relationship("Job", back_populates="scores")