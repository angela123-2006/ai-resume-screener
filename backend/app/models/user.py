from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship     
from app.database.database import Base

class User(Base):
    __tablename__ = "users"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, nullable=False)
    email    = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    role     = Column(String, nullable=False)

    resumes  = relationship("Resume", back_populates="user")