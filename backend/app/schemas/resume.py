from pydantic import BaseModel
from typing import Literal

class ResumeStatusUpdate(BaseModel):
    status: Literal["pending", "applied", "shortlisted", "interview", "hired", "rejected"]
    send_email: bool = True
