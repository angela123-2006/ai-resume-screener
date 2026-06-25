from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database.database import Base

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    candidate_email = Column(String, nullable=False)
    candidate_name = Column(String, nullable=False)
    application_id = Column(Integer, nullable=True)  # maps to resume_id
    status = Column(String, nullable=False)
    email_subject = Column(String, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    delivery_status = Column(String, nullable=False)  # 'sent', 'failed'
    error_message = Column(Text, nullable=True)
