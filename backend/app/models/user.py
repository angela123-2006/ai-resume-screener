from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, nullable=False)
    email    = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    role     = Column(String, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)

    
    resumes  = relationship("Resume", back_populates="user")

    
    jobs     = relationship("Job", back_populates="recruiter")