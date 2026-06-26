import os
import json
import time
import re
import hashlib
import itertools
import datetime
import logging
from google import genai
from groq import Groq
from openai import OpenAI
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_provider")

# 1. Initialize Redis Client
def get_redis_client():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        r = redis.Redis.from_url(redis_url, decode_responses=True)
        r.ping()
        return r
    except Exception as e:
        logger.warning(f"Redis is unavailable: {str(e)}")
        return None

def update_provider_status(provider: str, status: str):
    r = get_redis_client()
    if r:
        data = {
            "status": status,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        try:
            r.set(f"ai_provider_status:{provider}", json.dumps(data), ex=300)
        except Exception as e:
            logger.warning(f"Failed to save status to Redis: {str(e)}")

# 2. Key Rotation for Gemini
gemini_keys = [os.getenv(f"GEMINI_API_KEY_{i}") for i in range(1, 4)]
gemini_keys = [k for k in gemini_keys if k]
# Fallback to legacy GEMINI_API_KEY if none of the rotated keys are present
if not gemini_keys and os.getenv("GEMINI_API_KEY"):
    gemini_keys = [os.getenv("GEMINI_API_KEY")]

if gemini_keys:
    gemini_key_cycle = itertools.cycle(gemini_keys)
else:
    gemini_key_cycle = None

# JSON parsing utility
def clean_and_parse_json(text: str) -> dict:
    raw = text.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass

    match = re.search(r'(\{.*\})', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r'(\{.*\})', cleaned, re.DOTALL)
    if match:
        return json.loads(match.group(1).strip())

    raise ValueError("Failed to locate a valid JSON block in response.")

# 3. Truncation helper
def truncate_inputs(resume_text: str, job_description: str = None):
    res_trunc = resume_text[:3000] if resume_text else ""
    job_trunc = job_description[:1000] if job_description else ""
    return res_trunc, job_trunc

# 4. Keyword Fallback Engine
def run_keyword_scoring(resume_text: str, job_description: str) -> dict:
    stop_words = {
        'the', 'and', 'or', 'a', 'to', 'of', 'in', 'for', 'with', 'on', 'at', 'by', 
        'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 
        'does', 'did', 'but', 'if', 'i', 'you', 'he', 'she', 'they', 'we', 'us', 
        'them', 'it', 'its', 'this', 'that', 'these', 'those', 'as', 'from', 'about', 
        'into', 'through', 'over', 'under', 'above', 'below', 'can', 'will', 'should',
        'would', 'could', 'may', 'might', 'must', 'in', 'out', 'of', 'for', 'to', 'on', 
        'at', 'by'
    }

    resume_words = [w.lower() for w in re.findall(r'\b\w+\b', resume_text)]
    job_words = [w.lower() for w in re.findall(r'\b\w+\b', job_description)]

    resume_set = set(resume_words)
    job_set = set(job_words)

    overlap = resume_set.intersection(job_set) - stop_words
    job_meaningful = job_set - stop_words

    if len(job_meaningful) > 0:
        score = min(int((len(overlap) / len(job_meaningful)) * 100), 100)
    else:
        score = 0

    # Strengths (top 5 overlapping)
    overlap_freq = {}
    for w in resume_words:
        if w in overlap:
            overlap_freq[w] = overlap_freq.get(w, 0) + 1
    sorted_overlap = sorted(overlap_freq.items(), key=lambda x: x[1], reverse=True)
    strengths = [item[0] for item in sorted_overlap[:5]]
    if not strengths:
        strengths = list(overlap)[:5]

    # Missing (top 5 missing from job)
    missing = job_meaningful - resume_set
    missing_freq = {}
    for w in job_words:
        if w in missing:
            missing_freq[w] = missing_freq.get(w, 0) + 1
    sorted_missing = sorted(missing_freq.items(), key=lambda x: x[1], reverse=True)
    missing_skills = [item[0] for item in sorted_missing[:5]]
    if not missing_skills:
        missing_skills = list(missing)[:5]

    return {
        "match_score": score,
        "strengths": strengths,
        "missing_skills": missing_skills,
        "experience_match": "partial",
        "summary": "Scored via keyword matching — AI providers temporarily unavailable.",
        "provider_used": "keyword_fallback"
    }

def run_keyword_skills(resume_text: str) -> dict:
    tech_list = [
        "python", "javascript", "react", "fastapi", "sql", "postgresql", "docker", 
        "git", "aws", "typescript", "html", "css", "node.js", "mongodb", "redis", 
        "rest api", "jwt", "java", "c++", "go", "kubernetes", "django", "flask", 
        "pytorch", "tensorflow"
    ]
    soft_list = [
        "communication", "leadership", "teamwork", "problem solving", "adaptability", 
        "time management", "critical thinking", "collaboration", "negotiation", "creativity"
    ]
    tools_list = [
        "figma", "jira", "postman", "vs code", "gitlab", "github", "slack", "zoom", 
        "trello", "confluence"
    ]

    text_lower = resume_text.lower()

    technical_skills = []
    for skill in tech_list:
        if skill in ["c++", "node.js", "rest api"]:
            pattern = re.escape(skill)
        else:
            pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            if skill in ["sql", "jwt", "rest api", "aws"]:
                technical_skills.append(skill.upper())
            else:
                technical_skills.append(skill.title())

    soft_skills = []
    for skill in soft_list:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            soft_skills.append(skill.title())

    tools_and_technologies = []
    for tool in tools_list:
        if tool == "vs code":
            pattern = re.escape(tool)
        else:
            pattern = r'\b' + re.escape(tool) + r'\b'
        if re.search(pattern, text_lower):
            tools_and_technologies.append("VS Code" if tool == "vs code" else tool.title())

    return {
        "technical_skills": technical_skills,
        "soft_skills": soft_skills,
        "tools_and_technologies": tools_and_technologies,
        "certifications": [],
        "provider_used": "keyword_fallback"
    }

# 5. Core Providers Execution Loop
def generate_score(resume_text: str, job_description: str) -> dict:
    res_trunc, job_trunc = truncate_inputs(resume_text, job_description)

    # Redis Cache Check
    r = get_redis_client()
    cache_key = None
    if r:
        try:
            m = hashlib.md5()
            m.update(res_trunc[:500].encode('utf-8'))
            m.update(job_trunc[:500].encode('utf-8'))
            cache_key = f"ai_score_cache:{m.hexdigest()}"
            cached = r.get(cache_key)
            if cached:
                logger.info("Serving score from Redis cache.")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis read error: {str(e)}")

    prompt = f"""
You are an expert HR recruiter and resume screener.

Analyze this resume against the job description below.

JOB DESCRIPTION:
{job_trunc}

RESUME:
{res_trunc}

Return ONLY a JSON object, no explanation, no markdown, just raw JSON:

{{
    "match_score": <integer 0-100>,
    "strengths": ["skill1", "skill2", "skill3"],
    "missing_skills": ["skill1", "skill2"],
    "experience_match": "good or partial or poor",
    "summary": "2-3 sentence evaluation of the candidate"
}}
"""

    # --- Provider Priority Chain ---

    # 1. Gemini (With Key Rotation)
    if gemini_key_cycle and len(gemini_keys) > 0:
        logger.info("Attempting Gemini provider...")
        for i in range(len(gemini_keys)):
            key = next(gemini_key_cycle)
            try:
                client = genai.Client(api_key=key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                if response and response.text:
                    result = clean_and_parse_json(response.text)
                    result["provider_used"] = "gemini"
                    update_provider_status("gemini", "success")
                    logger.info("Gemini provider succeeded.")
                    if r and cache_key:
                        try:
                            r.set(cache_key, json.dumps(result), ex=3600)
                        except Exception:
                            pass
                    return result
            except Exception as e:
                logger.warning(f"Gemini API key rotation index {i} failed: {str(e)}")
        update_provider_status("gemini", "failed")

    # 2. Groq
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        logger.info("Attempting Groq provider...")
        try:
            client = Groq(api_key=groq_key)
            chat_completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = clean_and_parse_json(chat_completion.choices[0].message.content)
            result["provider_used"] = "groq"
            update_provider_status("groq", "success")
            logger.info("Groq provider succeeded.")
            if r and cache_key:
                try:
                    r.set(cache_key, json.dumps(result), ex=3600)
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.warning(f"Groq provider failed: {str(e)}")
            update_provider_status("groq", "failed")

    # 3. OpenRouter
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_key:
        logger.info("Attempting OpenRouter provider...")
        try:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key
            )
            chat_completion = client.chat.completions.create(
                model="mistralai/mistral-7b-instruct:free",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = clean_and_parse_json(chat_completion.choices[0].message.content)
            result["provider_used"] = "openrouter"
            update_provider_status("openrouter", "success")
            logger.info("OpenRouter provider succeeded.")
            if r and cache_key:
                try:
                    r.set(cache_key, json.dumps(result), ex=3600)
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.warning(f"OpenRouter provider failed: {str(e)}")
            update_provider_status("openrouter", "failed")

    # 4. Keyword Fallback
    logger.info("All APIs failed. Falling back to local keyword matching scoring...")
    result = run_keyword_scoring(res_trunc, job_trunc)
    update_provider_status("keyword_fallback", "available")
    return result


def generate_skills(resume_text: str) -> dict:
    res_trunc, _ = truncate_inputs(resume_text)

    # Redis Cache Check
    r = get_redis_client()
    cache_key = None
    if r:
        try:
            m = hashlib.md5()
            m.update(res_trunc[:500].encode('utf-8'))
            cache_key = f"ai_skills_cache:{m.hexdigest()}"
            cached = r.get(cache_key)
            if cached:
                logger.info("Serving skills from Redis cache.")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis read error: {str(e)}")

    prompt = f"""
You are a resume parsing engine. Extract skills from the resume text below.

Return STRICT JSON only, in this exact format, no markdown, no extra text:
{{
  "technical_skills": ["skill1", "skill2"],
  "soft_skills": ["skill1", "skill2"],
  "tools_and_technologies": ["tool1", "tool2"],
  "certifications": ["cert1"]
}}

Resume Text:
\"\"\"{res_trunc}\"\"\"
"""

    # --- Provider Priority Chain ---

    # 1. Gemini
    if gemini_key_cycle and len(gemini_keys) > 0:
        logger.info("Attempting Gemini provider for skills...")
        for i in range(len(gemini_keys)):
            key = next(gemini_key_cycle)
            try:
                client = genai.Client(api_key=key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                if response and response.text:
                    result = clean_and_parse_json(response.text)
                    result["provider_used"] = "gemini"
                    update_provider_status("gemini", "success")
                    logger.info("Gemini skills provider succeeded.")
                    if r and cache_key:
                        try:
                            r.set(cache_key, json.dumps(result), ex=3600)
                        except Exception:
                            pass
                    return result
            except Exception as e:
                logger.warning(f"Gemini API key rotation index {i} failed for skills: {str(e)}")
        update_provider_status("gemini", "failed")

    # 2. Groq
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        logger.info("Attempting Groq provider for skills...")
        try:
            client = Groq(api_key=groq_key)
            chat_completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = clean_and_parse_json(chat_completion.choices[0].message.content)
            result["provider_used"] = "groq"
            update_provider_status("groq", "success")
            logger.info("Groq skills provider succeeded.")
            if r and cache_key:
                try:
                    r.set(cache_key, json.dumps(result), ex=3600)
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.warning(f"Groq skills provider failed: {str(e)}")
            update_provider_status("groq", "failed")

    # 3. OpenRouter
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_key:
        logger.info("Attempting OpenRouter provider for skills...")
        try:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key
            )
            chat_completion = client.chat.completions.create(
                model="mistralai/mistral-7b-instruct:free",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = clean_and_parse_json(chat_completion.choices[0].message.content)
            result["provider_used"] = "openrouter"
            update_provider_status("openrouter", "success")
            logger.info("OpenRouter skills provider succeeded.")
            if r and cache_key:
                try:
                    r.set(cache_key, json.dumps(result), ex=3600)
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.warning(f"OpenRouter skills provider failed: {str(e)}")
            update_provider_status("openrouter", "failed")

    # 4. Keyword Fallback
    logger.info("All APIs failed. Falling back to local keyword matching skills extraction...")
    result = run_keyword_skills(res_trunc)
    update_provider_status("keyword_fallback", "available")
    return result
