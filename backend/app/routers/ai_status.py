from fastapi import APIRouter, Depends
import os
import json
from app.utils.security import require_role
from app.services.ai_provider import get_redis_client, gemini_keys

router = APIRouter()

@router.get("/provider-status")
def get_ai_provider_status(
    payload: dict = Depends(require_role("recruiter"))
):
    r = get_redis_client()
    
    # 1. Define configured states
    providers_config = {
        "gemini": bool(gemini_keys),
        "groq": bool(os.getenv("GROQ_API_KEY")),
        "openrouter": bool(os.getenv("OPENROUTER_API_KEY")),
        "keyword_fallback": True
    }
    
    status_data = {}
    
    # 2. Retrieve last status from Redis
    for provider in ["gemini", "groq", "openrouter", "keyword_fallback"]:
        last_status = None
        last_used = None
        
        if r:
            try:
                raw = r.get(f"ai_provider_status:{provider}")
                if raw:
                    parsed = json.loads(raw)
                    last_status = parsed.get("status")
                    last_used = parsed.get("timestamp")
            except Exception:
                pass
                
        # Fill default availability if no record in Redis yet
        if not last_status:
            if provider == "keyword_fallback":
                last_status = "available"
            elif providers_config[provider]:
                last_status = "configured"
            else:
                last_status = None
                
        status_data[provider] = {
            "configured": providers_config[provider],
            "last_status": last_status,
            "last_used": last_used
        }
        
    # 3. Determine active provider based on priorities
    active_provider = "keyword_fallback"
    if status_data["gemini"]["configured"] and status_data["gemini"]["last_status"] != "failed":
        active_provider = "gemini"
    elif status_data["groq"]["configured"] and status_data["groq"]["last_status"] != "failed":
        active_provider = "groq"
    elif status_data["openrouter"]["configured"] and status_data["openrouter"]["last_status"] != "failed":
        active_provider = "openrouter"
        
    return {
        "providers": status_data,
        "active_provider": active_provider
    }
