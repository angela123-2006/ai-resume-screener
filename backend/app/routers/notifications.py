from fastapi import APIRouter

from app.services.email_service import email_service

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


@router.post("/test-email")
def test_email():

    success = email_service.send_email(
        to_email="atsresume18@gmail.com",
        subject="ATS Email Test",
        html_content="""
        <h2>SMTP Test Successful</h2>
        <p>Your ATS Email Notification System is working.</p>
        """
    )

    if success:
        return {
            "success": True,
            "message": "Email sent successfully"
        }

    return {
        "success": False,
        "message": "Email failed"
    }