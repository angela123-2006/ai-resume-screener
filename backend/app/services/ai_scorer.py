import os
import json
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def score_resume(resume_text: str, job_description: str) -> dict:

    prompt = f"""
You are an expert HR recruiter and resume screener.

Analyze this resume against the job description below.

JOB DESCRIPTION:
{job_description}

RESUME:
{resume_text}

Return ONLY a JSON object, no explanation, no markdown, just raw JSON:

{{
    "match_score": <integer 0-100>,
    "strengths": ["skill1", "skill2", "skill3"],
    "missing_skills": ["skill1", "skill2"],
    "experience_match": "good or partial or poor",
    "summary": "2-3 sentence evaluation of the candidate"
}}
"""

    models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
    last_error = None

    for model_name in models:
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if not response or not response.text:
                    continue

                raw = response.text.strip()
                if raw.startswith("```"):
                    lines = raw.splitlines()
                    if len(lines) >= 2:
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines[-1].startswith("```"):
                            lines = lines[:-1]
                        raw = "\n".join(lines).strip()
                else:
                    raw = raw.replace("```json", "").replace("```", "").strip()

                result = json.loads(raw)
                return result

            except Exception as e:
                last_error = e
                time.sleep(1)

    return {
        "match_score": 0,
        "strengths": [],
        "missing_skills": [],
        "experience_match": "poor",
        "summary": f"AI Error: {str(last_error)}"
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