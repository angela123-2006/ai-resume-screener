from app.database.database import engine
from sqlalchemy import text

def upgrade():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN location_type VARCHAR DEFAULT 'On-site' NOT NULL;"))
            conn.execute(text("ALTER TABLE jobs ADD COLUMN location VARCHAR;"))
            conn.commit()
            print("Migration successful: Added location_type and location to jobs table.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    upgrade()
