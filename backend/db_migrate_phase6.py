import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration Phase 6 (Nullable job_id on Resumes)...")
        try:
            conn.execute(text("ALTER TABLE resumes ALTER COLUMN job_id DROP NOT NULL;"))
            conn.commit()
            print("Successfully made job_id nullable on resumes table.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
