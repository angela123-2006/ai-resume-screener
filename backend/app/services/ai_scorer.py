import os
import json
import time
import re
from google import genai
from dotenv import load_dotenv

load_dotenv()

# genai client is now managed inside app/services/ai_provider.py
from app.services.ai_provider import generate_score

def clean_and_parse_json(text: str) -> dict:
    raw = text.strip()
    # 1. Try loading directly
    try:
        return json.loads(raw)
    except Exception:
        pass

    # 2. Try pattern matching standard JSON structure
    match = re.search(r'(\{.*\})', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    # 3. Strip code blocks and try again
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r'(\{.*\})', cleaned, re.DOTALL)
    if match:
        return json.loads(match.group(1).strip())

    raise ValueError("Failed to locate a valid JSON block in response.")


def score_resume(resume_text: str, job_description: str) -> dict:
    try:
        return generate_score(resume_text, job_description)
    except Exception as e:
        return {
            "match_score": 0,
            "strengths": [],
            "missing_skills": [],
            "experience_match": "poor",
            "summary": f"Screener Error: {str(e)}",
            "provider_used": "none"
        }


def build_explanation(resume_extracted_skills: dict, ai_result: dict) -> dict:
    """
    Builds a structured explanation combining deterministic skill overlap
    (from Step 1 extraction) with the AI's reasoning.
    Uses substring matching so phrasing differences (e.g. "Python (listed as a skill)"
    vs "Python") still count as confirmed.
    """
    resume_skills = set()
    if resume_extracted_skills:
        for key in ["technical_skills", "tools_and_technologies", "soft_skills", "certifications"]:
            resume_skills.update(
                s.strip().lower() for s in resume_extracted_skills.get(key, [])
            )

    ai_strengths = [s.strip().lower() for s in ai_result.get("strengths", [])]
    ai_missing = [s.strip().lower() for s in ai_result.get("missing_skills", [])]

    confirmed_strengths = []
    unconfirmed_strengths = []

    for strength in ai_strengths:
        if any(rskill and rskill in strength for rskill in resume_skills):
            confirmed_strengths.append(strength)
        else:
            unconfirmed_strengths.append(strength)

    return {
        "match_score": ai_result.get("match_score", 0),
        "experience_match": ai_result.get("experience_match", "unknown"),
        "confirmed_strengths": confirmed_strengths,
        "unconfirmed_strengths": unconfirmed_strengths,
        "missing_skills": ai_missing,
        "resume_skill_count": len(resume_skills),
        "reasoning": ai_result.get("summary", "")
    }