"""AI configuration read/write — stored in platform.db ai_config table (singleton row)."""

import json
from typing import Optional
from sqlalchemy.orm import Session

from app.models import AIConfig
from app.utils.crypto import encrypt_password, decrypt_password


# Default feature flags (all enabled)
DEFAULT_FEATURE_FLAGS = {
    "field_suggest": True,
    "data_validate": True,
    "nl_query": True,
    "log_analyze": True,
    "batch_fill": True,
    "health_check": True,
    "impact_assess": True,
}


def get_ai_config(db: Session) -> dict:
    """Return the singleton AI config as a dict. Creates default row if missing."""
    row = db.query(AIConfig).first()
    if row is None:
        row = AIConfig(
            ai_enabled=1,
            engine_mode="builtin",
            feature_flags=json.dumps(DEFAULT_FEATURE_FLAGS),
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    return _row_to_dict(row)


def update_ai_config(db: Session, data: dict, operator: str = "system") -> dict:
    """Upsert the AI config. Returns the updated dict."""
    row = db.query(AIConfig).first()
    if row is None:
        row = AIConfig()
        db.add(row)

    # Simple scalar fields
    for field in ("ai_enabled", "engine_mode", "platform_name", "api_protocol",
                  "api_url", "model_name", "max_tokens", "temperature"):
        if field in data:
            setattr(row, field, data[field])

    # Encrypt API key if provided (non-empty)
    if "api_key" in data and data["api_key"]:
        row.api_key_encrypted = encrypt_password(data["api_key"])

    # Feature flags
    if "feature_flags" in data:
        flags = data["feature_flags"]
        if isinstance(flags, dict):
            row.feature_flags = json.dumps(flags)

    row.updated_by = operator
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def _row_to_dict(row: AIConfig) -> dict:
    """Convert AIConfig ORM row to API-safe dict (mask API key)."""
    api_key_masked = ""
    if row.api_key_encrypted:
        try:
            plain = decrypt_password(row.api_key_encrypted)
            if len(plain) > 8:
                api_key_masked = plain[:3] + "●" * (len(plain) - 6) + plain[-3:]
            else:
                api_key_masked = "●" * len(plain)
        except Exception:
            api_key_masked = "●●●●●●"

    feature_flags = DEFAULT_FEATURE_FLAGS.copy()
    if row.feature_flags:
        try:
            feature_flags.update(json.loads(row.feature_flags))
        except Exception:
            pass

    return {
        "ai_enabled": bool(row.ai_enabled),
        "engine_mode": row.engine_mode or "builtin",
        "platform_name": row.platform_name or "",
        "api_protocol": row.api_protocol or "openai",
        "api_url": row.api_url or "",
        "api_key_set": bool(row.api_key_encrypted),
        "api_key_masked": api_key_masked,
        "model_name": row.model_name or "",
        "max_tokens": row.max_tokens or 4096,
        "temperature": row.temperature if row.temperature is not None else 0.3,
        "feature_flags": feature_flags,
    }
