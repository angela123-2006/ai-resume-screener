import os
import smtplib
import logging

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


class EmailService:

    def __init__(self):
        self.host = os.getenv("EMAIL_HOST")
        self.port = int(os.getenv("EMAIL_PORT", "587"))
        self.username = os.getenv("EMAIL_USER")
        self.password = os.getenv("EMAIL_PASSWORD")
        self.from_name = os.getenv(
            "EMAIL_FROM_NAME",
            "AI ATS System"
        )

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str
    ) -> bool:

        try:

            if not self.host:
                raise ValueError("EMAIL_HOST not configured")

            if not self.username:
                raise ValueError("EMAIL_USER not configured")

            if not self.password:
                raise ValueError("EMAIL_PASSWORD not configured")

            print("\n===== EMAIL CONFIG =====")
            print("HOST:", self.host)
            print("PORT:", self.port)
            print("USER:", self.username)
            print("PASSWORD LOADED:", bool(self.password))
            print("PASSWORD LENGTH:", len(self.password))
            print("========================\n")

            message = MIMEMultipart()

            message["From"] = (
                f"{self.from_name} <{self.username}>"
            )

            message["To"] = to_email
            message["Subject"] = subject

            message.attach(
                MIMEText(html_content, "html")
            )

            with smtplib.SMTP(
                self.host,
                self.port
            ) as server:

                server.starttls()

                print(
                    "Attempting Gmail login..."
                )

                server.login(
                    self.username,
                    self.password
                )

                server.send_message(message)

            print(
                f"EMAIL SENT TO: {to_email}"
            )

            logger.info(
                f"Email sent successfully to {to_email}"
            )

            return True

        except Exception as e:

            print(
                "\nEMAIL ERROR:",
                str(e),
                "\n"
            )

            logger.error(
                f"Email sending failed: {str(e)}"
            )

            return False


email_service = EmailService()