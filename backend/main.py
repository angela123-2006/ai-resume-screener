from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI

from app.database.database import engine, Base

from app.routers.user import router as user_router
from app.routers.resume import router as resume_router
from app.routers.jobs import router as jobs_router
from app.routers.scoring import router as scoring_router
from app.routers.dashboard import router as dashboard_router
from app.routers.notifications import router as notification_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Resume Screener",
    version="1.0.0"
)

# Existing Routers
app.include_router(user_router, prefix="/api/users", tags=["Users"])
app.include_router(resume_router, prefix="/api/resume", tags=["Resume"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(scoring_router, prefix="/api/scoring", tags=["Scoring"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])

# New Notifications Router
app.include_router(notification_router)

@app.get("/")
def home():
    return {
        "message": "AI Resume Screener API is running"
    }