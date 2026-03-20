"""Platform database models - 8 core tables."""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, SmallInteger
)
from app.database import Base


# ── Mixin for audit fields ──
class AuditMixin:
    created_by = Column(String(64), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_by = Column(String(64), nullable=False, default="system")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(SmallInteger, nullable=False, default=0)


# ── 1. datasource_config ──
class DatasourceConfig(AuditMixin, Base):
    __tablename__ = "datasource_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_code = Column(String(64), unique=True, nullable=False)
    datasource_name = Column(String(128), nullable=False)
    db_type = Column(String(32), nullable=False, index=True)  # mysql/postgresql/sqlserver
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database_name = Column(String(128), nullable=True)
    schema_name = Column(String(128), nullable=True)
    username = Column(String(128), nullable=False)
    password_encrypted = Column(Text, nullable=False)
    charset = Column(String(32), nullable=True, default="utf8")
    connect_timeout_seconds = Column(Integer, nullable=True, default=10)
    status = Column(String(32), nullable=False, default="enabled", index=True)
    last_test_status = Column(String(32), nullable=True)
    last_test_message = Column(String(1000), nullable=True)
    last_test_at = Column(DateTime, nullable=True)
    remark = Column(String(500), nullable=True)


# ── 2. table_config ──
class TableConfig(AuditMixin, Base):
    __tablename__ = "table_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_config_code = Column(String(64), unique=True, nullable=False)
    datasource_id = Column(Integer, nullable=False)
    db_name = Column(String(128), nullable=True)
    schema_name = Column(String(128), nullable=True)
    table_name = Column(String(128), nullable=False)
    table_alias = Column(String(128), nullable=True)
    table_comment = Column(String(500), nullable=True)
    config_version = Column(Integer, nullable=False, default=1)
    structure_version_hash = Column(String(128), nullable=True)
    primary_key_fields = Column(String(500), nullable=False)
    unique_key_fields = Column(String(500), nullable=True)
    allow_export_current = Column(SmallInteger, nullable=False, default=1)
    allow_export_all = Column(SmallInteger, nullable=False, default=1)
    allow_import_writeback = Column(SmallInteger, nullable=False, default=1)
    allow_insert_rows = Column(SmallInteger, nullable=False, default=0)
    allow_delete_rows = Column(SmallInteger, nullable=False, default=0)
    backup_keep_count = Column(Integer, nullable=False, default=3)
    strict_template_version = Column(SmallInteger, nullable=False, default=1)
    strict_field_order = Column(SmallInteger, nullable=False, default=1)
    status = Column(String(32), nullable=False, default="enabled")
    structure_check_status = Column(String(32), nullable=True)
    last_structure_check_at = Column(DateTime, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    remark = Column(String(500), nullable=True)


# ── 3. field_config ──
class FieldConfig(AuditMixin, Base):
    __tablename__ = "field_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_config_id = Column(Integer, nullable=False)
    field_name = Column(String(128), nullable=False)
    field_alias = Column(String(128), nullable=True)
    db_data_type = Column(String(64), nullable=False)
    field_order_no = Column(Integer, nullable=False)
    sample_value = Column(String(1000), nullable=True)
    is_displayed = Column(SmallInteger, nullable=False, default=1)
    is_editable = Column(SmallInteger, nullable=False, default=1)
    is_required = Column(SmallInteger, nullable=False, default=0)
    is_primary_key = Column(SmallInteger, nullable=False, default=0)
    is_unique_key = Column(SmallInteger, nullable=False, default=0)
    is_system_field = Column(SmallInteger, nullable=False, default=0)
    include_in_export = Column(SmallInteger, nullable=False, default=1)
    include_in_import = Column(SmallInteger, nullable=False, default=1)
    max_length = Column(Integer, nullable=True)
    enum_options_json = Column(Text, nullable=True)
    validation_rule_json = Column(Text, nullable=True)
    default_display_type = Column(String(32), nullable=True, default="text")
    remark = Column(String(500), nullable=True)


# ── 4. template_export_log ──
class TemplateExportLog(Base):
    __tablename__ = "template_export_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    export_batch_no = Column(String(64), unique=True, nullable=False)
    table_config_id = Column(Integer, nullable=False)
    datasource_id = Column(Integer, nullable=False)
    export_type = Column(String(32), nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    field_count = Column(Integer, nullable=False, default=0)
    template_version = Column(Integer, nullable=False)
    file_name = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    export_filters_json = Column(Text, nullable=True)
    operator_user = Column(String(64), nullable=False)
    operator_ip = Column(String(64), nullable=True)
    remark = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── 5. import_task_log ──
class ImportTaskLog(Base):
    __tablename__ = "import_task_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_batch_no = Column(String(64), unique=True, nullable=False)
    table_config_id = Column(Integer, nullable=False)
    datasource_id = Column(Integer, nullable=False)
    related_export_batch_no = Column(String(64), nullable=True)
    import_file_name = Column(String(255), nullable=False)
    import_file_path = Column(String(500), nullable=True)
    template_version = Column(Integer, nullable=True)
    total_row_count = Column(Integer, nullable=False, default=0)
    passed_row_count = Column(Integer, nullable=False, default=0)
    warning_row_count = Column(Integer, nullable=False, default=0)
    failed_row_count = Column(Integer, nullable=False, default=0)
    diff_row_count = Column(Integer, nullable=False, default=0)
    validation_status = Column(String(32), nullable=False, default="waiting")
    validation_message = Column(String(1000), nullable=True)
    error_detail_json = Column(Text, nullable=True)
    import_status = Column(String(32), nullable=False, default="uploaded")
    operator_user = Column(String(64), nullable=False)
    operator_ip = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── 6. writeback_log ──
class WritebackLog(Base):
    __tablename__ = "writeback_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    writeback_batch_no = Column(String(64), unique=True, nullable=False)
    import_task_id = Column(Integer, nullable=False)
    table_config_id = Column(Integer, nullable=False)
    datasource_id = Column(Integer, nullable=False)
    backup_version_no = Column(String(64), nullable=True)
    total_row_count = Column(Integer, nullable=False, default=0)
    success_row_count = Column(Integer, nullable=False, default=0)
    failed_row_count = Column(Integer, nullable=False, default=0)
    skipped_row_count = Column(Integer, nullable=False, default=0)
    writeback_status = Column(String(32), nullable=False, default="running")
    writeback_message = Column(String(1000), nullable=True)
    failed_detail_json = Column(Text, nullable=True)
    operator_user = Column(String(64), nullable=False)
    operator_ip = Column(String(64), nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── 7. table_backup_version ──
class TableBackupVersion(Base):
    __tablename__ = "table_backup_version"

    id = Column(Integer, primary_key=True, autoincrement=True)
    backup_version_no = Column(String(64), unique=True, nullable=False)
    table_config_id = Column(Integer, nullable=False)
    datasource_id = Column(Integer, nullable=False)
    backup_table_name = Column(String(255), nullable=False)
    source_table_name = Column(String(255), nullable=False)
    source_db_name = Column(String(128), nullable=True)
    source_schema_name = Column(String(128), nullable=True)
    trigger_type = Column(String(32), nullable=False)
    related_writeback_batch_no = Column(String(64), nullable=True)
    record_count = Column(Integer, nullable=True)
    storage_status = Column(String(32), nullable=False, default="valid")
    can_rollback = Column(SmallInteger, nullable=False, default=1)
    backup_started_at = Column(DateTime, nullable=True)
    backup_finished_at = Column(DateTime, nullable=True)
    operator_user = Column(String(64), nullable=False)
    remark = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── 8. user_account ──
class UserAccount(Base):
    __tablename__ = "user_account"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="readonly")  # admin / operator / readonly
    display_name = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default="enabled")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── 9. system_operation_log ──
class SystemOperationLog(Base):
    __tablename__ = "system_operation_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operation_type = Column(String(64), nullable=False)
    operation_module = Column(String(64), nullable=False)
    target_id = Column(Integer, nullable=True)
    target_code = Column(String(64), nullable=True)
    target_name = Column(String(255), nullable=True)
    operation_status = Column(String(32), nullable=False)
    operation_message = Column(String(1000), nullable=True)
    request_method = Column(String(16), nullable=True)
    request_path = Column(String(255), nullable=True)
    request_params_json = Column(Text, nullable=True)
    operator_user = Column(String(64), nullable=False)
    operator_ip = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
