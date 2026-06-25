import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from app.database.database import engine, Base
from sqlalchemy.orm import Session
from app.models.company import Company
from app.models.user import User
from app.models.job import Job
from app.models.resume import Resume
from app.models.notification_log import NotificationLog
from app.utils.security import hash_password
import time

client = TestClient(app)

def test_email_notifications_workflow():
    print("Setting up test data for Email Notifications...")
    with Session(engine) as db:
        # Pre-cleanup in case of previous test crashes
        test_emails = ["reca_notif@test.com", "recb_notif@test.com", "cand_notif@test.com"]
        db.query(NotificationLog).filter(NotificationLog.candidate_email == "cand_notif@test.com").delete()
        
        # Delete test resumes first
        test_users = db.query(User).filter(User.email.in_(test_emails)).all()
        test_user_ids = [u.id for u in test_users]
        if test_user_ids:
            db.query(Resume).filter(Resume.user_id.in_(test_user_ids)).delete()
            db.query(Job).filter(Job.recruiter_id.in_(test_user_ids)).delete()
            
        db.query(User).filter(User.email.in_(test_emails)).delete()
        db.query(Company).filter(Company.slug.in_(["notif-comp-a", "notif-comp-b"])).delete()
        db.commit()

        # Create companies
        comp_a = Company(name="Notification Comp A", slug="notif-comp-a")
        comp_b = Company(name="Notification Comp B", slug="notif-comp-b")
        db.add(comp_a)
        db.add(comp_b)
        db.commit()
        db.refresh(comp_a)
        db.refresh(comp_b)

        # Create recruiters
        rec_a = User(name="Rec A", email="reca_notif@test.com", password=hash_password("pass"), role="recruiter", company_id=comp_a.id)
        rec_b = User(name="Rec B", email="recb_notif@test.com", password=hash_password("pass"), role="recruiter", company_id=comp_b.id)
        db.add(rec_a)
        db.add(rec_b)
        db.commit()
        db.refresh(rec_a)
        db.refresh(rec_b)

        rec_a_id = rec_a.id
        rec_b_id = rec_b.id
        comp_a_id = comp_a.id
        comp_b_id = comp_b.id

        # Create jobs
        job_a = Job(title="Job A", description="Job A desc", recruiter_id=rec_a.id, company_id=comp_a.id)
        job_b = Job(title="Job B", description="Job B desc", recruiter_id=rec_b.id, company_id=comp_b.id)
        db.add(job_a)
        db.add(job_b)
        db.commit()
        db.refresh(job_a)
        db.refresh(job_b)

        job_b_id = job_b.id
        job_a_id = job_a.id

        # Create Candidate User
        cand_user = User(name="Cand User", email="cand_notif@test.com", password=hash_password("pass"), role="candidate", company_id=None)
        db.add(cand_user)
        db.commit()
        db.refresh(cand_user)

        # Create Resumes
        res_a1 = Resume(filename="res_a1.pdf", filepath="uploads/res_a1.pdf", extracted_text="A1 text", extracted_skills="['python']", user_id=cand_user.id, job_id=job_a.id)
        db.add(res_a1)
        db.commit()
        db.refresh(res_a1)

        res_a1_id = res_a1.id
        cand_user_id = cand_user.id

    try:
        # Login as Recruiter A
        print("Logging in as Recruiter A...")
        response = client.post("/api/users/login", json={"email": "reca_notif@test.com", "password": "pass"})
        assert response.status_code == 200, f"Login failed: {response.text}"
        token_a = response.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Login as Recruiter B
        print("Logging in as Recruiter B...")
        response = client.post("/api/users/login", json={"email": "recb_notif@test.com", "password": "pass"})
        assert response.status_code == 200, f"Login failed: {response.text}"
        token_b = response.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 1. Update status with send_email=True
        print("Updating status to 'interview' with send_email=True...")
        resp = client.patch(
            f"/api/resume/{res_a1_id}/status",
            json={"status": "interview", "send_email": True},
            headers=headers_a
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Give background task a moment to execute
        time.sleep(1)

        # Verify a notification log was created
        with Session(engine) as db:
            logs = db.query(NotificationLog).filter(NotificationLog.application_id == res_a1_id).all()
            assert len(logs) == 1, f"Expected 1 log, found {len(logs)}"
            assert logs[0].status == "interview"
            assert logs[0].candidate_email == "cand_notif@test.com"
            print("Verified: Notification log was correctly inserted.")

        # 2. Update status with send_email=False
        print("Updating status to 'shortlisted' with send_email=False...")
        resp = client.patch(
            f"/api/resume/{res_a1_id}/status",
            json={"status": "shortlisted", "send_email": False},
            headers=headers_a
        )
        assert resp.status_code == 200

        time.sleep(1)

        # Verify NO new notification log was created (still only 1 log)
        with Session(engine) as db:
            logs = db.query(NotificationLog).filter(NotificationLog.application_id == res_a1_id).all()
            assert len(logs) == 1, f"Expected 1 log, found {len(logs)}"
            print("Verified: No email notification log was generated when send_email was False.")

        # 3. Retrieve notifications list
        print("Retrieving notification logs for Resume A1 as Recruiter A...")
        get_logs_resp = client.get(f"/api/notifications/resume/{res_a1_id}", headers=headers_a)
        assert get_logs_resp.status_code == 200
        logs_list = get_logs_resp.json()
        assert len(logs_list) == 1
        assert logs_list[0]["email_subject"] == "Interview Invitation"
        print("Verified: Recruiter A successfully retrieved logs list.")

        # 4. Attempt to retrieve notifications list as Recruiter B (should get 403)
        print("Attempting to retrieve notification logs for Resume A1 as Recruiter B (should fail)...")
        get_logs_resp_b = client.get(f"/api/notifications/resume/{res_a1_id}", headers=headers_b)
        assert get_logs_resp_b.status_code == 403, f"Expected 403, got {get_logs_resp_b.status_code}"
        print("Verified: Recruiter B is blocked with 403 Forbidden.")

        print("SUCCESS! Automated Email Notification tests completed successfully.")

    finally:
        # Cleanup
        print("Cleaning up notification test data...")
        with Session(engine) as db:
            db.query(NotificationLog).filter(NotificationLog.application_id == res_a1_id).delete()
            db.query(Resume).filter(Resume.id == res_a1_id).delete()
            db.query(Job).filter(Job.id.in_([job_a_id, job_b_id])).delete()
            db.query(User).filter(User.id.in_([rec_a_id, rec_b_id, cand_user_id])).delete()
            db.query(Company).filter(Company.slug.in_(["notif-comp-a", "notif-comp-b"])).delete()
            db.commit()

if __name__ == "__main__":
    test_email_notifications_workflow()
