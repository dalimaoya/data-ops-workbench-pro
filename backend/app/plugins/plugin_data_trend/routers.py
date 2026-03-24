"""Data Trend Analysis — 数据变更趋势分析"""

import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.database import get_db
from app.models import TableConfig, DatasourceConfig, SystemOperationLog, UserAccount
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/data-trend", tags=["data-trend"])

_BJT = timezone(timedelta(hours=8))


@router.get("/table/{table_id}/history")
def get_table_history(
    table_id: int,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    """Get row count change history for a table (from operation logs)."""
    tc = db.query(TableConfig).filter(TableConfig.id == table_id, TableConfig.is_deleted == 0).first()
    if not tc:
        raise HTTPException(404, "表配置不存在")

    cutoff = datetime.now(_BJT) - timedelta(days=days)

    # Count operations per day
    logs = db.query(SystemOperationLog).filter(
        SystemOperationLog.target_id == table_id,
        SystemOperationLog.created_at >= cutoff,
    ).order_by(SystemOperationLog.created_at).all()

    # Group by date
    daily_ops: dict = {}
    daily_types: dict = {}
    field_freq: dict = {}

    for log in logs:
        day_str = log.created_at.strftime("%Y-%m-%d") if log.created_at else "unknown"
        daily_ops[day_str] = daily_ops.get(day_str, 0) + 1
        op_type = log.operation_type or "unknown"
        if day_str not in daily_types:
            daily_types[day_str] = {}
        daily_types[day_str][op_type] = daily_types[day_str].get(op_type, 0) + 1

        # Parse message for field changes
        if log.operation_message:
            try:
                # Try parsing as JSON if it contains field info
                if "{" in log.operation_message:
                    detail = json.loads(log.operation_message)
                    changed_fields = detail.get("changed_fields", [])
                    for fname in changed_fields:
                        field_freq[fname] = field_freq.get(fname, 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass

    # Sort top fields
    top_fields = sorted(field_freq.items(), key=lambda x: -x[1])[:20]

    return {
        "table_id": table_id,
        "table_name": tc.table_name,
        "days": days,
        "daily_operations": [{"date": k, "count": v} for k, v in sorted(daily_ops.items())],
        "daily_types": daily_types,
        "top_modified_fields": [{"field": k, "count": v} for k, v in top_fields],
    }


@router.get("/overview")
def get_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    """Get global trend overview across all tables."""
    cutoff = datetime.now(_BJT) - timedelta(days=days)

    tables = db.query(TableConfig).filter(TableConfig.is_deleted == 0).all()

    table_stats = []
    for tc in tables:
        op_count = db.query(func.count(SystemOperationLog.id)).filter(
            SystemOperationLog.target_id == tc.id,
            SystemOperationLog.created_at >= cutoff,
        ).scalar() or 0

        # Count by type
        writeback_count = db.query(func.count(SystemOperationLog.id)).filter(
            SystemOperationLog.target_id == tc.id,
            SystemOperationLog.created_at >= cutoff,
            SystemOperationLog.operation_type.in_(["回写", "writeback", "inline_update", "inline_insert", "inline_delete"]),
        ).scalar() or 0

        export_count = db.query(func.count(SystemOperationLog.id)).filter(
            SystemOperationLog.target_id == tc.id,
            SystemOperationLog.created_at >= cutoff,
            SystemOperationLog.operation_type.in_(["导出", "export"]),
        ).scalar() or 0

        table_stats.append({
            "table_id": tc.id,
            "table_name": tc.table_name,
            "table_alias": tc.table_alias,
            "total_ops": op_count,
            "writeback_ops": writeback_count,
            "export_ops": export_count,
        })

    # Sort by total ops desc
    table_stats.sort(key=lambda x: -x["total_ops"])

    # Daily global ops
    all_logs = db.query(SystemOperationLog).filter(
        SystemOperationLog.created_at >= cutoff,
    ).all()

    daily_global: dict = {}
    for log in all_logs:
        day_str = log.created_at.strftime("%Y-%m-%d") if log.created_at else "unknown"
        daily_global[day_str] = daily_global.get(day_str, 0) + 1

    # Alerts: tables with high activity or sudden changes
    alerts = []
    for ts in table_stats[:10]:
        if ts["total_ops"] > 100:
            alerts.append({
                "table_name": ts["table_name"],
                "type": "high_activity",
                "message_zh": f"表 {ts['table_name']} 近 {days} 天操作数达 {ts['total_ops']} 次",
                "message_en": f"Table {ts['table_name']} has {ts['total_ops']} operations in {days} days",
            })

    return {
        "days": days,
        "table_stats": table_stats,
        "daily_global": [{"date": k, "count": v} for k, v in sorted(daily_global.items())],
        "alerts": alerts,
    }
