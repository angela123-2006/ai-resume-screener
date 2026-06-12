import json
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

SKILL_EXTRACTION_PROMPT = """
You are a resume parsing engine. Extract skills from the resume text below.

Return STRICT JSON only, in this exact format, no markdown, no extra text:
{{
  "technical_skills": ["skill1", "skill2"],
  "soft_skills": ["skill1", "skill2"],
  "tools_and_technologies": ["tool1", "tool2"],
  "certifications": ["cert1"]
}}

Resume Text:
\"\"\"{resume_text}\"\"\"
"""

def extract_skills_from_resume(resume_text: str) -> dict:
    """
    Calls Gemini to extract structured skills from resume text.
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
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = SKILL_EXTRACTION_PROMPT.format(resume_text=resume_text[:8000])
        response = model.generate_content(prompt)

        raw_output = response.text.strip()

        if raw_output.startswith("```"):
            raw_output = raw_output.strip("`")
            raw_output = raw_output.replace("json", "", 1).strip()

        skills_data = json.loads(raw_output)

        for key in empty_result:
            skills_data.setdefault(key, [])

        return skills_data

    except Exception as e:
        print(f"Skill extraction failed: {e}")
        return {**empty_result, "error": str(e)}