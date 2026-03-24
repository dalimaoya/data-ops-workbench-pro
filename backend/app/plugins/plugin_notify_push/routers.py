"""External Notification Push — 企业微信/钉钉/邮件推送"""

import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db, engine, Base
from app.models import UserAccount
from app.utils.auth import get_current_user, require_role
from app.utils.crypto import encrypt_password, decrypt_password
from sqlalchemy import Column, Integer, String, Text, DateTime, SmallInteger
from datetime import datetime, timezone, timedelta

_BJT = timezone(timedelta(hours=8))


def _now_bjt():
    return datetime.now(_BJT)


class NotifyPushConfig(Base):
    __tablename__ = "notify_push_config"
    id = Column(Integer, primary_key=True, autoincrement=True)
    wechat_work_webhook = Column(String(500), nullable=True)
    dingtalk_webhook = Column(String(500), nullable=True)
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True, default=465)
    smtp_username = Column(String(128), nullable=True)
    smtp_password_encrypted = Column(Text, nullable=True)
    smtp_from_email = Column(String(255), nullable=True)
    smtp_to_emails = Column(Text, nullable=True)  # comma separated
    smtp_use_ssl = Column(SmallInteger, nullable=False, default=1)
    notify_on_writeback = Column(SmallInteger, nullable=False, default=1)
    notify_on_approval = Column(SmallInteger, nullable=False, default=1)
    notify_on_health_error = Column(SmallInteger, nullable=False, default=1)
    notify_on_task_fail = Column(SmallInteger, nullable=False, default=1)
    updated_by = Column(String(64), nullable=False, default="system")
    updated_at = Column(DateTime, nullable=False, default=_now_bjt, onupdate=_now_bjt)


# Create table on import
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/api/notify-push", tags=["notify-push"])


class ConfigUpdate(BaseModel):
    wechat_work_webhook: Optional[str] = None
    dingtalk_webhook: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 465
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_to_emails: Optional[str] = None
    smtp_use_ssl: bool = True
    notify_on_writeback: bool = True
    notify_on_approval: bool = True
    notify_on_health_error: bool = True
    notify_on_task_fail: bool = True


@router.get("/config")
def get_config(db: Session = Depends(get_db), user: UserAccount = Depends(require_role("admin"))):
    cfg = db.query(NotifyPushConfig).first()
    if not cfg:
        return {"config": None}
    return {
        "config": {
            "wechat_work_webhook": cfg.wechat_work_webhook or "",
            "dingtalk_webhook": cfg.dingtalk_webhook or "",
            "smtp_host": cfg.smtp_host or "",
            "smtp_port": cfg.smtp_port or 465,
            "smtp_username": cfg.smtp_username or "",
            "smtp_from_email": cfg.smtp_from_email or "",
            "smtp_to_emails": cfg.smtp_to_emails or "",
            "smtp_use_ssl": bool(cfg.smtp_use_ssl),
            "notify_on_writeback": bool(cfg.notify_on_writeback),
            "notify_on_approval": bool(cfg.notify_on_approval),
            "notify_on_health_error": bool(cfg.notify_on_health_error),
            "notify_on_task_fail": bool(cfg.notify_on_task_fail),
        }
    }


@router.put("/config")
def update_config(body: ConfigUpdate, db: Session = Depends(get_db), user: UserAccount = Depends(require_role("admin"))):
    cfg = db.query(NotifyPushConfig).first()
    if not cfg:
        cfg = NotifyPushConfig()
        db.add(cfg)
    cfg.wechat_work_webhook = body.wechat_work_webhook
    cfg.dingtalk_webhook = body.dingtalk_webhook
    cfg.smtp_host = body.smtp_host
    cfg.smtp_port = body.smtp_port
    cfg.smtp_username = body.smtp_username
    if body.smtp_password:
        cfg.smtp_password_encrypted = encrypt_password(body.smtp_password)
    cfg.smtp_from_email = body.smtp_from_email
    cfg.smtp_to_emails = body.smtp_to_emails
    cfg.smtp_use_ssl = 1 if body.smtp_use_ssl else 0
    cfg.notify_on_writeback = 1 if body.notify_on_writeback else 0
    cfg.notify_on_approval = 1 if body.notify_on_approval else 0
    cfg.notify_on_health_error = 1 if body.notify_on_health_error else 0
    cfg.notify_on_task_fail = 1 if body.notify_on_task_fail else 0
    cfg.updated_by = user.username
    db.commit()
    return {"success": True}


