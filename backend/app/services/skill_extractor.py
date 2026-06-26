import json
import os
import time
import re
from google import genai
from dotenv import load_dotenv

load_dotenv()

# genai client is now managed inside app/services/ai_provider.py
from app.services.ai_provider import generate_skills

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

def extract_skills_from_resume(resume_text: str) -> dict:
    """
    Calls dynamic AI fallback chain to extract structured skills from resume text.
    Returns a dict. On failure, returns an empty structured dict with an error key.
    """
    empty_result = {
        "technical_skills": [],
        "soft_skills": [],
        "tools_and_technologies": [],
        "certifications": []
    }

    if not resume_text or not resume_text.strip():
        return empty_result

    try:
        skills_data = generate_skills(resume_text)
        for key in empty_result:
            skills_data.setdefault(key, [])
        return skills_data
    except Exception as e:
        logger_error = f"Skill extraction fallback chain failed: {str(e)}"
        print(logger_error)
        return {**empty_result, "error": str(e), "provider_used": "none"}