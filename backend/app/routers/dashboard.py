"""Dashboard endpoints: stats, recent operations, alerts."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    DatasourceConfig, TableConfig, TemplateExportLog,
    ImportTaskLog, WritebackLog, SystemOperationLog, UserAccount,
    _now_bjt,
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["总览"])


@router.get("/stats")
def dashboard_stats(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """基础统计：数据源数量、已纳管表数量、今日导出/导入/回写次数。"""
    ds_count = db.query(func.count(DatasourceConfig.id)).filter(
        DatasourceConfig.is_deleted == 0
    ).scalar() or 0

    tc_count = db.query(func.count(TableConfig.id)).filter(
        TableConfig.is_deleted == 0
    ).scalar() or 0

    today_start = _now_bjt().replace(hour=0, minute=0, second=0, microsecond=0)

    export_today = db.query(func.count(TemplateExportLog.id)).filter(
        TemplateExportLog.created_at >= today_start
    ).scalar() or 0

    import_today = db.query(func.count(ImportTaskLog.id)).filter(
        ImportTaskLog.created_at >= today_start
    ).scalar() or 0

    writeback_today = db.query(func.count(WritebackLog.id)).filter(
        WritebackLog.created_at >= today_start
    ).scalar() or 0

    return {
        "datasource_count": ds_count,
        "table_count": tc_count,
        "today_export": export_today,
        "today_import": import_today,
        "today_writeback": writeback_today,
    }


@router.get("/recent-operations")
def recent_operations(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """最近 10 条操作记录。"""
    logs = (
        db.query(SystemOperationLog)
        .order_by(SystemOperationLog.id.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": log.id,
            "operation_type": log.operation_type,
            "operation_module": log.operation_module,
            "target_name": log.target_name,
            "operation_status": log.operation_status,
            "operation_message": log.operation_message,
            "operator_user": log.operator_user,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/alerts")
def dashboard_alerts(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """待处理提醒：表结构变化提醒、导入失败提醒。"""
    alerts = []

    # 表结构变化
    changed_tables = (
        db.query(TableConfig)
        .filter(
            TableConfig.is_deleted == 0,
            TableConfig.structure_check_status == "changed",
        )
        .all()
    )
    for tc in changed_tables:
        alerts.append({
            "type": "structure_changed",
            "level": "warning",
            "title": "表结构变化",
            "message": f"纳管表 [{tc.table_alias or tc.table_name}] 结构已发生变化，请检查",
            "target_id": tc.id,
            "target_name": tc.table_name,
            "created_at": tc.last_structure_check_at.isoformat() if tc.last_structure_check_at else None,
        })

    # 最近 7 天导入失败
    week_ago = _now_bjt() - timedelta(days=7)
    failed_imports = (
        db.query(ImportTaskLog)
        .filter(
            ImportTaskLog.validation_status == "failed",
            ImportTaskLog.created_at >= week_ago,
        )
        .order_by(ImportTaskLog.id.desc())
        .limit(5)
        .all()
    )
    for imp in failed_imports:
        tc = db.query(TableConfig).filter(TableConfig.id == imp.table_config_id).first()
        alerts.append({
            "type": "import_failed",
            "level": "error",
            "title": "导入校验失败",
            "message": f"文件 [{imp.import_file_name}] 导入 [{tc.table_alias or tc.table_name if tc else '未知表'}] 校验失败",
            "target_id": imp.id,
            "target_name": imp.import_file_name,
            "created_at": imp.created_at.isoformat() if imp.created_at else None,
        })

    return alerts
