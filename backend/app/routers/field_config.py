"""Field config CRUD endpoints."""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FieldConfig, TableConfig
from app.schemas.table_config import FieldConfigOut, FieldConfigUpdate, FieldConfigBatchUpdate
from app.utils.auth import get_current_user
from app.models import UserAccount

router = APIRouter(prefix="/api/field-config", tags=["字段配置"])


# ── List fields for a table config ──
@router.get("/{table_config_id}", response_model=List[FieldConfigOut])
def list_fields(table_config_id: int, db: Session = Depends(get_db)):
    tc = db.query(TableConfig).filter(
        TableConfig.id == table_config_id, TableConfig.is_deleted == 0
    ).first()
    if not tc:
        raise HTTPException(404, "纳管表不存在")
    fields = (
        db.query(FieldConfig)
        .filter(FieldConfig.table_config_id == table_config_id, FieldConfig.is_deleted == 0)
        .order_by(FieldConfig.field_order_no)
        .all()
    )
    return fields


# ── Get single field ──
@router.get("/detail/{field_id}", response_model=FieldConfigOut)
def get_field(field_id: int, db: Session = Depends(get_db)):
    row = db.query(FieldConfig).filter(
        FieldConfig.id == field_id, FieldConfig.is_deleted == 0
    ).first()
    if not row:
        raise HTTPException(404, "字段不存在")
    return row


# ── Update single field ──
@router.put("/{field_id}", response_model=FieldConfigOut)
def update_field(field_id: int, body: FieldConfigUpdate, db: Session = Depends(get_db)):
    row = db.query(FieldConfig).filter(
        FieldConfig.id == field_id, FieldConfig.is_deleted == 0
    ).first()
    if not row:
        raise HTTPException(404, "字段不存在")
    updates = body.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(row, k, v)
    row.updated_by = "admin"
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


# ── Batch update fields ──
@router.put("/batch/update")
def batch_update_fields(body: FieldConfigBatchUpdate, db: Session = Depends(get_db)):
    updates = body.updates.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "没有需要更新的字段")
    count = 0
    for fid in body.field_ids:
        row = db.query(FieldConfig).filter(
            FieldConfig.id == fid, FieldConfig.is_deleted == 0
        ).first()
        if row:
            for k, v in updates.items():
                setattr(row, k, v)
            row.updated_by = "admin"
            row.updated_at = datetime.utcnow()
            count += 1
    db.commit()
    return {"detail": f"已更新 {count} 个字段"}


# ── Delete field ──
@router.delete("/{field_id}")
def delete_field(field_id: int, db: Session = Depends(get_db)):
    row = db.query(FieldConfig).filter(
        FieldConfig.id == field_id, FieldConfig.is_deleted == 0
    ).first()
    if not row:
        raise HTTPException(404, "字段不存在")
    row.is_deleted = 1
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"detail": "已删除"}
