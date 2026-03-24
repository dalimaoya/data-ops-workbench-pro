"""AI configuration API routes — GET/PUT config, POST test connection, validate config."""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.utils.auth import get_current_user, require_role
from app.ai.ai_config import get_ai_config, update_ai_config
from app.ai.ai_client import AIClient
from app.utils.crypto import decrypt_password
from app.models import AIConfig, SystemSetting

router = APIRouter(prefix="/api/ai", tags=["AI Configuration"])


# ── Schemas ──

class AIConfigUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    engine_mode: Optional[str] = None
    platform_name: Optional[str] = None
    api_protocol: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None  # plain text, will be encrypted
    model_name: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    feature_flags: Optional[dict] = None


class AITestRequest(BaseModel):
    api_protocol: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    max_tokens: Optional[int] = 4096
    temperature: Optional[float] = 0.3


class AIValidateConfigUpdate(BaseModel):
    outlier_range: Optional[str] = None       # p1_p99 / p5_p95 / p10_p90
    history_sample_size: Optional[int] = None  # default 1000
    warning_behavior: Optional[str] = None     # warn / block
    skip_fields: Optional[List[str]] = None


# ── Endpoints ──

@router.get("/config")
def get_config(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get current AI configuration (any authenticated user can read)."""
    return get_ai_config(db)


@router.put("/config")
def put_config(
    body: AIConfigUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Update AI configuration (admin only)."""
    data = body.model_dump(exclude_none=True)
    # Convert bool → int for ai_enabled
    if "ai_enabled" in data:
        data["ai_enabled"] = 1 if data["ai_enabled"] else 0
    return update_ai_config(db, data, operator=current_user.username)


@router.post("/config/test")
async def test_connection(
    body: AITestRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Test LLM connection. Accepts explicit params or falls back to stored config."""
    # Determine connection params
    api_url = body.api_url
    api_key = body.api_key
    model_name = body.model_name
    api_protocol = body.api_protocol or "openai"

    # If api_key not provided, try to use stored one
    if not api_key:
        row = db.query(AIConfig).first()
        if row and row.api_key_encrypted:
            try:
                api_key = decrypt_password(row.api_key_encrypted)
            except Exception:
                pass

    # If api_url not provided, use stored
    if not api_url:
        row = db.query(AIConfig).first()
        if row:
            api_url = row.api_url
            if not model_name:
                model_name = row.model_name
            if not body.api_protocol:
                api_protocol = row.api_protocol or "openai"

    if not api_url or not api_key or not model_name:
        raise HTTPException(status_code=400, detail="请提供 API 地址、API Key 和模型名称")

    client = AIClient(
        api_url=api_url,
        api_key=api_key,
        model_name=model_name,
        api_protocol=api_protocol,
        max_tokens=body.max_tokens or 4096,
        temperature=body.temperature or 0.3,
        timeout=15.0,
    )
    result = await client.test_connection()
    return result


# ── AI Validate Config Endpoints ──

@router.get("/validate-config")
def get_validate_config(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get AI validation configuration."""
    from app.routers.ai_validate import DEFAULT_VALIDATE_CONFIG
    config = DEFAULT_VALIDATE_CONFIG.copy()

    for key in ("outlier_range", "history_sample_size", "warning_behavior", "skip_fields"):
        full_key = f"ai_validate_{key}"
        row = db.query(SystemSetting).filter(SystemSetting.setting_key == full_key).first()
        if row:
            if key == "history_sample_size":
                try:
                    config[key] = int(row.setting_value)
                except ValueError:
                    pass
            elif key == "skip_fields":
                try:
                    config[key] = json.loads(row.setting_value)
                except (json.JSONDecodeError, TypeError):
                    config[key] = [s.strip() for s in row.setting_value.split(",") if s.strip()]
            else:
                config[key] = row.setting_value

    return config


@router.put("/validate-config")
def put_validate_config(
    body: AIValidateConfigUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Update AI validation configuration (admin only)."""
    from app.models import _now_bjt

    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        full_key = f"ai_validate_{key}"
        row = db.query(SystemSetting).filter(SystemSetting.setting_key == full_key).first()

        if key == "skip_fields":
            store_value = json.dumps(value, ensure_ascii=False)
        elif key == "history_sample_size":
            store_value = str(value)
        else:
            store_value = str(value)

        if row:
            row.setting_value = store_value
            row.updated_at = _now_bjt()
        else:
            row = SystemSetting(setting_key=full_key, setting_value=store_value)
            db.add(row)

    db.commit()
    return get_validate_config(db=db, current_user=current_user)
