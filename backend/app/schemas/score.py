from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any

class ScoreResponse(BaseModel):
    id:               int
    resume_id:        int
    job_id:           int
    match_score:      float
    strengths:        str
    missing_skills:   str
    summary:          str
    explanation:      Optional[Dict[str, Any]] = None
    status:           str
    confidence:       str
    recruiter_flagged: bool
    recruiter_override_note: Optional[str] = None
    created_at:       datetime

    class Config:
        from_attributes = True

class ScoreStatusUpdate(BaseModel):
    status: str
    send_email: bool = True

class ScoreOverrideRequest(BaseModel):
    flagged: bool
    note: Optional[str] = None