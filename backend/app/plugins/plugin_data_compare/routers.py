"""Cross-DB Data Compare — 跨库数据对比"""

import io
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Text, DateTime
from pydantic import BaseModel

from app.database import get_db, engine, Base
from app.models import DatasourceConfig, UserAccount
from app.utils.auth import get_current_user, require_role
from app.utils.crypto import decrypt_password
from app.utils.remote_db import _connect, list_columns
from app.utils.audit import log_operation

_BJT = timezone(timedelta(hours=8))


def _now_bjt():
    return datetime.now(_BJT)


class DataCompareResult(Base):
    __tablename__ = "data_compare_result"
    id = Column(Integer, primary_key=True, autoincrement=True)
    compare_id = Column(String(64), nullable=False, unique=True, index=True)
    source_ds_id = Column(Integer, nullable=False)
    source_table = Column(String(128), nullable=False)
    target_ds_id = Column(Integer, nullable=False)
    target_table = Column(String(128), nullable=False)
    matched_fields = Column(Text, nullable=True)  # JSON
    result_json = Column(Text, nullable=True)  # JSON summary
    status = Column(String(32), nullable=False, default="running")
    operator_user = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False, default=_now_bjt)


Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/api/data-compare", tags=["data-compare"])


class CompareRequest(BaseModel):
    source_ds_id: int
    source_table: str
    source_db_name: Optional[str] = None
    source_schema: Optional[str] = None
    target_ds_id: int
    target_table: str
    target_db_name: Optional[str] = None
    target_schema: Optional[str] = None
    key_fields: Optional[List[str]] = None  # fields to use as join key
    max_rows: int = 10000


def _fetch_all(ds: DatasourceConfig, table: str, database: Optional[str], schema: Optional[str], cols: List[str], max_rows: int):
    pwd = decrypt_password(ds.password_encrypted)
    conn = _connect(ds.db_type, ds.host, ds.port, ds.username, pwd,
                    database or ds.database_name, schema, ds.charset, ds.connect_timeout_seconds or 10)
    try:
        cur = conn.cursor()
        col_str = ",".join(cols)
        sql = f"SELECT {col_str} FROM {table}"
        cur.execute(sql)
        rows = list(cur.fetchmany(max_rows))
        return rows
    finally:
        conn.close()


@router.post("/run")
def run_compare(
    body: CompareRequest,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(require_role("admin", "operator")),
):
    """Run cross-database data comparison."""
    src_ds = db.query(DatasourceConfig).filter(DatasourceConfig.id == body.source_ds_id, DatasourceConfig.is_deleted == 0).first()
    tgt_ds = db.query(DatasourceConfig).filter(DatasourceConfig.id == body.target_ds_id, DatasourceConfig.is_deleted == 0).first()
    if not src_ds or not tgt_ds:
        raise HTTPException(404, "数据源不存在")

    # Get columns from both tables
    src_pwd = decrypt_password(src_ds.password_encrypted)
    tgt_pwd = decrypt_password(tgt_ds.password_encrypted)

    src_cols = list_columns(src_ds.db_type, src_ds.host, src_ds.port, src_ds.username, src_pwd,
                            body.source_table, body.source_db_name or src_ds.database_name, body.source_schema,
                            src_ds.charset, src_ds.connect_timeout_seconds or 10)
    tgt_cols = list_columns(tgt_ds.db_type, tgt_ds.host, tgt_ds.port, tgt_ds.username, tgt_pwd,
                            body.target_table, body.target_db_name or tgt_ds.database_name, body.target_schema,
                            tgt_ds.charset, tgt_ds.connect_timeout_seconds or 10)

    src_col_names = [c["field_name"] for c in src_cols]
    tgt_col_names = [c["field_name"] for c in tgt_cols]

    # Match by same name
    matched = [c for c in src_col_names if c in tgt_col_names]
    if not matched:
        raise HTTPException(400, "两个表没有同名字段，无法对比")

    key_fields = body.key_fields or matched[:1]  # Use first matched field as key

    # Fetch data
    src_rows = _fetch_all(src_ds, body.source_table, body.source_db_name, body.source_schema, matched, body.max_rows)
    tgt_rows = _fetch_all(tgt_ds, body.target_table, body.target_db_name, body.target_schema, matched, body.max_rows)

    # Build lookup by key
    key_indices = [matched.index(k) for k in key_fields if k in matched]
    if not key_indices:
        key_indices = [0]

    def make_key(row):
        return tuple(str(row[i]) if row[i] is not None else "" for i in key_indices)

    src_map = {}
    for row in src_rows:
        k = make_key(row)
        src_map[k] = row
    tgt_map = {}
    for row in tgt_rows:
        k = make_key(row)
        tgt_map[k] = row

    only_in_source = []
    only_in_target = []
    different = []

    for k, srow in src_map.items():
        if k not in tgt_map:
            only_in_source.append([str(v) if v is not None else "" for v in srow])
        else:
            trow = tgt_map[k]
            diffs = {}
            for ci, col in enumerate(matched):
                sv = str(srow[ci]) if srow[ci] is not None else ""
                tv = str(trow[ci]) if trow[ci] is not None else ""
                if sv != tv:
                    diffs[col] = {"source": sv, "target": tv}
            if diffs:
                different.append({"key": list(k), "diffs": diffs})

    for k in tgt_map:
        if k not in src_map:
            only_in_target.append([str(v) if v is not None else "" for v in tgt_map[k]])

    compare_id = str(uuid.uuid4())[:8]
    result_data = {
        "matched_fields": matched,
        "key_fields": [matched[i] for i in key_indices],
        "source_row_count": len(src_rows),
        "target_row_count": len(tgt_rows),
        "only_in_source_count": len(only_in_source),
        "only_in_target_count": len(only_in_target),
        "different_count": len(different),
        "only_in_source": only_in_source[:100],
        "only_in_target": only_in_target[:100],
        "different": different[:100],
    }

    record = DataCompareResult(
        compare_id=compare_id,
        source_ds_id=body.source_ds_id,
        source_table=body.source_table,
        target_ds_id=body.target_ds_id,
        target_table=body.target_table,
        matched_fields=json.dumps(matched),
        result_json=json.dumps(result_data, ensure_ascii=False, default=str),
        status="completed",
        operator_user=user.username,
    )
    db.add(record)
    db.commit()

    log_operation(db, "数据对比", "跨库对比", "success",
                  message=f"对比 {body.source_table} vs {body.target_table}, 差异 {len(different)} 行",
                  operator=user.username)

    return {"compare_id": compare_id, "result": result_data}


@router.get("/{compare_id}/result")
def get_compare_result(
    compare_id: str,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    """Get previously run comparison result."""
    record = db.query(DataCompareResult).filter(DataCompareResult.compare_id == compare_id).first()
    if not record:
        raise HTTPException(404, "对比结果不存在")
    result = json.loads(record.result_json) if record.result_json else {}
    return {
        "compare_id": record.compare_id,
        "source_table": record.source_table,
        "target_table": record.target_table,
        "status": record.status,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "result": result,
    }
