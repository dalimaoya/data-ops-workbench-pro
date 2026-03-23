"""Dashboard endpoints: stats, recent operations, alerts."""

import re
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
    """最近 20 条操作记录，包含表别名和详细描述。"""
    logs = (
        db.query(SystemOperationLog)
        .order_by(SystemOperationLog.id.desc())
        .limit(20)
        .all()
    )
    result = []
    for log in logs:
        # 尝试获取表别名
        table_alias = None
        if log.target_id:
            tc = db.query(TableConfig).filter(TableConfig.id == log.target_id).first()
            if tc:
                table_alias = tc.table_alias or tc.table_name

        # 构建可读描述
        readable_desc = _build_readable_desc(log, table_alias)

        result.append({
            "id": log.id,
            "operation_type": log.operation_type,
            "operation_module": log.operation_module,
            "target_name": log.target_name,
            "table_alias": table_alias,
            "operation_status": log.operation_status,
            "operation_message": log.operation_message,
            "readable_desc": readable_desc,
            "operator_user": log.operator_user,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return result


def _build_readable_desc(log: SystemOperationLog, table_alias: str = None) -> str:
    """根据操作类型构建可读描述。"""
    alias = table_alias or log.target_name or "未知表"
    msg = log.operation_message or ""
    op = log.operation_type or ""

    if "回写" in op or "执行回写" in op:
        # 从 message 中提取更新/新增数
        m = re.search(r"更新\s*(\d+).*新增\s*(\d+)", msg)
        if m:
            return "回写【{}】表，更新 {} 行，新增 {} 行".format(alias, m.group(1), m.group(2))
        return "回写【{}】表".format(alias)

    if "导出" in op:
        m = re.search(r"(\d+)\s*行", msg)
        if m:
            return "导出【{}】模板，共 {} 行".format(alias, m.group(1))
        return "导出【{}】模板".format(alias)

    if "导入" in op:
        m = re.search(r"通过\s*(\d+).*失败\s*(\d+)", msg)
        if m:
            return "导入【{}】模板，校验通过 {} 行，失败 {} 行".format(alias, m.group(1), m.group(2))
        return "导入【{}】模板".format(alias)

    if "删除" in op:
        m = re.search(r"删除\s*(\d+)\s*行", msg)
        if m:
            return "删除【{}】{} 行数据".format(alias, m.group(1))
        return "删除【{}】数据".format(alias)

    if "在线编辑" in op:
        m = re.search(r"更新\s*(\d+)", msg)
        if m:
            return "在线编辑【{}】表，更新 {} 行".format(alias, m.group(1))
        return "在线编辑【{}】表".format(alias)

    if "在线新增" in op:
        return "在线新增【{}】1 行数据".format(alias)

    # 其他操作保持原始 message
    if msg:
        return msg
    return "{} - {}".format(op, alias)


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
            "message": "纳管表 [{}] 结构已发生变化，请前往纳管表配置检查并更新字段".format(
                tc.table_alias or tc.table_name
            ),
            "target_id": tc.id,
            "table_config_id": tc.id,
            "target_name": tc.table_name,
            "created_at": tc.last_structure_check_at.isoformat() if tc.last_structure_check_at else None,
        })

    # 最近 7 天导入失败且未处理（import_status 不是 confirmed）
    week_ago = _now_bjt() - timedelta(days=7)
    failed_imports = (
        db.query(ImportTaskLog)
        .filter(
            ImportTaskLog.validation_status == "failed",
            ImportTaskLog.import_status != "confirmed",
            ImportTaskLog.created_at >= week_ago,
        )
        .order_by(ImportTaskLog.id.desc())
        .limit(5)
        .all()
    )
    for imp in failed_imports:
        tc = db.query(TableConfig).filter(TableConfig.id == imp.table_config_id).first()
        table_label = tc.table_alias or tc.table_name if tc else "未知表"
        alerts.append({
            "type": "import_failed",
            "level": "error",
            "title": "导入校验失败",
            "message": "文件 [{}] 导入 [{}] 校验失败，共 {} 行错误".format(
                imp.import_file_name, table_label, imp.failed_row_count
            ),
            "target_id": imp.id,
            "table_config_id": imp.table_config_id,
            "target_name": imp.import_file_name,
            "created_at": imp.created_at.isoformat() if imp.created_at else None,
        })

    return alerts
