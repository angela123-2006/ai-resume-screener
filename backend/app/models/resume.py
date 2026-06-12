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
    extracted_skills = Column(JSON, nullable=True)   # NEW
    uploaded_at      = Column(DateTime, default=datetime.utcnow)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)

    user             = relationship("User", back_populates="resumes")
    scores           = relationship("Score", back_populates="resume")