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
from app.utils.security import hash_password

client = TestClient(app)

def test_cross_company_leak():
    print("Setting up test data...")
    with Session(engine) as db:
        # Create companies
        comp_a = Company(name="Test Company A", slug="test-company-a")
        comp_b = Company(name="Test Company B", slug="test-company-b")
        db.add(comp_a)
        db.add(comp_b)
        db.commit()
        db.refresh(comp_a)
        db.refresh(comp_b)

        # Create recruiters
        rec_a = User(name="Rec A", email="reca@test.com", password=hash_password("pass"), role="recruiter", company_id=comp_a.id)
        rec_b = User(name="Rec B", email="recb@test.com", password=hash_password("pass"), role="recruiter", company_id=comp_b.id)
        db.add(rec_a)
        db.add(rec_b)
        db.commit()
        db.refresh(rec_a)
        db.refresh(rec_b)

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

        # Create Resumes
        res_a1 = Resume(filename="res_a1.pdf", filepath="uploads/res_a1.pdf", extracted_text="A1 text", extracted_skills="['python']", user_id=rec_a.id, job_id=job_a.id)
        res_a2 = Resume(filename="res_a2.pdf", filepath="uploads/res_a2.pdf", extracted_text="A2 text", extracted_skills="['python']", user_id=rec_a.id, job_id=None)
        res_b1 = Resume(filename="res_b1.pdf", filepath="uploads/res_b1.pdf", extracted_text="B1 text", extracted_skills="['python']", user_id=rec_b.id, job_id=job_b.id)
        res_b2 = Resume(filename="res_b2.pdf", filepath="uploads/res_b2.pdf", extracted_text="B2 text", extracted_skills="['python']", user_id=rec_b.id, job_id=None)

        db.add(res_a1)
        db.add(res_a2)
        db.add(res_b1)
        db.add(res_b2)
        db.commit()

        res_a1_id = res_a1.id
        res_a2_id = res_a2.id
        res_b1_id = res_b1.id
        res_b2_id = res_b2.id

    try:
        # Login as Recruiter A
        print("Logging in as Recruiter A...")
        response = client.post("/api/users/login", json={"email": "reca@test.com", "password": "pass"})
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Attempt to access Job B rankings
        print(f"Attempting to fetch rankings for Job B (id={job_b_id}) as Recruiter A...")
        rankings_response = client.get(f"/api/scoring/job/{job_b_id}/rankings", headers=headers)
        print(f"Response status: {rankings_response.status_code}")
        assert rankings_response.status_code == 403, f"Expected 403, got {rankings_response.status_code}"

        # 2. Attempt to fetch Job B detail
        print(f"Attempting to get Job B detail as Recruiter A...")
        get_response = client.get(f"/api/jobs/{job_b_id}", headers=headers)
        assert get_response.status_code == 403, f"Expected 403, got {get_response.status_code}"

        # 3. Attempt to update Job B
        print(f"Attempting to update Job B as Recruiter A...")
        update_response = client.put(f"/api/jobs/{job_b_id}", json={"title": "Hacked", "description": "Hacked desc"}, headers=headers)
        assert update_response.status_code == 403, f"Expected 403, got {update_response.status_code}"

        # 4. Attempt to delete Job B
        print(f"Attempting to delete Job B as Recruiter A...")
        delete_response = client.delete(f"/api/jobs/{job_b_id}", headers=headers)
        assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}"

        # 5. List jobs and verify Job B is NOT present
        print("Listing jobs as Recruiter A...")
        list_response = client.get("/api/jobs/all", headers=headers)
        assert list_response.status_code == 200
        jobs_list = list_response.json()
        job_ids = [j["id"] for j in jobs_list]
        assert job_b_id not in job_ids, "Should not see other recruiter's jobs"
        assert job_a_id in job_ids, "Should see own job"

        # 6. Verify resume access isolation
        print("Verifying own resume access (job-linked)...")
        r_a1_resp = client.get(f"/api/resume/{res_a1_id}", headers=headers)
        assert r_a1_resp.status_code == 200, f"Expected 200, got {r_a1_resp.status_code}"

        print("Verifying own resume access (job-less)...")
        r_a2_resp = client.get(f"/api/resume/{res_a2_id}", headers=headers)
        assert r_a2_resp.status_code == 200, f"Expected 200, got {r_a2_resp.status_code}"

        print("Verifying unauthorized resume access (job-linked owned by B)...")
        r_b1_resp = client.get(f"/api/resume/{res_b1_id}", headers=headers)
        assert r_b1_resp.status_code == 403, f"Expected 403, got {r_b1_resp.status_code}"

        print("Verifying unauthorized resume access (job-less owned by B)...")
        r_b2_resp = client.get(f"/api/resume/{res_b2_id}", headers=headers)
        assert r_b2_resp.status_code == 403, f"Expected 403, got {r_b2_resp.status_code}"

        # 7. Verify unauthorized operations on Resumes
        print("Attempting to delete Recruiter B's resume as Recruiter A...")
        del_b_resp = client.delete(f"/api/resume/{res_b1_id}", headers=headers)
        assert del_b_resp.status_code == 403, f"Expected 403, got {del_b_resp.status_code}"

        print("Attempting to update status of Recruiter B's resume as Recruiter A...")
        status_b_resp = client.patch(f"/api/resume/{res_b1_id}/status", json={"status": "rejected"}, headers=headers)
        assert status_b_resp.status_code == 403, f"Expected 403, got {status_b_resp.status_code}"

        print("SUCCESS! Resume isolation checks verified.")

    finally:
        # Cleanup
        print("Cleaning up test data...")
        with Session(engine) as db:
            db.query(Resume).filter(Resume.id.in_([res_a1_id, res_a2_id, res_b1_id, res_b2_id])).delete()
            db.query(Job).filter(Job.id.in_([job_a_id, job_b_id])).delete()
            db.query(User).filter(User.email.in_(["reca@test.com", "recb@test.com"])).delete()
            db.query(Company).filter(Company.slug.in_(["test-company-a", "test-company-b"])).delete()
            db.commit()

if __name__ == "__main__":
    test_cross_company_leak()
