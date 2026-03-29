"""Activation code endpoints: activate plugin, list records."""

import json
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, DATA_DIR
from app.models import ActivationRecord, TrialActivation, _now_bjt
from app.i18n import t

router = APIRouter(prefix="/api/activation", tags=["激活码"])

# ── Ed25519 public key path ─────────────────────────────────────
ACTIVATION_PUBLIC_KEY_PATH = os.path.join(DATA_DIR, "activation_public.pem")

# Lazy-loaded public key
_public_key_cache: Optional[bytes] = None


def _load_public_key() -> Optional[bytes]:
    global _public_key_cache
    if _public_key_cache is not None:
        return _public_key_cache
    if os.path.exists(ACTIVATION_PUBLIC_KEY_PATH):
        with open(ACTIVATION_PUBLIC_KEY_PATH, "rb") as f:
            _public_key_cache = f.read()
        return _public_key_cache
    return None


def _verify_activation_code(payload: dict) -> bool:
    """Verify Ed25519 signature of activation code payload.
    Returns True if signature is valid against the stored public key."""
    public_key_bytes = _load_public_key()
    if not public_key_bytes:
        # No public key available — cannot verify
        return False

    signature_b64 = payload.get("signature")
    if not signature_b64:
        return False

    try:
        import base64
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        from cryptography.hazmat.primitives.serialization import load_pem_public_key

        public_key = load_pem_public_key(public_key_bytes)
        if not isinstance(public_key, Ed25519PublicKey):
            return False

        signature = base64.b64decode(signature_b64)

        # Reconstruct signed data in the exact field order used by the auth platform (Node.js JSON.stringify)
        signed_data = {
            "code": payload.get("code"),
            "product": payload.get("product"),
            "plugin_keys": payload.get("plugin_keys"),
            "expires_at": payload.get("expires_at"),
            "created_at": payload.get("created_at"),
            "batch_no": payload.get("batch_no"),
        }
        message = json.dumps(signed_data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

        public_key.verify(signature, message)
        return True
    except Exception:
        return False


def _ensure_trial_on_activation(db: Session) -> None:
    """Create a 30-day trial if none exists, triggered by activation code."""
    from app.models import TrialActivation, _now_bjt
    from datetime import timedelta
    try:
        now = _now_bjt()
        now_naive = now.replace(tzinfo=None)
        existing = db.query(TrialActivation).filter(
            TrialActivation.expires_at > now_naive
        ).first()
        if not existing:
            trial = TrialActivation(
                activation_type="activation_code",
                activated_at=now_naive,
                expires_at=now_naive + timedelta(days=30),
            )
            db.add(trial)
            db.commit()
    except Exception:
        pass


# ── Request / Response models ────────────────────────────────────

class ActivateRequest(BaseModel):
    code: str
    product: str
    plugin_keys: list[str]
    expires_at: Optional[str] = None  # ISO datetime or null
    created_at: Optional[str] = None
    batch_no: Optional[str] = None
    signature: str


class ActivateResponse(BaseModel):
    success: bool
    message: str
    plugin_keys: list[str] = []
    expires_at: Optional[str] = None


class ActivationRecordResponse(BaseModel):
    id: int
    code: str
    product: str
    plugin_keys: list[str]
    expires_at: Optional[str] = None
    activated_at: str


def _ensure_trial_on_activation(db: Session) -> None:
    """Create a 30-day trial activation on first activation code use, if none exists."""
    from datetime import timedelta
    try:
        now = _now_bjt()
        now_naive = now.replace(tzinfo=None)
        existing = db.query(TrialActivation).filter(
            TrialActivation.expires_at > now_naive
        ).first()
        if not existing:
            trial = TrialActivation(
                activation_type="activation_code",
                activated_at=now_naive,
                expires_at=now_naive + timedelta(days=30),
                account_id=None,
            )
            db.add(trial)
            db.commit()
    except Exception:
        pass


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/activate", response_model=ActivateResponse)
def activate(req: ActivateRequest, db: Session = Depends(get_db)):
    """Verify and activate an activation code."""

    # 1. Check format
    if not req.code.startswith("ACT:"):
        raise HTTPException(status_code=400, detail="激活码格式无效，应以 ACT: 开头")

    # 2. Check duplicate
    existing = db.query(ActivationRecord).filter(ActivationRecord.code == req.code).first()
    if existing:
        raise HTTPException(status_code=409, detail="该激活码已被使用")

    # 3. Check product match
    if req.product != "data-ops-workbench":
        raise HTTPException(status_code=400, detail="激活码产品不匹配")

    # 4. Verify Ed25519 signature
    payload = req.model_dump()
    if not _verify_activation_code(payload):
        raise HTTPException(status_code=400, detail="激活码签名验证失败")

    # 5. Check expiration
    expires_dt = None
    if req.expires_at:
        try:
            expires_dt = datetime.fromisoformat(req.expires_at.replace("Z", "+00:00"))
            if expires_dt < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="激活码已过期")
        except ValueError:
            raise HTTPException(status_code=400, detail="激活码到期时间格式无效")

    # 6. Write activation record
    record = ActivationRecord(
        code=req.code,
        product=req.product,
        plugin_keys=json.dumps(req.plugin_keys),
        expires_at=expires_dt,
        signature=req.signature,
    )
    db.add(record)
    db.commit()

    # 7. Trigger trial activation on first activation code
    _ensure_trial_on_activation(db)

    return ActivateResponse(
        success=True,
        message="激活成功",
        plugin_keys=req.plugin_keys,
        expires_at=req.expires_at,
    )


@router.get("/records", response_model=list[ActivationRecordResponse])
def list_records(db: Session = Depends(get_db)):
    """List all activation records."""
    records = db.query(ActivationRecord).order_by(ActivationRecord.activated_at.desc()).all()
    result = []
    for r in records:
        try:
            plugin_keys = json.loads(r.plugin_keys)
        except Exception:
            plugin_keys = []
        result.append(ActivationRecordResponse(
            id=r.id,
            code=r.code,
            product=r.product,
            plugin_keys=plugin_keys,
            expires_at=r.expires_at.isoformat() if r.expires_at else None,
            activated_at=r.activated_at.isoformat() if r.activated_at else "",
        ))
    return result
