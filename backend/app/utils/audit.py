"""Audit utility: record system operation logs."""

from sqlalchemy.orm import Session
from app.models import SystemOperationLog


def log_operation(
    db: Session,
    module: str,
    op_type: str,
    status: str,
    target_id: int | None = None,
    target_code: str | None = None,
    target_name: str | None = None,
    message: str | None = None,
    request_method: str | None = None,
    request_path: str | None = None,
    operator: str = "admin",
    operator_ip: str | None = None,
):
    """Write a system_operation_log row."""
    log = SystemOperationLog(
        operation_type=op_type,
        operation_module=module,
        target_id=target_id,
        target_code=target_code,
        target_name=target_name,
        operation_status=status,
        operation_message=message,
        request_method=request_method,
        request_path=request_path,
        operator_user=operator,
        operator_ip=operator_ip,
    )
    db.add(log)
