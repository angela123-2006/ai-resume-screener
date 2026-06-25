import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration for Phase 8...")
        try:
            conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS parsing_status VARCHAR(50) DEFAULT 'pending';"))
            conn.commit()
            print("Migration Phase 8 complete.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
