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
    created_at:       datetime

    class Config:
        from_attributes = True