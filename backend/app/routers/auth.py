"""Authentication endpoints: login, me, captcha, lockout management."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserAccount
from app.utils.auth import (
    verify_password, create_access_token, get_current_user,
    hash_password, needs_password_migration, require_role,
)
from app.utils.captcha import generate_captcha, verify_captcha
from app.utils.security_middleware import (
    login_lockout, check_rate_limit,
)
from app.i18n import t
from app.services.unified_auth import (
    AUTH_PLATFORM_BASE_URL,
    PUBLIC_KEY_CACHE_PATH,
    UnifiedAuthError,
    build_wechat_redirect_url,
    verify_token_online,
    check_plugin_license,
    download_public_key,
    verify_token_offline,
)

router = APIRouter(prefix="/api/auth", tags=["认证"])
bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str
    captcha_id: Optional[str] = None
    captcha_code: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    username: str
    role: str
    display_name: Optional[str]


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    display_name: Optional[str]
    status: str


class CaptchaResponse(BaseModel):
    captcha_id: str
    image: str  # base64 png


class UnifiedAuthRedirectResponse(BaseModel):
    redirect_url: str


@router.get("/wechat/redirect-url", response_model=UnifiedAuthRedirectResponse)
async def get_wechat_redirect_url(request: Request):
    callback_url = f"{request.base_url}auth/callback"
    redirect_url = await build_wechat_redirect_url(callback_url)
    return UnifiedAuthRedirectResponse(redirect_url=redirect_url)


class WechatQRParams(BaseModel):
    appid: str
    redirect_uri: str
    state: str
    scope: str = "snsapi_login"


@router.get("/wechat/qr-params")
async def get_wechat_qr_params(request: Request):
    """Return params for embedding WeChat QR login via WxLogin JS SDK."""
    callback_url = f"{request.base_url}auth/callback"
    redirect_url = await build_wechat_redirect_url(callback_url)
    # Parse state from the redirect URL returned by auth platform
    from urllib.parse import urlparse, parse_qs
    parsed = urlparse(redirect_url)
    qs = parse_qs(parsed.query)
    state = qs.get("state", [""])[0]
    appid = qs.get("appid", [""])[0]
    redirect_uri = qs.get("redirect_uri", [""])[0]
    return WechatQRParams(appid=appid, redirect_uri=redirect_uri, state=state)


@router.get("/network-check")
async def network_check():
    """Check if the unified auth platform is reachable."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.head(f"{AUTH_PLATFORM_BASE_URL}/api/auth/verify")
            return {"online": resp.status_code in (200, 401, 403)}
    except Exception:
        return {"online": False}


@router.get("/check-update")
async def check_update():
    """Check for new version from Gitee releases. Manual trigger only."""
    import httpx
    import os

    current_version = "0.0.0"
    version_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "version.txt")
    if os.path.exists(version_file):
        with open(version_file) as f:
            current_version = f.read().strip()

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://gitee.com/api/v5/repos/dalimaoya/data-ops-workbench/releases/latest"
            )
            if resp.status_code == 200:
                data = resp.json()
                latest_version = (data.get("tag_name") or "").lstrip("v")
                return {
                    "current_version": current_version,
                    "latest_version": latest_version,
                    "has_update": latest_version > current_version if latest_version else False,
                    "release_name": data.get("name"),
                    "release_url": data.get("html_url"),
                    "release_body": data.get("body", "")[:500],
                    "published_at": data.get("created_at"),
                }
            return {
                "current_version": current_version,
                "latest_version": None,
                "has_update": False,
                "error": "无法获取版本信息",
            }
    except Exception as e:
        return {
            "current_version": current_version,
            "latest_version": None,
            "has_update": False,
            "error": f"网络不可用：{str(e)[:100]}",
        }


@router.get("/verify")
async def remote_verify(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not credentials:
        raise HTTPException(status_code=401, detail="缺少 token")
    return await verify_token_online(credentials.credentials)


@router.get("/offline-verify")
async def offline_verify(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not credentials:
        raise HTTPException(status_code=401, detail="缺少 token")
    return await verify_token_offline(credentials.credentials)


@router.post("/public-key/refresh")
async def refresh_public_key():
    key = await download_public_key(force=True)
    return {"cached": True, "path": PUBLIC_KEY_CACHE_PATH, "length": len(key)}


@router.get("/platform-config")
def get_unified_auth_platform_config(request: Request):
    return {
        "provider": "auth-platform",
        "base_url": AUTH_PLATFORM_BASE_URL,
        "callback_url": f"{request.base_url}auth/callback",
        "public_key_cache_path": PUBLIC_KEY_CACHE_PATH,
    }


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha(request: Request):
    """Generate a captcha image for login."""
    # Rate limit captcha generation
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit("captcha", client_ip):
        raise HTTPException(status_code=429, detail=t("auth.rate_limited"))
    
    captcha_id, _code, b64_image = generate_captcha()
    return CaptchaResponse(captcha_id=captcha_id, image=b64_image)


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # Rate limit login attempts by IP
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit("login", client_ip):
        raise HTTPException(status_code=429, detail=t("auth.rate_limited"))
    
    # Verify captcha first
    if not req.captcha_id or not req.captcha_code:
        raise HTTPException(status_code=400, detail=t("auth.captcha_required"))
    if not verify_captcha(req.captcha_id, req.captcha_code):
        raise HTTPException(status_code=400, detail=t("auth.captcha_invalid"))
    
    # Check if account is locked
    if login_lockout.is_locked(req.username):
        lock_info = login_lockout.get_lock_info(req.username)
        raise HTTPException(
            status_code=403,
            detail=t("auth.account_locked", minutes=lock_info.get("remaining_seconds", 900) // 60 + 1),
        )

    user = db.query(UserAccount).filter(
        UserAccount.username == req.username,
        UserAccount.status == "enabled",
    ).first()
    
    if not user or not verify_password(req.password, user.password_hash):
        # Record failure
        remaining = login_lockout.record_failure(req.username)
        if remaining == 0:
            raise HTTPException(
                status_code=403,
                detail=t("auth.account_locked", minutes=15),
            )
        raise HTTPException(
            status_code=401,
            detail=t("auth.credentials_invalid"),
        )
    
    # Successful login - reset lockout counter
    login_lockout.reset(req.username)
    
    # Auto-migrate legacy password hash to bcrypt
    if needs_password_migration(user.password_hash):
        user.password_hash = hash_password(req.password)
    
    # v3.6: Record last login time
    from app.models import _now_bjt
    user.last_login_at = _now_bjt()
    db.commit()
    
    token = create_access_token({"sub": user.username, "role": user.role})
    return LoginResponse(
        token=token,
        username=user.username,
        role=user.role,
        display_name=user.display_name,
    )


@router.get("/me", response_model=UserInfo)
def get_me(user: UserAccount = Depends(get_current_user)):
    return UserInfo(
        id=user.id,
        username=user.username,
        role=user.role,
        display_name=user.display_name,
        status=user.status,
    )


# ─────────────────────────────────────────────
# Login Lockout Management (admin only)
# ─────────────────────────────────────────────

@router.get("/lockout/{username}")
def get_lockout_status(
    username: str,
    user: UserAccount = Depends(require_role("admin")),
):
    """Get lock status for a user account."""
    info = login_lockout.get_lock_info(username)
    return info


@router.post("/lockout/{username}/unlock")
def unlock_account(
    username: str,
    user: UserAccount = Depends(require_role("admin")),
):
    """Manually unlock a locked account."""
    login_lockout.unlock(username)
    return {"detail": f"账号 {username} 已解锁"}
