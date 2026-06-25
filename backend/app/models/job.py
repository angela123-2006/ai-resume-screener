from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=False)
    recruiter_id = Column(Integer, ForeignKey("users.id"))  

    location_type = Column(String, default="On-site", nullable=False)
    location      = Column(String, nullable=True)

    recruiter   = relationship("User", back_populates="jobs")
    company     = relationship("Company", back_populates="jobs")

    resumes     = relationship("Resume", back_populates="job", cascade="all, delete-orphan")
    scores      = relationship("Score", back_populates="job", cascade="all, delete-orphan")