class TestMessage(BaseModel):
    channel: str = "all"  # wechat/dingtalk/email/all
    message: str = "这是一条测试消息 / This is a test message"


def _send_wechat(webhook: str, message: str) -> dict:
    try:
        resp = httpx.post(webhook, json={"msgtype": "text", "text": {"content": f"[数据运维工作台] {message}"}}, timeout=10)
        return {"channel": "wechat", "success": resp.status_code == 200, "detail": resp.text[:200]}
    except Exception as e:
        return {"channel": "wechat", "success": False, "detail": str(e)}


def _send_dingtalk(webhook: str, message: str) -> dict:
    try:
        resp = httpx.post(webhook, json={"msgtype": "text", "text": {"content": f"[数据运维工作台] {message}"}}, timeout=10)
        return {"channel": "dingtalk", "success": resp.status_code == 200, "detail": resp.text[:200]}
    except Exception as e:
        return {"channel": "dingtalk", "success": False, "detail": str(e)}


def _send_email(cfg: NotifyPushConfig, subject: str, body_text: str) -> dict:
    try:
        pwd = decrypt_password(cfg.smtp_password_encrypted) if cfg.smtp_password_encrypted else ""
        msg = MIMEMultipart()
        msg["From"] = cfg.smtp_from_email or cfg.smtp_username or ""
        to_list = [e.strip() for e in (cfg.smtp_to_emails or "").split(",") if e.strip()]
        if not to_list:
            return {"channel": "email", "success": False, "detail": "No recipients configured"}
        msg["To"] = ", ".join(to_list)
        msg["Subject"] = subject
        msg.attach(MIMEText(body_text, "plain", "utf-8"))

        if cfg.smtp_use_ssl:
            server = smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port or 465, timeout=10)
        else:
            server = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port or 25, timeout=10)
            server.starttls()
        server.login(cfg.smtp_username or "", pwd)
        server.sendmail(msg["From"], to_list, msg.as_string())
        server.quit()
        return {"channel": "email", "success": True, "detail": f"Sent to {len(to_list)} recipients"}
    except Exception as e:
        return {"channel": "email", "success": False, "detail": str(e)}


def send_notification(event_type: str, message: str):
    """Send notification to all configured channels. Call from other modules."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        cfg = db.query(NotifyPushConfig).first()
        if not cfg:
            return
        # Check event type flags
        flag_map = {
            "writeback": cfg.notify_on_writeback,
            "approval": cfg.notify_on_approval,
            "health_error": cfg.notify_on_health_error,
            "task_fail": cfg.notify_on_task_fail,
        }
        if not flag_map.get(event_type, 1):
            return
        if cfg.wechat_work_webhook:
            _send_wechat(cfg.wechat_work_webhook, message)
        if cfg.dingtalk_webhook:
            _send_dingtalk(cfg.dingtalk_webhook, message)
        if cfg.smtp_host and cfg.smtp_to_emails:
            _send_email(cfg, f"[数据运维工作台] {event_type}", message)
    finally:
        db.close()


@router.post("/test")
def test_notification(body: TestMessage, db: Session = Depends(get_db), user: UserAccount = Depends(require_role("admin"))):
    cfg = db.query(NotifyPushConfig).first()
    if not cfg:
        raise HTTPException(400, "请先配置通知推送")
    results = []
    if body.channel in ("all", "wechat") and cfg.wechat_work_webhook:
        results.append(_send_wechat(cfg.wechat_work_webhook, body.message))
    if body.channel in ("all", "dingtalk") and cfg.dingtalk_webhook:
        results.append(_send_dingtalk(cfg.dingtalk_webhook, body.message))
    if body.channel in ("all", "email") and cfg.smtp_host:
        results.append(_send_email(cfg, "[测试] 数据运维工作台通知", body.message))
    if not results:
        raise HTTPException(400, "没有可用的通知渠道")
    return {"results": results}
