"""JWT authentication and role-based access control."""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import hashlib
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserAccount

SECRET_KEY = os.environ.get("JWT_SECRET", "data-ops-workbench-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer(auto_error=False)

_SALT = "data-ops-workbench-salt"


def hash_password(password: str) -> str:
    return hashlib.sha256(f"{_SALT}{password}".encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> UserAccount:
    """Extract current user from JWT token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="未提供认证信息")
    payload = decode_token(credentials.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token 无效")
    user = db.query(UserAccount).filter(
        UserAccount.username == username,
        UserAccount.status == "enabled",
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")
    return user


def require_role(*roles: str):
    """Dependency: require user has one of the given roles."""
    def checker(user: UserAccount = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"权限不足，需要角色: {', '.join(roles)}")
        return user
    return checker


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[UserAccount]:
    """Get user if token present, else None (for backward compat)."""
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def init_default_admin(db: Session):
    """Create default admin user if not exists."""
    existing = db.query(UserAccount).filter(UserAccount.username == "admin").first()
    if not existing:
        admin = UserAccount(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
            display_name="管理员",
            status="enabled",
        )
        db.add(admin)
        db.commit()
