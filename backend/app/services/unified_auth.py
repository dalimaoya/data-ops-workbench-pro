from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import HTTPException
from jose import jwt, JWTError

AUTH_PLATFORM_BASE_URL = os.environ.get(
    "AUTH_PLATFORM_BASE_URL",
    "https://auth.aiusing.net",
).rstrip("/")
AUTH_PUBLIC_KEY_URL = f"{AUTH_PLATFORM_BASE_URL}/public/keys/jwt_public.pem"
PUBLIC_KEY_CACHE_PATH = os.path.join(
    os.environ.get(
        "DATA_OPS_DATA_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data"),
    ),
    "auth",
    "jwt_public.pem",
)
AUTH_HTTP_TIMEOUT = float(os.environ.get("AUTH_PLATFORM_TIMEOUT", "8"))


class UnifiedAuthError(HTTPException):
    pass


def _ensure_cache_dir() -> None:
    os.makedirs(os.path.dirname(PUBLIC_KEY_CACHE_PATH), exist_ok=True)


async def build_wechat_redirect_url(redirect_uri: str) -> str:
    async with httpx.AsyncClient(timeout=AUTH_HTTP_TIMEOUT, follow_redirects=False) as client:
        response = await client.get(
            f"{AUTH_PLATFORM_BASE_URL}/api/auth/wechat/redirect",
            params={"redirect_uri": redirect_uri},
        )

    if response.status_code in (301, 302, 303, 307, 308):
        location = response.headers.get("location")
        if not location:
            raise UnifiedAuthError(status_code=502, detail="认证服务未返回跳转地址")
        return location

    if response.is_success:
        try:
            payload = response.json()
        except Exception:
            payload = None
        if isinstance(payload, dict):
            return payload.get("redirect_url") or payload.get("url") or response.text
        return response.text

    raise UnifiedAuthError(status_code=502, detail="认证服务跳转地址获取失败")


async def verify_token_online(token: str) -> dict:
    async with httpx.AsyncClient(timeout=AUTH_HTTP_TIMEOUT) as client:
        response = await client.get(
            f"{AUTH_PLATFORM_BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code == 401:
        raise UnifiedAuthError(status_code=401, detail="登录状态已失效，请重新登录")
    if not response.is_success:
        raise UnifiedAuthError(status_code=503, detail="认证服务暂时不可用，请稍后重试")

    data = response.json()
    if not data.get("valid"):
        raise UnifiedAuthError(status_code=401, detail="登录状态已失效，请重新登录")
    return data


async def check_plugin_license(token: str, plugin: str) -> dict:
    remote_plugin = plugin.replace('-', '_')
    async with httpx.AsyncClient(timeout=AUTH_HTTP_TIMEOUT) as client:
        response = await client.get(
            f"{AUTH_PLATFORM_BASE_URL}/api/license/check",
            params={"plugin": remote_plugin},
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code == 401:
        raise UnifiedAuthError(status_code=401, detail="登录状态已失效，请重新登录")
    if not response.is_success:
        raise UnifiedAuthError(status_code=503, detail="插件授权服务暂时不可用，请稍后重试")
    return response.json()


async def download_public_key(force: bool = False) -> str:
    if os.path.exists(PUBLIC_KEY_CACHE_PATH) and not force:
        return load_cached_public_key()

    async with httpx.AsyncClient(timeout=AUTH_HTTP_TIMEOUT) as client:
        response = await client.get(AUTH_PUBLIC_KEY_URL)

    if not response.is_success:
        raise UnifiedAuthError(status_code=503, detail="公钥获取失败，暂无法完成本地校验")

    content = response.text.strip()
    if "BEGIN PUBLIC KEY" not in content:
        raise UnifiedAuthError(status_code=503, detail="认证公钥格式无效")

    _ensure_cache_dir()
    with open(PUBLIC_KEY_CACHE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    return content


def load_cached_public_key() -> str:
    if not os.path.exists(PUBLIC_KEY_CACHE_PATH):
        raise UnifiedAuthError(status_code=404, detail="本地尚未缓存认证公钥")
    with open(PUBLIC_KEY_CACHE_PATH, "r", encoding="utf-8") as f:
        return f.read().strip()


def _to_utc_iso(value: Optional[object]) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)


async def verify_token_offline(token: str, refresh_key_if_missing: bool = True) -> dict:
    try:
        public_key = load_cached_public_key()
    except UnifiedAuthError:
        if not refresh_key_if_missing:
            raise
        public_key = await download_public_key(force=False)

    try:
        payload = jwt.decode(token, public_key, algorithms=["RS256"], audience="data-ops-workbench")
    except JWTError:
        raise UnifiedAuthError(status_code=401, detail="登录状态已失效，请重新登录")

    exp = payload.get("exp")
    account_id = payload.get("account_id") or payload.get("sub") or payload.get("openid") or payload.get("user_id")
    if not account_id:
        raise UnifiedAuthError(status_code=401, detail="token 缺少 account_id")

    return {
        "valid": True,
        "account_id": str(account_id),
        "expires_at": _to_utc_iso(exp),
        "mode": "offline",
        "claims": payload,
    }
