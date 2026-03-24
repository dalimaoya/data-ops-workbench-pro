"""Pluggable AI engine dispatcher — routes requests to rules engine or LLM adapter."""

from typing import Optional
from sqlalchemy.orm import Session

from app.ai.ai_config import get_ai_config
from app.ai.ai_client import AIClient
from app.ai.rules_engine import suggest_semantic_name, is_system_field, is_readonly_field
from app.utils.crypto import decrypt_password
from app.models import AIConfig


class AIEngine:
    """Facade that routes AI calls to the appropriate backend based on config."""

    def __init__(self, db: Session):
        self.db = db
        self._config: Optional[dict] = None

    @property
    def config(self) -> dict:
        if self._config is None:
            self._config = get_ai_config(self.db)
        return self._config

    @property
    def is_enabled(self) -> bool:
        return self.config.get("ai_enabled", False)

    @property
    def engine_mode(self) -> str:
        return self.config.get("engine_mode", "builtin")

    def is_feature_enabled(self, feature_key: str) -> bool:
        """Check if a specific AI feature is enabled."""
        if not self.is_enabled:
            return False
        flags = self.config.get("feature_flags", {})
        return flags.get(feature_key, False)

    def get_llm_client(self) -> Optional[AIClient]:
        """Build an AIClient from current config. Returns None if cloud mode not configured."""
        if self.engine_mode != "cloud":
            return None
        row = self.db.query(AIConfig).first()
        if not row or not row.api_key_encrypted or not row.api_url:
            return None
        try:
            api_key = decrypt_password(row.api_key_encrypted)
        except Exception:
            return None
        return AIClient(
            api_url=row.api_url,
            api_key=api_key,
            model_name=row.model_name or "",
            api_protocol=row.api_protocol or "openai",
            max_tokens=row.max_tokens or 4096,
            temperature=row.temperature if row.temperature is not None else 0.3,
        )

    # ── High-level helpers (to be extended per feature) ──

    def suggest_field_name(self, field_name: str) -> Optional[str]:
        """Rules-based field name suggestion (always available)."""
        return suggest_semantic_name(field_name)

    def check_system_field(self, field_name: str) -> bool:
        return is_system_field(field_name)

    def check_readonly_field(self, field_name: str) -> bool:
        return is_readonly_field(field_name)
