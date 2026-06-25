from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class JobCompany(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class JobCreate(BaseModel):
    title: str
    description: str
    location_type: str = "On-site"
    location: Optional[str] = None

class JobResponse(BaseModel):
    id: int
    title: str
    description: str
    location_type: str
    location: Optional[str] = None
    created_at: datetime
    company: Optional[JobCompany] = None

    class Config:
        from_attributes = True