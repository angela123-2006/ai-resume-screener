import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration Phase 7 (Create notification_logs table)...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notification_logs (
                    id SERIAL PRIMARY KEY,
                    candidate_email VARCHAR(255) NOT NULL,
                    candidate_name VARCHAR(255) NOT NULL,
                    application_id INTEGER,
                    status VARCHAR(50) NOT NULL,
                    email_subject VARCHAR(255) NOT NULL,
                    sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    delivery_status VARCHAR(50) NOT NULL,
                    error_message TEXT
                );
            """))
            conn.commit()
            print("Successfully created notification_logs table.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
