"""Authentication endpoints: login, me, captcha."""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserAccount
from app.utils.auth import verify_password, create_access_token, get_current_user
from app.utils.captcha import generate_captcha, verify_captcha

router = APIRouter(prefix="/api/auth", tags=["认证"])


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


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha():
    """Generate a captcha image for login."""
    captcha_id, _code, b64_image = generate_captcha()
    return CaptchaResponse(captcha_id=captcha_id, image=b64_image)


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Verify captcha first
    if not req.captcha_id or not req.captcha_code:
        raise HTTPException(status_code=400, detail="请输入验证码")
    if not verify_captcha(req.captcha_id, req.captcha_code):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    user = db.query(UserAccount).filter(
        UserAccount.username == req.username,
        UserAccount.status == "enabled",
    ).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
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
