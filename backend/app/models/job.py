from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship                      
from datetime import datetime
from app.database.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    scores      = relationship("Score", back_populates="job")