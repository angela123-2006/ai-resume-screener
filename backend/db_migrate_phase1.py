import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration...")
        try:
            conn.execute(text("ALTER TABLE scores ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'applied';"))
            conn.commit()
            print("Migration successful: Added status column to scores table.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
