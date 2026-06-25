import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration for Phase 2...")
        try:
            conn.execute(text("ALTER TABLE scores ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE scores ADD COLUMN IF NOT EXISTS interview_invited_at TIMESTAMP;"))
            conn.commit()
            print("Migration successful: Added notified and interview_invited_at columns.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
