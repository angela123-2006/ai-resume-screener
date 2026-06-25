import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration for Phase 4...")
        try:
            # 1. Create companies table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    slug VARCHAR UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # 2. Insert Default Company
            conn.execute(text("""
                INSERT INTO companies (name, slug) 
                VALUES ('Default Company', 'default-company')
                ON CONFLICT (slug) DO NOTHING
            """))

            # 3. Add company_id to users and jobs
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER;"))
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id INTEGER;"))

            # 4. Add foreign keys if they don't exist
            # PostgreSQL syntax to add FK only if not exists is tricky, so we wrap in an exception block or query info_schema.
            # We'll just backfill first.

            # Get the default company ID
            res = conn.execute(text("SELECT id FROM companies WHERE slug = 'default-company' LIMIT 1"))
            default_company_id = res.scalar()

            # 5. Backfill existing jobs and recruiters
            if default_company_id:
                conn.execute(text(f"UPDATE users SET company_id = {default_company_id} WHERE role = 'recruiter' AND company_id IS NULL"))
                conn.execute(text(f"UPDATE jobs SET company_id = {default_company_id} WHERE company_id IS NULL"))

            # 6. Set jobs.company_id to NOT NULL
            conn.execute(text("ALTER TABLE jobs ALTER COLUMN company_id SET NOT NULL"))

            # 7. Add Constraints
            try:
                conn.execute(text("ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies (id)"))
            except Exception as e:
                pass # constraint might already exist
            
            try:
                conn.execute(text("ALTER TABLE jobs ADD CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies (id)"))
            except Exception as e:
                pass

            conn.commit()
            print("Migration Phase 4 complete.")

            # Validation Queries
            print("\n--- VALIDATION ---")
            null_jobs = conn.execute(text("SELECT id FROM jobs WHERE company_id IS NULL")).fetchall()
            print(f"Jobs with NULL company_id: {len(null_jobs)}")
            if null_jobs:
                print(f"IDs: {[r[0] for r in null_jobs]}")

            null_recruiters = conn.execute(text("SELECT id FROM users WHERE role = 'recruiter' AND company_id IS NULL")).fetchall()
            print(f"Recruiters with NULL company_id: {len(null_recruiters)}")
            if null_recruiters:
                print(f"IDs: {[r[0] for r in null_recruiters]}")

            # Checking scores via jobs
            null_score_jobs = conn.execute(text("""
                SELECT s.id 
                FROM scores s 
                JOIN jobs j ON s.job_id = j.id 
                WHERE j.company_id IS NULL
            """)).fetchall()
            print(f"Scores linked to jobs with NULL company_id: {len(null_score_jobs)}")

        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
