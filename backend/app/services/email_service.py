import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

# Basic Logging setup if not already configured globally
logging.basicConfig(level=logging.INFO)


class EmailService:

    def __init__(self):
        self.host = os.getenv("EMAIL_HOST")
        self.port = int(os.getenv("EMAIL_PORT", "587"))
        self.username = os.getenv("EMAIL_USER")
        self.password = os.getenv("EMAIL_PASSWORD")
        self.from_name = os.getenv("EMAIL_FROM_NAME", "AI ATS System")

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str
    ) -> bool:
        """
        Sends an HTML email to a target recipient synchronously.
        Should be wrapped in BackgroundTasks or Celery queue when called from router handlers.
        """
        try:
            if not self.host or not self.username or not self.password:
                logger.warning("SMTP configuration is incomplete. Email skipped.")
                return False

            message = MIMEMultipart()
            message["From"] = f"{self.from_name} <{self.username}>"
            message["To"] = to_email
            message["Subject"] = subject
            message.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(message)

            logger.info(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Email sending to {to_email} failed: {str(e)}", exc_info=True)
            return False

    def send_status_update_email(self, candidate_email: str, candidate_name: str, job_title: str, new_status: str) -> bool:
        """
        Builds the email subject and body based on status, ensuring professional, polished,
        and respectful tone. Then sends the email.
        """
        return self.send_and_log_status_update_email(
            candidate_email=candidate_email,
            candidate_name=candidate_name,
            job_title=job_title,
            company_name="Our Company",
            new_status=new_status,
            resume_id=None
        )

    def send_and_log_status_update_email(
        self,
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        company_name: str,
        new_status: str,
        resume_id: int,
        additional_data: dict = None
    ) -> bool:
        """
        Sends status-specific emails and saves logs in the database.
        """
        # Resolve company name from the recruiter's email domain if possible
        if resume_id:
            from app.database.database import SessionLocal
            from app.models.resume import Resume
            db = SessionLocal()
            try:
                resume = db.query(Resume).filter(Resume.id == resume_id).first()
                if resume and resume.job and resume.job.recruiter:
                    rec_email = resume.job.recruiter.email
                    if rec_email:
                        parts = rec_email.split("@")
                        if len(parts) == 2:
                            domain = parts[1].lower()
                            common_domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "mail.com", "test.com"]
                            if domain not in common_domains:
                                domain_parts = domain.split(".")
                                if len(domain_parts) > 2 and domain_parts[0] in ["jobs", "careers", "recruitment", "hr", "work"]:
                                    company_name = domain_parts[1].capitalize()
                                else:
                                    company_name = domain_parts[0].capitalize()
            except Exception as e:
                logger.error(f"Error resolving company name from recruiter email: {e}")
            finally:
                db.close()

        subject = ""
        body = ""
        
        status_norm = new_status.lower().strip()
        
        if status_norm in ["applied", "pending"]:
            subject = "Application Received"
            body = f"""
            <p>Dear {candidate_name},</p>
            <p>Thank you for applying for the position of <strong>{job_title}</strong> at <strong>{company_name}</strong>.</p>
            <p>Your application has been successfully received and is under review.</p>
            <p>We appreciate your interest in our company and will contact you if we wish to proceed to the next stage.</p>
            <p>Best regards,<br/>The Recruitment Team<br/>{company_name}</p>
            """
        elif status_norm in ["shortlisted"]:
            subject = "Application Shortlisted"
            body = f"""
            <p>Dear {candidate_name},</p>
            <p>Congratulations! Your profile has been shortlisted for further evaluation for the <strong>{job_title}</strong> position at <strong>{company_name}</strong>.</p>
            <p>Our hiring team will contact you shortly with the next steps and instructions.</p>
            <p>Thank you for your patience.</p>
            <p>Best regards,<br/>The Recruitment Team<br/>{company_name}</p>
            """
        elif status_norm in ["interview", "interview_invited"]:
            subject = "Interview Invitation"
            
            mode = additional_data.get("mode", "Online") if additional_data else "Online"
            date_str = additional_data.get("date", "To be coordinated") if additional_data else "To be coordinated"
            instructions = additional_data.get("instructions", "Our team will reach out with scheduling details shortly.") if additional_data else "Our team will reach out with scheduling details shortly."
            
            body = f"""
            <p>Dear {candidate_name},</p>
            <p>We are pleased to invite you to the next stage of the hiring process for the <strong>{job_title}</strong> position at <strong>{company_name}</strong>.</p>
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #7C3AED; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 4px 0; width: 140px;"><strong>Job Title:</strong></td>
                        <td style="padding: 4px 0;">{job_title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0;"><strong>Company Name:</strong></td>
                        <td style="padding: 4px 0;">{company_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0;"><strong>Interview Date:</strong></td>
                        <td style="padding: 4px 0;">{date_str}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0;"><strong>Interview Mode:</strong></td>
                        <td style="padding: 4px 0;">{mode}</td>
                    </tr>
                </table>
            </div>
            <h4 style="color: #4a5568; margin-bottom: 5px;">Additional Instructions:</h4>
            <p style="background-color: #f7fafc; padding: 10px; border-radius: 5px; font-size: 13px; color: #4a5568; border: 1px dashed #cbd5e1;">{instructions}</p>
            <p>Best regards,<br/>The Recruitment Team<br/>{company_name}</p>
            """
        elif status_norm in ["rejected"]:
            subject = "Application Update"
            body = f"""
            <p>Dear {candidate_name},</p>
            <p>Thank you for your interest in our company and for applying for the <strong>{job_title}</strong> position at <strong>{company_name}</strong>.</p>
            <p>After careful review, we have decided not to proceed with your application at this time.</p>
            <p>We appreciate the time you invested in completing your profile and AI assessments. We will keep your credentials on file and reach out if a future opening aligns with your qualifications.</p>
            <p>We wish you the best of luck in your professional endeavors.</p>
            <p>Best regards,<br/>The Recruitment Team<br/>{company_name}</p>
            """
        elif status_norm in ["hired"]:
            subject = "Congratulations! Offer Selected"
            
            contact_info = additional_data.get("contact_info", "recruitment@company.com") if additional_data else "recruitment@company.com"
            next_steps = additional_data.get("next_steps", "Our onboarding team will reach out with contract details shortly.") if additional_data else "Our onboarding team will reach out with contract details shortly."
            
            body = f"""
            <p>Dear {candidate_name},</p>
            <p>Congratulations! We are pleased to inform you that you have been selected for the position of <strong>{job_title}</strong> at <strong>{company_name}</strong>.</p>
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10B981; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 4px 0; width: 140px;"><strong>Job Title:</strong></td>
                        <td style="padding: 4px 0;">{job_title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0;"><strong>Company Name:</strong></td>
                        <td style="padding: 4px 0;">{company_name}</td>
                    </tr>
                </table>
            </div>
            <h4 style="color: #4a5568; margin-bottom: 5px;">Next Steps:</h4>
            <p style="background-color: #f7fafc; padding: 10px; border-radius: 5px; font-size: 13px; color: #4a5568;">{next_steps}</p>
            <p>If you have any questions, please reach out to us at: <strong>{contact_info}</strong></p>
            <p>Welcome aboard!</p>
            <p>Best regards,<br/>The Recruitment Team<br/>{company_name}</p>
            """
        else:
            logger.warning(f"Skipping status update email. Unknown status: {new_status}")
            return True

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">{subject}</h2>
                {body}
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """
        
        success = self.send_email(to_email=candidate_email, subject=subject, html_content=html_content)
        
        # Log to Database
        from app.database.database import SessionLocal
        from app.models.notification_log import NotificationLog
        
        db = SessionLocal()
        try:
            log_entry = NotificationLog(
                candidate_email=candidate_email,
                candidate_name=candidate_name,
                application_id=resume_id,
                status=new_status,
                email_subject=subject,
                delivery_status="sent" if success else "failed",
                error_message=None if success else "SMTP send failed"
            )
            db.add(log_entry)
            db.commit()
        except Exception as db_err:
            logger.error(f"Failed to log notification email: {db_err}", exc_info=True)
        finally:
            db.close()
            
        return success

    def get_job_created_template(self, job_title: str) -> str:
        """HTML Template for Job Posting confirmation."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">Position Published</h2>
                <p>Hello Recruiter,</p>
                <p>Your open position has been successfully posted to the AI ATS Talent Directory.</p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #00E5FF; margin: 20px 0;">
                    <strong>Role Title:</strong> {job_title}
                </div>
                <p>Candidates can now upload their resumes and execute AI match scoring against this profile.</p>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """

    def get_match_score_template(self, job_title: str, resume_filename: str, score: float, strengths: list, missing: list, summary: str) -> str:
        """HTML Template for Recruiter Match Alerts (Score >= 70)."""
        strengths_li = "".join([f"<li>{s}</li>" for s in strengths]) if strengths else "<li>None flagged</li>"
        missing_li = "".join([f"<li>{m}</li>" for m in missing]) if missing else "<li>None flagged</li>"
        
        score_color = "#10B981" if score >= 80 else "#00E5FF" if score >= 60 else "#F59E0B"

        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">High Match Pipeline Alert</h2>
                <p>Hello Recruiter,</p>
                <p>A new candidate has been evaluated by the AI matching engine and achieved a strong compatibility score:</p>
                
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td><strong>Position:</strong></td>
                            <td>{job_title}</td>
                        </tr>
                        <tr>
                            <td><strong>Resume File:</strong></td>
                            <td>{resume_filename}</td>
                        </tr>
                        <tr>
                            <td><strong>AI Score:</strong></td>
                            <td><span style="color: {score_color}; font-weight: bold; font-size: 16px;">{score}%</span></td>
                        </tr>
                    </table>
                </div>

                <h3 style="color: #4a5568;">AI Summary Evaluation</h3>
                <p style="font-style: italic; color: #4a5568; background-color: #f7fafc; padding: 10px; border-radius: 5px;">"{summary}"</p>

                <table style="width: 100%; margin-top: 20px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 10px;">
                            <h4 style="color: #10B981; margin-bottom: 5px;">Key Strengths</h4>
                            <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
                                {strengths_li}
                            </ul>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 10px;">
                            <h4 style="color: #EF4444; margin-bottom: 5px;">Competency Gaps</h4>
                            <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
                                {missing_li}
                            </ul>
                        </td>
                    </tr>
                </table>

                <p style="margin-top: 30px;">Visit your recruiter dashboard to inspect full assessment reports.</p>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """

    def get_status_update_template(self, candidate_name: str, job_title: str, status_text: str) -> str:
        """HTML Template for Application Status Updates."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">Application Status Update</h2>
                <p>Dear {candidate_name},</p>
                <p>The status of your application for the <strong>{job_title}</strong> role has been updated:</p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #7C3AED; font-weight: bold; margin: 20px 0;">
                    Status: {status_text}
                </div>
                <p>Please log in to your candidate dashboard to view updates or next steps.</p>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """

    def get_candidate_match_template(self, job_title: str, score: float) -> str:
        """HTML Template for Automated Strong Match Candidate Notification."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">Strong Match Found!</h2>
                <p>Hello,</p>
                <p>Great news! The AI ATS engine has evaluated your profile and identified a strong match with an open position.</p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10B981; margin: 20px 0;">
                    <strong>Role:</strong> {job_title}<br/>
                    <strong>Match Score:</strong> {score}%
                </div>
                <p>Your profile is now being highlighted to the hiring team for review. You can log into your candidate dashboard to view the full assessment details.</p>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """

    def get_interview_invite_template(self, job_title: str) -> str:
        """HTML Template for Recruiter-triggered Interview Invitation."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">Interview Invitation</h2>
                <p>Hello,</p>
                <p>Congratulations! Based on your strong AI assessment score and profile review, you have been selected to advance to the interview stage.</p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #7C3AED; margin: 20px 0;">
                    <strong>Position:</strong> {job_title}
                </div>
                <p>Our recruitment team will be in touch shortly with scheduling details and next steps.</p>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """

    def get_rejection_template(self, job_title: str) -> str:
        """HTML Template for Recruiter-triggered Rejection."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6E56CF; border-bottom: 2px solid #6E56CF; padding-bottom: 10px;">Application Update</h2>
                <p>Hello,</p>
                <p>Thank you for taking the time to apply and complete the AI assessment for the following position:</p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #EF4444; margin: 20px 0;">
                    <strong>Position:</strong> {job_title}
                </div>
                <p>While your background is impressive, we have decided to move forward with other candidates who more closely match the specific requirements of this role.</p>
                <p>We wish you the best of luck in your job search.</p>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 30px;">AI ATS Automations Engine</p>
            </div>
        </body>
        </html>
        """

email_service = EmailService()