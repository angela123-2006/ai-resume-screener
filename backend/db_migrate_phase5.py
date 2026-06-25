import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration Phase 5 (Recruiter Isolation)...")
        try:
            # 1. Add recruiter_id to jobs if it doesn't exist
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recruiter_id INTEGER;"))
            conn.commit()
            print("Added recruiter_id column to jobs (if not existed).")

            # 2. Get first recruiter ID as default backfill
            res = conn.execute(text("SELECT id FROM users WHERE role = 'recruiter' ORDER BY id ASC LIMIT 1"))
            default_recruiter_id = res.scalar()
            print(f"Default recruiter ID found for backfill: {default_recruiter_id}")

            # 3. Copy owner_id to recruiter_id
            # First copy matching data
            # Check if owner_id column exists
            columns_res = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='jobs' AND column_name='owner_id'
            """))
            owner_id_exists = columns_res.scalar() is not None

            if owner_id_exists:
                conn.execute(text("UPDATE jobs SET recruiter_id = owner_id WHERE recruiter_id IS NULL AND owner_id IS NOT NULL;"))
                conn.commit()
                print("Copied values from owner_id to recruiter_id.")

            # 4. Backfill any remaining NULL recruiter_ids
            if default_recruiter_id:
                conn.execute(text(f"UPDATE jobs SET recruiter_id = {default_recruiter_id} WHERE recruiter_id IS NULL;"))
                conn.commit()
                print("Backfilled remaining NULL recruiter_ids with default recruiter ID.")

            # 5. Drop old owner_id column
            if owner_id_exists:
                conn.execute(text("ALTER TABLE jobs DROP COLUMN IF EXISTS owner_id;"))
                conn.commit()
                print("Dropped old owner_id column.")

            # 6. Add Foreign Key constraint for recruiter_id
            try:
                conn.execute(text("ALTER TABLE jobs ADD CONSTRAINT fk_jobs_recruiter FOREIGN KEY (recruiter_id) REFERENCES users (id) ON DELETE SET NULL;"))
                conn.commit()
                print("Added fk_jobs_recruiter constraint.")
            except Exception as e:
                print(f"Constraint might already exist: {e}")

            print("Migration Phase 5 successfully completed.")

        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
