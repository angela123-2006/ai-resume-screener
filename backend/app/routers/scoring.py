from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.database.session import get_db
from app.models.resume import Resume
from app.models.job import Job
from app.models.score import Score
from app.schemas.score import ScoreResponse
from app.utils.security import get_current_user_payload
from app.services.ai_scorer import score_resume, build_explanation

router = APIRouter()


@router.post("/{resume_id}/score/{job_id}", response_model=ScoreResponse)
def score_a_resume(
    resume_id: int,
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()
    if existing:
        return existing

    result = score_resume(resume.extracted_text, job.description)

    explanation = build_explanation(resume.extracted_skills, result)

    score = Score(
        resume_id=resume_id,
        job_id=job_id,
        match_score=result.get("match_score", 0),
        strengths=json.dumps(result.get("strengths", [])),
        missing_skills=json.dumps(result.get("missing_skills", [])),
        summary=result.get("summary", ""),
        explanation=explanation
    )
    db.add(score)
    db.commit()
    db.refresh(score)

    return score


@router.get("/{resume_id}/scores")
def get_resume_scores(
    resume_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    scores = db.query(Score).filter(Score.resume_id == resume_id).all()
    return [
        {
            "score_id":       s.id,
            "job_id":         s.job_id,
            "match_score":    s.match_score,
            "strengths":      json.loads(s.strengths),
            "missing_skills": json.loads(s.missing_skills),
            "summary":        s.summary,
            "explanation":    s.explanation,
            "scored_at":      s.created_at
        }
        for s in scores
    ]


@router.get("/job/{job_id}/rankings")
def get_job_rankings(
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    scores = (
        db.query(Score)
        .filter(Score.job_id == job_id)
        .order_by(Score.match_score.desc())
        .all()
    )

    rankings = []
    for rank, score in enumerate(scores, start=1):
        rankings.append({
            "rank": rank,
            "resume_id": score.resume_id,
            "score": score.match_score,
            "summary": score.summary
        })

    return rankings


@router.get("/{resume_id}/score/{job_id}/explain")
def explain_score(
    resume_id: int,
    job_id: int,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db)
):
    score = db.query(Score).filter(
        Score.resume_id == resume_id,
        Score.job_id == job_id
    ).first()

    if not score:
        raise HTTPException(status_code=404, detail="Score not found. Run scoring first.")

    return {
        "resume_id": resume_id,
        "job_id": job_id,
        "match_score": score.match_score,
        "explanation": score.explanation
    }