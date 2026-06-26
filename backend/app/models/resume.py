from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, event
from sqlalchemy.orm import relationship
from datetime import datetime
import os
import logging
from app.database.database import Base

logger = logging.getLogger(__name__)

class Resume(Base):
    __tablename__ = "resumes"

    id               = Column(Integer, primary_key=True, index=True)
    filename         = Column(String, nullable=False)
    filepath         = Column(String, nullable=False)
    extracted_text   = Column(Text, nullable=True)
    extracted_skills = Column(JSON, nullable=True)
    uploaded_at      = Column(DateTime, default=datetime.utcnow)
    status           = Column(String, default="pending", nullable=False)
    parsing_status   = Column(String, default="pending", nullable=False)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id           = Column(Integer, ForeignKey("jobs.id"), nullable=True)

    user             = relationship("User", back_populates="resumes")
    job              = relationship("Job", back_populates="resumes")
    scores           = relationship("Score", back_populates="resume", cascade="all, delete-orphan")

@event.listens_for(Resume, 'after_delete')
def delete_file_on_db_delete(mapper, connection, target):
    if target.filepath:
        try:
            if os.path.exists(target.filepath):
                os.remove(target.filepath)
                logger.info(f"Deleted physical file {target.filepath} on database deletion of Resume ID {target.id}")
        except Exception as e:
            logger.error(f"Failed to delete physical file {target.filepath} on database deletion: {e}", exc_info=True)