from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
from collections import Counter

from app.database.session import get_db
from app.models.job import Job
from app.models.resume import Resume
from app.models.score import Score
from app.utils.security import get_current_user_payload

router = APIRouter()


@router.get("/stats")
def get_dashboard_stats(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    if payload.get("role") != "recruiter":
        raise HTTPException(
            status_code=403,
            detail="Only recruiters can access dashboard stats"
        )

    # -------------------------
    # BASIC STATS
    # -------------------------
    total_jobs = db.query(Job).count()
    total_resumes = db.query(Resume).count()
    total_scores = db.query(Score).count()

    average_score = db.query(func.avg(Score.match_score)).scalar() or 0
    top_score = db.query(func.max(Score.match_score)).scalar() or 0

    # -------------------------
    # SCORE DISTRIBUTION
    # -------------------------
    weak = db.query(Score).filter(Score.match_score < 30).count()
    average = db.query(Score).filter(
        Score.match_score >= 30,
        Score.match_score < 60
    ).count()
    good = db.query(Score).filter(
        Score.match_score >= 60,
        Score.match_score < 80
    ).count()
    strong = db.query(Score).filter(Score.match_score >= 80).count()

    # -------------------------
    # TOP 5 CANDIDATES (LEADERBOARD)
    # -------------------------
    top_candidates = (
        db.query(
            Resume.filename,
            Score.match_score,
            Job.title.label("job_title")
        )
        .join(Score, Score.resume_id == Resume.id)
        .join(Job, Job.id == Score.job_id)
        .order_by(Score.match_score.desc())
        .limit(5)
        .all()
    )

    top_candidates_list = [
        {
            "resume": r.filename,
            "job": r.job_title,
            "score": r.match_score
        }
        for r in top_candidates
    ]

    # -------------------------
    # RESPONSE
    # -------------------------
    return {
        "status": "success",
        "data": {
            "overview": {
                "total_jobs": total_jobs,
                "total_resumes": total_resumes,
                "total_scores": total_scores,
                "average_score": round(average_score, 2),
                "top_score": top_score
            },
            "score_distribution": {
                "0-30": weak,
                "30-60": average,
                "60-80": good,
                "80-100": strong
            },
            "top_candidates": top_candidates_list
        }
    }


# -------------------------
# SKILL-GAP INSIGHTS
# -------------------------
@router.get("/insights")
def get_skill_gap_insights(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    if payload.get("role") != "recruiter":
        raise HTTPException(
            status_code=403,
            detail="Only recruiters can access dashboard insights"
        )

    scores = db.query(Score.missing_skills).all()

    missing_counter = Counter()
    for (missing_json,) in scores:
        try:
            missing_list = json.loads(missing_json) if missing_json else []
            for skill in missing_list:
                missing_counter[skill.strip().lower()] += 1
        except (json.JSONDecodeError, TypeError):
            continue

    top_missing_skills = [
        {"skill": skill, "count": count}
        for skill, count in missing_counter.most_common(10)
    ]

    return {
        "status": "success",
        "data": {
            "top_missing_skills": top_missing_skills,
            "total_evaluations": len(scores)
        }
    }


# -------------------------
# PER-JOB ANALYTICS
# -------------------------
@router.get("/job/{job_id}/analytics")
def get_job_analytics(
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    if payload.get("role") != "recruiter":
        raise HTTPException(
            status_code=403,
            detail="Only recruiters can access job analytics"
        )

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    scores = db.query(Score).filter(Score.job_id == job_id).all()

    total_candidates = len(scores)
    average_score = (
        sum(s.match_score for s in scores) / total_candidates
        if total_candidates > 0 else 0
    )
    top_score = max((s.match_score for s in scores), default=0)

    weak = sum(1 for s in scores if s.match_score < 30)
    average = sum(1 for s in scores if 30 <= s.match_score < 60)
    good = sum(1 for s in scores if 60 <= s.match_score < 80)
    strong = sum(1 for s in scores if s.match_score >= 80)

    top_candidates = (
        db.query(Resume.filename, Score.match_score)
        .join(Score, Score.resume_id == Resume.id)
        .filter(Score.job_id == job_id)
        .order_by(Score.match_score.desc())
        .limit(5)
        .all()
    )

    top_candidates_list = [
        {"resume": r.filename, "score": r.match_score}
        for r in top_candidates
    ]

    return {
        "status": "success",
        "data": {
            "job_id": job_id,
            "job_title": job.title,
            "overview": {
                "total_candidates": total_candidates,
                "average_score": round(average_score, 2),
                "top_score": top_score
            },
            "score_distribution": {
                "0-30": weak,
                "30-60": average,
                "60-80": good,
                "80-100": strong
            },
            "top_candidates": top_candidates_list
        }
    }