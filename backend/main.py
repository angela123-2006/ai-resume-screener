from fastapi import FastAPI

from app.database.database import engine
from app.database.database import Base

from app.models.user import User

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Resume Screener"
)

@app.get("/")
def home():
    return {
        "message": "AI Resume Screener API"
    }