import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration for Phase 3...")
        try:
            conn.execute(text("ALTER TABLE scores ADD COLUMN IF NOT EXISTS confidence VARCHAR DEFAULT 'medium';"))
            conn.execute(text("ALTER TABLE scores ADD COLUMN IF NOT EXISTS recruiter_flagged BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE scores ADD COLUMN IF NOT EXISTS recruiter_override_note TEXT;"))
            conn.commit()
            print("Migration successful: Added confidence, recruiter_flagged, and recruiter_override_note columns.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
