import json
import os
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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

    models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
    last_error = None

    for model_name in models:
        for attempt in range(3):
            try:
                prompt = SKILL_EXTRACTION_PROMPT.format(resume_text=resume_text[:8000])
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if not response or not response.text:
                    continue

                raw_output = response.text.strip()

                if raw_output.startswith("```"):
                    lines = raw_output.splitlines()
                    if len(lines) >= 2:
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines[-1].startswith("```"):
                            lines = lines[:-1]
                        raw_output = "\n".join(lines).strip()
                else:
                    raw_output = raw_output.replace("json", "", 1).strip()

                skills_data = json.loads(raw_output)

                for key in empty_result:
                    skills_data.setdefault(key, [])

                return skills_data

            except Exception as e:
                last_error = e
                time.sleep(1)

    print(f"Skill extraction failed: {last_error}")
    return {**empty_result, "error": str(last_error)}