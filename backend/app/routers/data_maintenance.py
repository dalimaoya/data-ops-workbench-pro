"""Data maintenance endpoints: browse, export, import, diff, writeback."""

from __future__ import annotations
import json
import os
import uuid
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db, DATA_DIR
from app.models import (
    TableConfig, DatasourceConfig, FieldConfig,
    TemplateExportLog, ImportTaskLog, WritebackLog, TableBackupVersion,
)
from app.utils.crypto import decrypt_password
from app.utils.remote_db import _connect, fetch_sample_data, compute_structure_hash, list_columns
from app.utils.audit import log_operation
from app.utils.auth import get_current_user, require_role
from app.models import UserAccount

router = APIRouter(prefix="/api/data-maintenance", tags=["数据维护"])

def _get_username(user) -> str:
    """Get username from JWT user or fallback."""
    if user and hasattr(user, 'username'):
        return user.username
    return "system"


UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
EXPORT_DIR = os.path.join(DATA_DIR, "exports")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


def _gen_batch(prefix: str) -> str:
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    rand = uuid.uuid4().hex[:4].upper()
    return f"{prefix}_{ts}_{rand}"


def _get_tc(db: Session, tc_id: int) -> TableConfig:
    tc = db.query(TableConfig).filter(
        TableConfig.id == tc_id, TableConfig.is_deleted == 0, TableConfig.status == "enabled"
    ).first()
    if not tc:
        raise HTTPException(404, "纳管表不存在或未启用")
    return tc


def _get_ds(db: Session, ds_id: int) -> DatasourceConfig:
    ds = db.query(DatasourceConfig).filter(
        DatasourceConfig.id == ds_id, DatasourceConfig.is_deleted == 0
    ).first()
    if not ds:
        raise HTTPException(404, "数据源不存在")
    return ds


def _get_fields(db: Session, tc_id: int) -> List[FieldConfig]:
    return (
        db.query(FieldConfig)
        .filter(FieldConfig.table_config_id == tc_id, FieldConfig.is_deleted == 0)
        .order_by(FieldConfig.field_order_no)
        .all()
    )


def _qualified_table(db_type: str, table_name: str, schema: Optional[str]) -> str:
    if db_type == "postgresql":
        sch = schema or "public"
        return f'"{sch}"."{table_name}"'
    elif db_type == "sqlserver":
        sch = schema or "dbo"
        return f"[{sch}].[{table_name}]"
    return f"`{table_name}`"


# ─────────────────────────────────────────────
# P2-1: 数据浏览
# ─────────────────────────────────────────────

@router.get("/tables")
def list_maintenance_tables(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    """可维护表列表。"""
    q = db.query(TableConfig).filter(
        TableConfig.is_deleted == 0, TableConfig.status == "enabled"
    )
    if keyword:
        q = q.filter(
            (TableConfig.table_name.contains(keyword)) |
            (TableConfig.table_alias.contains(keyword))
        )
    total = q.count()
    rows = q.order_by(TableConfig.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for row in rows:
        ds = db.query(DatasourceConfig).filter(DatasourceConfig.id == row.datasource_id).first()
        field_count = db.query(FieldConfig).filter(
            FieldConfig.table_config_id == row.id, FieldConfig.is_deleted == 0
        ).count()
        result.append({
            "id": row.id,
            "table_config_code": row.table_config_code,
            "datasource_id": row.datasource_id,
            "datasource_name": ds.datasource_name if ds else None,
            "db_type": ds.db_type if ds else None,
            "db_name": row.db_name,
            "schema_name": row.schema_name,
            "table_name": row.table_name,
            "table_alias": row.table_alias,
            "config_version": row.config_version,
            "structure_check_status": row.structure_check_status,
            "field_count": field_count,
            "updated_by": row.updated_by,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        })
    return {"total": total, "items": result}


@router.get("/{table_config_id}/data")
def browse_table_data(
    table_config_id: int,
    keyword: Optional[str] = None,
    field_filters: Optional[str] = None,  # JSON: {"field_name": "value", ...}
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    """分页读取业务表数据，所有字段值按文本返回。"""
    tc = _get_tc(db, table_config_id)
    ds = _get_ds(db, tc.datasource_id)
    pwd = decrypt_password(ds.password_encrypted)
    fields = _get_fields(db, table_config_id)
    display_fields = [f for f in fields if f.is_displayed]
    if not display_fields:
        return {"columns": [], "rows": [], "total": 0, "page": page, "page_size": page_size}

    col_names = [f.field_name for f in display_fields]
    col_aliases = [f.field_alias or f.field_name for f in display_fields]

    conn = _connect(
        ds.db_type, ds.host, ds.port, ds.username, pwd,
        tc.db_name, tc.schema_name, ds.charset, ds.connect_timeout_seconds or 10,
    )
    try:
        cur = conn.cursor()
        qt = _qualified_table(ds.db_type, tc.table_name, tc.schema_name)

        # Build WHERE clause
        where_parts = []
        params: list = []

        if keyword:
            kw_parts = []
            for f in display_fields:
                if ds.db_type == "sqlserver":
                    kw_parts.append(f"CAST([{f.field_name}] AS NVARCHAR(MAX)) LIKE ?")
                elif ds.db_type == "mysql":
                    kw_parts.append(f"CAST(`{f.field_name}` AS CHAR) LIKE %s")
                else:
                    kw_parts.append(f'CAST("{f.field_name}" AS TEXT) LIKE %s')
                params.append(f"%{keyword}%")
            if kw_parts:
                where_parts.append(f"({' OR '.join(kw_parts)})")

        if field_filters:
            try:
                ff = json.loads(field_filters)
                for fname, fval in ff.items():
                    if fval and any(f.field_name == fname for f in display_fields):
                        if ds.db_type == "sqlserver":
                            where_parts.append(f"CAST([{fname}] AS NVARCHAR(MAX)) LIKE ?")
                        elif ds.db_type == "mysql":
                            where_parts.append(f"CAST(`{fname}` AS CHAR) LIKE %s")
                        else:
                            where_parts.append(f'CAST("{fname}" AS TEXT) LIKE %s')
                        params.append(f"%{fval}%")
            except (json.JSONDecodeError, TypeError):
                pass

        where_sql = ""
        if where_parts:
            where_sql = " WHERE " + " AND ".join(where_parts)

        # Count
        count_sql = f"SELECT COUNT(*) FROM {qt}{where_sql}"
        if ds.db_type == "sqlserver":
            cur.execute(count_sql, params)
        else:
            cur.execute(count_sql, params)
        total = cur.fetchone()[0]

        # Select columns
        if ds.db_type == "sqlserver":
            cols_sql = ", ".join(f"[{c}]" for c in col_names)
        elif ds.db_type == "mysql":
            cols_sql = ", ".join(f"`{c}`" for c in col_names)
        else:
            cols_sql = ", ".join(f'"{c}"' for c in col_names)

        offset_val = (page - 1) * page_size
        if ds.db_type == "sqlserver":
            # SQL Server requires ORDER BY for OFFSET
            pk_fields = tc.primary_key_fields.split(",")
            order_col = f"[{pk_fields[0].strip()}]"
            data_sql = f"SELECT {cols_sql} FROM {qt}{where_sql} ORDER BY {order_col} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
            cur.execute(data_sql, params + [offset_val, page_size])
        elif ds.db_type == "mysql":
            data_sql = f"SELECT {cols_sql} FROM {qt}{where_sql} LIMIT %s OFFSET %s"
            cur.execute(data_sql, params + [page_size, offset_val])
        else:
            data_sql = f"SELECT {cols_sql} FROM {qt}{where_sql} LIMIT %s OFFSET %s"
            cur.execute(data_sql, params + [page_size, offset_val])

        raw_rows = cur.fetchall()
        rows = []
        for raw in raw_rows:
            row_dict = {}
            for i, cn in enumerate(col_names):
                row_dict[cn] = str(raw[i]) if raw[i] is not None else None
            rows.append(row_dict)

        # Build column meta
        columns_meta = []
        pk_set = set(f.strip() for f in tc.primary_key_fields.split(","))
        for f in display_fields:
            columns_meta.append({
                "field_name": f.field_name,
                "field_alias": f.field_alias or f.field_name,
                "db_data_type": f.db_data_type,
                "is_primary_key": f.is_primary_key,
                "is_editable": f.is_editable,
                "is_system_field": f.is_system_field,
            })

        return {
            "columns": columns_meta,
            "rows": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(500, f"查询数据失败: {str(e)}")
    finally:
        conn.close()


# ─────────────────────────────────────────────
# P2-3: 模板导出
# ─────────────────────────────────────────────

@router.post("/{table_config_id}/export")
def export_template(
    table_config_id: int,
    export_type: str = Query("all", regex="^(current|all)$"),
    keyword: Optional[str] = None,
    field_filters: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    """导出含隐藏元信息的 Excel 模板。"""
    import openpyxl
    from openpyxl.utils import get_column_letter

    tc = _get_tc(db, table_config_id)
    ds = _get_ds(db, tc.datasource_id)
    pwd = decrypt_password(ds.password_encrypted)
    fields = _get_fields(db, table_config_id)
    export_fields = [f for f in fields if f.include_in_export]
    if not export_fields:
        raise HTTPException(400, "没有可导出的字段")

    col_names = [f.field_name for f in export_fields]
    pk_set = set(f.strip() for f in tc.primary_key_fields.split(","))

    # Query data from remote DB
    conn = _connect(
        ds.db_type, ds.host, ds.port, ds.username, pwd,
        tc.db_name, tc.schema_name, ds.charset, ds.connect_timeout_seconds or 10,
    )
    try:
        cur = conn.cursor()
        qt = _qualified_table(ds.db_type, tc.table_name, tc.schema_name)

        where_parts = []
        params: list = []
        if export_type == "current" and (keyword or field_filters):
            if keyword:
                kw_parts = []
                for f in export_fields:
                    if ds.db_type == "sqlserver":
                        kw_parts.append(f"CAST([{f.field_name}] AS NVARCHAR(MAX)) LIKE ?")
                    elif ds.db_type == "mysql":
                        kw_parts.append(f"CAST(`{f.field_name}` AS CHAR) LIKE %s")
                    else:
                        kw_parts.append(f'CAST("{f.field_name}" AS TEXT) LIKE %s')
                    params.append(f"%{keyword}%")
                where_parts.append(f"({' OR '.join(kw_parts)})")
            if field_filters:
                try:
                    ff = json.loads(field_filters)
                    for fname, fval in ff.items():
                        if fval and any(f.field_name == fname for f in export_fields):
                            if ds.db_type == "sqlserver":
                                where_parts.append(f"CAST([{fname}] AS NVARCHAR(MAX)) LIKE ?")
                            elif ds.db_type == "mysql":
                                where_parts.append(f"CAST(`{fname}` AS CHAR) LIKE %s")
                            else:
                                where_parts.append(f'CAST("{fname}" AS TEXT) LIKE %s')
                            params.append(f"%{fval}%")
                except (json.JSONDecodeError, TypeError):
                    pass

        where_sql = ""
        if where_parts:
            where_sql = " WHERE " + " AND ".join(where_parts)

        if ds.db_type == "sqlserver":
            cols_sql = ", ".join(f"[{c}]" for c in col_names)
        elif ds.db_type == "mysql":
            cols_sql = ", ".join(f"`{c}`" for c in col_names)
        else:
            cols_sql = ", ".join(f'"{c}"' for c in col_names)

        data_sql = f"SELECT {cols_sql} FROM {qt}{where_sql}"
        cur.execute(data_sql, params)
        raw_rows = cur.fetchall()
    except Exception as e:
        raise HTTPException(500, f"查询数据失败: {str(e)}")
    finally:
        conn.close()

    # Generate Excel with openpyxl
    from openpyxl.styles import Protection as CellProtection
    from openpyxl.worksheet.protection import SheetProtection

    batch_no = _gen_batch("EXP")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "数据"

    RESERVED_BLANK_ROWS = 50  # 预留空白行数
    locked_cell = CellProtection(locked=True)
    unlocked_cell = CellProtection(locked=False)

    # Build editable field set for quick lookup
    editable_field_names = set(f.field_name for f in export_fields if f.is_editable)

    data_row_count = len(raw_rows)
    total_rows = 1 + data_row_count + RESERVED_BLANK_ROWS  # header + data + blank
    total_cols = len(export_fields)

    # Row 1: Header (field aliases) — always locked
    for i, f in enumerate(export_fields, 1):
        cell = ws.cell(row=1, column=i, value=f.field_alias or f.field_name)
        cell.font = openpyxl.styles.Font(bold=True)
        cell.protection = locked_cell

    # Row 2+: Data rows
    for row_idx, raw in enumerate(raw_rows, 2):
        for col_idx, (val, ef) in enumerate(zip(raw, export_fields), 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=str(val) if val is not None else "")
            if ef.field_name in pk_set:
                # 已有数据行的主键列 — 锁定
                cell.protection = locked_cell
            elif ef.field_name in editable_field_names:
                # 可编辑字段 — 解锁
                cell.protection = unlocked_cell
            else:
                # 非可编辑、非主键字段 — 锁定
                cell.protection = locked_cell

    # Reserved blank rows (for future new-row support)
    blank_start = 2 + data_row_count
    for row_idx in range(blank_start, blank_start + RESERVED_BLANK_ROWS):
        for col_idx, ef in enumerate(export_fields, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value="")
            if ef.field_name in pk_set:
                # 空白行的主键列 — 解锁（预留新增行）
                cell.protection = unlocked_cell
            elif ef.field_name in editable_field_names:
                cell.protection = unlocked_cell
            else:
                cell.protection = locked_cell

    # Enable worksheet protection (防误操作，不设密码)
    ws.protection = SheetProtection(
        sheet=True,
        formatColumns=False,
        formatRows=False,
        formatCells=False,
        insertRows=False,
        deleteRows=True,     # 禁止删除行
        deleteColumns=True,  # 禁止删除列
        insertColumns=True,  # 禁止插入列
        sort=False,
        autoFilter=False,
    )

    # Hidden meta sheet
    meta_ws = wb.create_sheet("_meta")
    meta_info = {
        "datasource_id": tc.datasource_id,
        "table_config_id": tc.id,
        "config_version": tc.config_version,
        "export_time": datetime.utcnow().isoformat(),
        "export_batch_no": batch_no,
        "field_codes": [f.field_name for f in export_fields],
        "field_aliases": [f.field_alias or f.field_name for f in export_fields],
        "primary_key_fields": list(pk_set),
        "structure_hash": tc.structure_version_hash,
    }
    meta_ws.cell(row=1, column=1, value=json.dumps(meta_info, ensure_ascii=False))
    meta_ws.sheet_state = "hidden"

    # Auto-width
    for i, f in enumerate(export_fields, 1):
        col_letter = get_column_letter(i)
        ws.column_dimensions[col_letter].width = max(12, len(f.field_alias or f.field_name) * 2 + 4)

    file_name = f"{tc.table_alias or tc.table_name}_{batch_no}.xlsx"
    file_path = os.path.join(EXPORT_DIR, file_name)
    wb.save(file_path)

    # Record export log
    log = TemplateExportLog(
        export_batch_no=batch_no,
        table_config_id=tc.id,
        datasource_id=tc.datasource_id,
        export_type=export_type,
        row_count=len(raw_rows),
        field_count=len(export_fields),
        template_version=tc.config_version,
        file_name=file_name,
        file_path=file_path,
        export_filters_json=json.dumps({"keyword": keyword, "field_filters": field_filters}, ensure_ascii=False) if keyword or field_filters else None,
        operator_user=_get_username(user),
    )
    db.add(log)
    log_operation(db, "数据维护", "导出模板", "success",
                  target_id=tc.id, target_name=tc.table_name,
                  message=f"导出模板 {file_name}，{len(raw_rows)} 行",
                  operator=_get_username(user))
    db.commit()

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=file_name,
        headers={"X-Export-Batch-No": batch_no},
    )


@router.get("/{table_config_id}/export-info")
def get_export_info(table_config_id: int, db: Session = Depends(get_db), user: UserAccount = Depends(get_current_user)):
    """获取导出前的预估信息。"""
    tc = _get_tc(db, table_config_id)
    ds = _get_ds(db, tc.datasource_id)
    pwd = decrypt_password(ds.password_encrypted)
    fields = _get_fields(db, table_config_id)
    export_fields = [f for f in fields if f.include_in_export]

    # Count rows
    conn = _connect(
        ds.db_type, ds.host, ds.port, ds.username, pwd,
        tc.db_name, tc.schema_name, ds.charset, ds.connect_timeout_seconds or 10,
    )
    try:
        cur = conn.cursor()
        qt = _qualified_table(ds.db_type, tc.table_name, tc.schema_name)
        cur.execute(f"SELECT COUNT(*) FROM {qt}")
        total = cur.fetchone()[0]
    except Exception:
        total = -1
    finally:
        conn.close()

    return {
        "table_config_id": tc.id,
        "table_alias": tc.table_alias,
        "table_name": tc.table_name,
        "config_version": tc.config_version,
        "field_count": len(export_fields),
        "estimated_rows": total,
    }


# ─────────────────────────────────────────────
# P2-5: 模板导入
# ─────────────────────────────────────────────

@router.post("/{table_config_id}/import")
async def import_template(
    table_config_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserAccount = Depends(require_role("admin", "operator")),
):
    """上传平台模板，解析校验，生成差异数据。不直接写库。"""
    import openpyxl

    tc = _get_tc(db, table_config_id)
    ds = _get_ds(db, tc.datasource_id)
    pwd = decrypt_password(ds.password_encrypted)
    fields = _get_fields(db, table_config_id)

    # Save uploaded file
    file_name = file.filename or "upload.xlsx"
    save_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}_{file_name}")
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Parse Excel
    try:
        wb = openpyxl.load_workbook(save_path, data_only=True)
    except Exception as e:
        raise HTTPException(400, f"无法解析文件: {str(e)}")

    # ── 1. Validate meta sheet ──
    if "_meta" not in wb.sheetnames:
        raise HTTPException(400, "非平台导出模板，缺少元信息")

    meta_ws = wb["_meta"]
    meta_raw = meta_ws.cell(row=1, column=1).value
    if not meta_raw:
        raise HTTPException(400, "模板元信息为空")

    try:
        meta = json.loads(meta_raw)
    except json.JSONDecodeError:
        raise HTTPException(400, "模板元信息格式错误")

    # ── 2. Validate template legitimacy ──
    errors: List[dict] = []
    warnings: List[dict] = []

    if meta.get("table_config_id") != table_config_id:
        raise HTTPException(400, f"模板不属于当前纳管表 (期望 {table_config_id}，实际 {meta.get('table_config_id')})")

    if meta.get("datasource_id") != tc.datasource_id:
        raise HTTPException(400, "模板的数据源ID不匹配")

    # ── 3. Version match ──
    meta_version = meta.get("config_version", 0)
    if tc.strict_template_version and meta_version != tc.config_version:
        raise HTTPException(400, f"配置版本不匹配 (模板版本 {meta_version}，当前版本 {tc.config_version})，请重新导出模板")

    # ── 4. Read data sheet ──
    data_ws = wb["数据"] if "数据" in wb.sheetnames else wb.worksheets[0]

    # Get header row
    header_row = [cell.value for cell in data_ws[1]]
    header_row = [h for h in header_row if h is not None]

    meta_field_codes = meta.get("field_codes", [])
    pk_fields = set(meta.get("primary_key_fields", []))

    # Build field map
    import_fields = [f for f in fields if f.include_in_import or f.is_primary_key]
    export_fields = [f for f in fields if f.include_in_export]
    field_alias_to_name = {f.field_alias or f.field_name: f.field_name for f in export_fields}
    field_name_map = {f.field_name: f for f in fields}

    # ── 4.1 列数校验 ──
    expected_aliases = meta.get("field_aliases") or [f.field_alias or f.field_name for f in export_fields]
    expected_col_count = len(expected_aliases)
    actual_col_count = len(header_row)
    if actual_col_count != expected_col_count:
        raise HTTPException(
            400,
            f"列数不匹配：模板定义 {expected_col_count} 列，上传文件 {actual_col_count} 列。请使用平台导出的原始模板。",
        )

    # ── 4.2 列名逐列校验 ──
    mismatched_cols: List[str] = []
    for idx, (expected, actual) in enumerate(zip(expected_aliases, header_row)):
        if expected != actual:
            mismatched_cols.append(f"第{idx+1}列 期望「{expected}」实际「{actual}」")
    if mismatched_cols:
        raise HTTPException(
            400,
            f"列名不匹配：{'; '.join(mismatched_cols)}。请勿修改表头，使用平台导出的原始模板。",
        )

    # ── 5. Field completeness check ──
    mapped_cols: Dict[int, str] = {}  # col_index -> field_name
    for i, h in enumerate(header_row):
        if h in field_alias_to_name:
            mapped_cols[i] = field_alias_to_name[h]
        elif h in field_name_map:
            mapped_cols[i] = h

    # Check all import fields are present
    mapped_field_names = set(mapped_cols.values())
    for f in import_fields:
        if f.field_name not in mapped_field_names and f.field_name in set(f2.field_name for f2 in export_fields):
            if f.is_primary_key:
                errors.append({"row": 0, "field": f.field_name, "type": "field_missing", "message": f"主键字段 {f.field_name} 缺失"})
            else:
                warnings.append({"row": 0, "field": f.field_name, "type": "field_missing", "message": f"导入字段 {f.field_name} 缺失"})

    if any(e["type"] == "field_missing" and "主键" in e["message"] for e in errors):
        batch_no = _gen_batch("IMP")
        log = ImportTaskLog(
            import_batch_no=batch_no,
            table_config_id=tc.id,
            datasource_id=tc.datasource_id,
            related_export_batch_no=meta.get("export_batch_no"),
            import_file_name=file_name,
            import_file_path=save_path,
            template_version=meta_version,
            total_row_count=0,
            passed_row_count=0,
            warning_row_count=0,
            failed_row_count=len(errors),
            diff_row_count=0,
            validation_status="failed",
            validation_message="主键字段缺失",
            error_detail_json=json.dumps(errors, ensure_ascii=False),
            import_status="validated",
            operator_user=_get_username(user),
        )
        db.add(log)
        db.commit()
        return {
            "task_id": log.id,
            "import_batch_no": batch_no,
            "validation_status": "failed",
            "total": 0, "passed": 0, "failed": len(errors), "warnings": len(warnings),
            "errors": errors,
            "warnings_list": warnings,
        }

    # ── 6. Read rows & validate ──
    pk_col_indices = [i for i, fn in mapped_cols.items() if fn in pk_fields]
    data_rows: List[dict] = []
    seen_pks: Dict[str, int] = {}

    for row_idx in range(2, data_ws.max_row + 1):
        row_cells = [data_ws.cell(row=row_idx, column=i + 1).value for i in range(len(header_row))]
        # Skip entirely empty rows
        if all(c is None or str(c).strip() == "" for c in row_cells):
            continue

        row_data: Dict[str, Optional[str]] = {}
        row_errors: List[dict] = []
        row_warnings: List[dict] = []

        for col_i, fname in mapped_cols.items():
            val = row_cells[col_i] if col_i < len(row_cells) else None
            str_val = str(val).strip() if val is not None else None
            row_data[fname] = str_val
            fc = field_name_map.get(fname)
            if not fc:
                continue

            # Required check
            if fc.is_required and (str_val is None or str_val == ""):
                row_errors.append({
                    "row": row_idx, "field": fname,
                    "type": "required", "value": str_val,
                    "message": f"第{row_idx}行 字段[{fc.field_alias or fname}] 必填",
                })

            # Length check
            if fc.max_length and str_val and len(str_val) > fc.max_length:
                row_errors.append({
                    "row": row_idx, "field": fname,
                    "type": "length", "value": str_val,
                    "message": f"第{row_idx}行 字段[{fc.field_alias or fname}] 超过长度限制 {fc.max_length}",
                })

            # Data type check
            if str_val and fc.db_data_type:
                dtype = fc.db_data_type.lower()
                if any(t in dtype for t in ("int", "bigint", "smallint", "tinyint")):
                    try:
                        int(str_val)
                    except ValueError:
                        row_errors.append({
                            "row": row_idx, "field": fname,
                            "type": "data_type", "value": str_val,
                            "message": f"第{row_idx}行 字段[{fc.field_alias or fname}] 期望整数",
                        })
                elif any(t in dtype for t in ("decimal", "numeric", "float", "double", "real")):
                    try:
                        float(str_val)
                    except ValueError:
                        row_errors.append({
                            "row": row_idx, "field": fname,
                            "type": "data_type", "value": str_val,
                            "message": f"第{row_idx}行 字段[{fc.field_alias or fname}] 期望数值",
                        })

            # Enum check
            if fc.enum_options_json and str_val:
                try:
                    options = json.loads(fc.enum_options_json)
                    if isinstance(options, list) and str_val not in options:
                        row_errors.append({
                            "row": row_idx, "field": fname,
                            "type": "enum", "value": str_val,
                            "message": f"第{row_idx}行 字段[{fc.field_alias or fname}] 值不在枚举范围内",
                        })
                except json.JSONDecodeError:
                    pass

        # PK check
        pk_vals = tuple(row_data.get(mapped_cols[i], "") for i in pk_col_indices)
        pk_key = "|".join(str(v) for v in pk_vals)
        if any(v is None or v == "" for v in pk_vals):
            row_errors.append({
                "row": row_idx, "field": ",".join(pk_fields),
                "type": "pk_empty", "value": pk_key,
                "message": f"第{row_idx}行 主键字段为空",
            })
        elif pk_key in seen_pks:
            row_errors.append({
                "row": row_idx, "field": ",".join(pk_fields),
                "type": "duplicate", "value": pk_key,
                "message": f"第{row_idx}行 与第{seen_pks[pk_key]}行主键重复",
            })
        else:
            seen_pks[pk_key] = row_idx

        data_rows.append({
            "row_num": row_idx,
            "data": row_data,
            "errors": row_errors,
            "warnings": row_warnings,
            "pk_key": pk_key,
        })
        errors.extend(row_errors)
        warnings.extend(row_warnings)

    # ── 7. Generate diff (original vs new) ──
    diff_rows: List[dict] = []
    passed_count = 0
    failed_count = len([r for r in data_rows if r["errors"]])

    if not all(r["errors"] for r in data_rows):
        # Fetch current data from DB for comparison
        conn = _connect(
            ds.db_type, ds.host, ds.port, ds.username, pwd,
            tc.db_name, tc.schema_name, ds.charset, ds.connect_timeout_seconds or 10,
        )
        try:
            cur = conn.cursor()
            qt = _qualified_table(ds.db_type, tc.table_name, tc.schema_name)
            all_field_names = [f.field_name for f in export_fields]

            if ds.db_type == "sqlserver":
                cols_sql = ", ".join(f"[{c}]" for c in all_field_names)
            elif ds.db_type == "mysql":
                cols_sql = ", ".join(f"`{c}`" for c in all_field_names)
            else:
                cols_sql = ", ".join(f'"{c}"' for c in all_field_names)

            cur.execute(f"SELECT {cols_sql} FROM {qt}")
            db_rows = cur.fetchall()

            # Build PK -> row map from DB
            pk_field_indices = [all_field_names.index(p) for p in pk_fields if p in all_field_names]
            db_pk_map: Dict[str, dict] = {}
            for db_row in db_rows:
                pk_val = "|".join(str(db_row[i]) if db_row[i] is not None else "" for i in pk_field_indices)
                row_dict = {}
                for j, fn in enumerate(all_field_names):
                    row_dict[fn] = str(db_row[j]) if db_row[j] is not None else None
                db_pk_map[pk_val] = row_dict
        except Exception as e:
            raise HTTPException(500, f"查询原始数据失败: {str(e)}")
        finally:
            conn.close()

        # ── 7.1 主键不可变校验 ──
        # 从原始导出数据中提取主键值，与上传数据对比
        # 如果上传数据中的主键行在DB中找不到，可能是用户修改了主键
        # 构建 DB 中所有主键集合用于校验
        db_all_pk_set = set(db_pk_map.keys())

        pk_modified_errors: List[dict] = []
        for row in data_rows:
            if row["errors"]:
                continue
            pk_key = row["pk_key"]
            if pk_key not in db_all_pk_set:
                # 主键值在数据库中不存在 — 可能是用户篡改了主键
                pk_modified_errors.append({
                    "row": row["row_num"],
                    "field": ",".join(pk_fields),
                    "type": "pk_modified",
                    "value": pk_key,
                    "message": f"第{row['row_num']}行 主键值「{pk_key}」在数据库中不存在，疑似主键被修改（首版不支持新增记录）",
                })

        if pk_modified_errors:
            # 主键被修改是严重错误，直接阻断
            errors.extend(pk_modified_errors)
            for e in pk_modified_errors:
                matching_row = next((r for r in data_rows if r["row_num"] == e["row"]), None)
                if matching_row:
                    matching_row["errors"].append(e)
                    failed_count += 1

        # Compare
        editable_fields = [f for f in fields if f.is_editable and f.include_in_import]
        for row in data_rows:
            if row["errors"]:
                continue
            pk_key = row["pk_key"]
            original = db_pk_map.get(pk_key)
            if original is None:
                # PK not found in DB (new row - but MVP doesn't support insert)
                row["errors"].append({
                    "row": row["row_num"], "field": ",".join(pk_fields),
                    "type": "pk_not_found", "value": pk_key,
                    "message": f"第{row['row_num']}行 主键在数据库中不存在（首版不支持新增记录）",
                })
                errors.append(row["errors"][-1])
                failed_count += 1
                continue

            has_diff = False
            for ef in editable_fields:
                fn = ef.field_name
                new_val = row["data"].get(fn)
                old_val = original.get(fn)
                if new_val != old_val:
                    has_diff = True
                    diff_rows.append({
                        "row_num": row["row_num"],
                        "pk_key": pk_key,
                        "field_name": fn,
                        "field_alias": ef.field_alias or fn,
                        "old_value": old_val,
                        "new_value": new_val,
                        "status": "changed",
                    })
            if has_diff:
                passed_count += 1
            else:
                passed_count += 1  # no change but still valid

    # ── 8. Save import task log ──
    batch_no = _gen_batch("IMP")
    total_rows = len(data_rows)
    actual_failed = len([r for r in data_rows if r["errors"]])
    actual_passed = total_rows - actual_failed

    validation_status = "success" if actual_failed == 0 else ("failed" if actual_passed == 0 else "partial")

    log = ImportTaskLog(
        import_batch_no=batch_no,
        table_config_id=tc.id,
        datasource_id=tc.datasource_id,
        related_export_batch_no=meta.get("export_batch_no"),
        import_file_name=file_name,
        import_file_path=save_path,
        template_version=meta_version,
        total_row_count=total_rows,
        passed_row_count=actual_passed,
        warning_row_count=len(warnings),
        failed_row_count=actual_failed,
        diff_row_count=len(diff_rows),
        validation_status=validation_status,
        validation_message=f"总计 {total_rows} 行，通过 {actual_passed}，失败 {actual_failed}，差异 {len(diff_rows)} 处",
        error_detail_json=json.dumps(errors, ensure_ascii=False) if errors else None,
        import_status="validated",
        operator_user=_get_username(user),
    )
    db.add(log)
    db.flush()
    log_operation(db, "数据维护", "导入模板", validation_status,
                  target_id=tc.id, target_name=tc.table_name,
                  message=f"导入模板 {file_name}，{total_rows} 行，通过 {actual_passed}，失败 {actual_failed}",
                  operator=_get_username(user))

    # Store diff data in a temp JSON file for later retrieval
    diff_file = os.path.join(UPLOAD_DIR, f"diff_{log.id}.json")
    diff_data = {
        "diff_rows": diff_rows,
        "import_data": [{"row_num": r["row_num"], "data": r["data"], "pk_key": r["pk_key"]}
                        for r in data_rows if not r["errors"]],
    }
    with open(diff_file, "w", encoding="utf-8") as f:
        json.dump(diff_data, f, ensure_ascii=False)

    db.commit()

    return {
        "task_id": log.id,
        "import_batch_no": batch_no,
        "validation_status": validation_status,
        "total": total_rows,
        "passed": actual_passed,
        "failed": actual_failed,
        "warnings": len(warnings),
        "diff_count": len(diff_rows),
        "errors": errors[:100],  # limit response size
        "warnings_list": warnings[:50],
    }


# ─────────────────────────────────────────────
# P2-8: 差异预览
# ─────────────────────────────────────────────

@router.get("/import-tasks/{task_id}/diff")
def get_import_diff(task_id: int, db: Session = Depends(get_db), user: UserAccount = Depends(get_current_user)):
    """返回原值/新值对比数据。"""
    task = db.query(ImportTaskLog).filter(ImportTaskLog.id == task_id).first()
    if not task:
        raise HTTPException(404, "导入任务不存在")

    tc = db.query(TableConfig).filter(TableConfig.id == task.table_config_id).first()
    ds = db.query(DatasourceConfig).filter(DatasourceConfig.id == task.datasource_id).first()

    diff_file = os.path.join(UPLOAD_DIR, f"diff_{task_id}.json")
    if not os.path.isfile(diff_file):
        raise HTTPException(404, "差异数据不存在，请重新导入")

    with open(diff_file, "r", encoding="utf-8") as f:
        diff_data = json.load(f)

    return {
        "task_id": task_id,
        "import_batch_no": task.import_batch_no,
        "table_config_id": task.table_config_id,
        "table_name": tc.table_name if tc else None,
        "table_alias": tc.table_alias if tc else None,
        "config_version": task.template_version,
        "operator_user": task.operator_user,
        "import_time": task.created_at.isoformat() if task.created_at else None,
        "total_rows": task.total_row_count,
        "passed_rows": task.passed_row_count,
        "failed_rows": task.failed_row_count,
        "diff_count": task.diff_row_count,
        "diff_rows": diff_data.get("diff_rows", []),
        "validation_status": task.validation_status,
    }


@router.get("/import-tasks/{task_id}")
def get_import_task(task_id: int, db: Session = Depends(get_db), user: UserAccount = Depends(get_current_user)):
    """获取导入任务详情。"""
    task = db.query(ImportTaskLog).filter(ImportTaskLog.id == task_id).first()
    if not task:
        raise HTTPException(404, "导入任务不存在")

    errors = []
    if task.error_detail_json:
        try:
            errors = json.loads(task.error_detail_json)
        except json.JSONDecodeError:
            pass

    return {
        "task_id": task.id,
        "import_batch_no": task.import_batch_no,
        "table_config_id": task.table_config_id,
        "datasource_id": task.datasource_id,
        "import_file_name": task.import_file_name,
        "template_version": task.template_version,
        "total_row_count": task.total_row_count,
        "passed_row_count": task.passed_row_count,
        "warning_row_count": task.warning_row_count,
        "failed_row_count": task.failed_row_count,
        "diff_row_count": task.diff_row_count,
        "validation_status": task.validation_status,
        "validation_message": task.validation_message,
        "import_status": task.import_status,
        "operator_user": task.operator_user,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "errors": errors,
    }


# ─────────────────────────────────────────────
# P2-10: 安全回写
# ─────────────────────────────────────────────

@router.post("/import-tasks/{task_id}/writeback")
def writeback(task_id: int, db: Session = Depends(get_db), user: UserAccount = Depends(require_role("admin", "operator"))):
    """执行回写：写前全表备份 → UPDATE → 记录日志。"""
    task = db.query(ImportTaskLog).filter(ImportTaskLog.id == task_id).first()
    if not task:
        raise HTTPException(404, "导入任务不存在")
    if task.import_status not in ("validated",):
        raise HTTPException(400, f"导入任务状态不允许回写: {task.import_status}")
    if task.validation_status == "failed":
        raise HTTPException(400, "校验全部失败，无法回写")

    tc = _get_tc(db, task.table_config_id)
    ds = _get_ds(db, tc.datasource_id)
    pwd = decrypt_password(ds.password_encrypted)
    fields = _get_fields(db, tc.id)
    field_name_map = {f.field_name: f for f in fields}
    pk_fields_list = [p.strip() for p in tc.primary_key_fields.split(",")]

    # Load diff data
    diff_file = os.path.join(UPLOAD_DIR, f"diff_{task_id}.json")
    if not os.path.isfile(diff_file):
        raise HTTPException(404, "差异数据不存在，请重新导入")
    with open(diff_file, "r", encoding="utf-8") as f:
        diff_data = json.load(f)

    import_rows = diff_data.get("import_data", [])
    if not import_rows:
        raise HTTPException(400, "没有可回写的数据")

    wb_batch = _gen_batch("WB")
    bk_batch = _gen_batch("BK")
    started_at = datetime.utcnow()

    conn = _connect(
        ds.db_type, ds.host, ds.port, ds.username, pwd,
        tc.db_name, tc.schema_name, ds.charset, ds.connect_timeout_seconds or 10,
    )
    try:
        cur = conn.cursor()
        qt = _qualified_table(ds.db_type, tc.table_name, tc.schema_name)

        # ── Step 1: Full table backup ──
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        backup_table_name = f"{tc.table_name}_bak_{ts}"

        if ds.db_type == "mysql":
            cur.execute(f"CREATE TABLE `{backup_table_name}` AS SELECT * FROM {qt}")
        elif ds.db_type == "postgresql":
            sch = tc.schema_name or "public"
            cur.execute(f'CREATE TABLE "{sch}"."{backup_table_name}" AS SELECT * FROM {qt}')
        elif ds.db_type == "sqlserver":
            sch = tc.schema_name or "dbo"
            cur.execute(f"SELECT * INTO [{sch}].[{backup_table_name}] FROM {qt}")

        # Count backup rows
        if ds.db_type == "mysql":
            cur.execute(f"SELECT COUNT(*) FROM `{backup_table_name}`")
        elif ds.db_type == "postgresql":
            cur.execute(f'SELECT COUNT(*) FROM "{sch}"."{backup_table_name}"')
        elif ds.db_type == "sqlserver":
            cur.execute(f"SELECT COUNT(*) FROM [{sch}].[{backup_table_name}]")
        backup_count = cur.fetchone()[0]

        conn.commit()

        # Record backup version
        backup_rec = TableBackupVersion(
            backup_version_no=bk_batch,
            table_config_id=tc.id,
            datasource_id=tc.datasource_id,
            backup_table_name=backup_table_name,
            source_table_name=tc.table_name,
            source_db_name=tc.db_name,
            source_schema_name=tc.schema_name,
            trigger_type="triggered_by_writeback",
            related_writeback_batch_no=wb_batch,
            record_count=backup_count,
            storage_status="valid",
            can_rollback=1,
            backup_started_at=started_at,
            backup_finished_at=datetime.utcnow(),
            operator_user=_get_username(user),
        )
        db.add(backup_rec)
        db.flush()

        # Clean old backups (keep only backup_keep_count)
        old_backups = (
            db.query(TableBackupVersion)
            .filter(
                TableBackupVersion.table_config_id == tc.id,
                TableBackupVersion.storage_status == "valid",
            )
            .order_by(TableBackupVersion.id.desc())
            .all()
        )
        if len(old_backups) > tc.backup_keep_count:
            for old_bk in old_backups[tc.backup_keep_count:]:
                # Drop backup table in remote DB
                try:
                    if ds.db_type == "mysql":
                        cur.execute(f"DROP TABLE IF EXISTS `{old_bk.backup_table_name}`")
                    elif ds.db_type == "postgresql":
                        sch_old = old_bk.source_schema_name or "public"
                        cur.execute(f'DROP TABLE IF EXISTS "{sch_old}"."{old_bk.backup_table_name}"')
                    elif ds.db_type == "sqlserver":
                        sch_old = old_bk.source_schema_name or "dbo"
                        cur.execute(f"IF OBJECT_ID('[{sch_old}].[{old_bk.backup_table_name}]') IS NOT NULL DROP TABLE [{sch_old}].[{old_bk.backup_table_name}]")
                    conn.commit()
                except Exception:
                    pass
                old_bk.storage_status = "expired"
                old_bk.can_rollback = 0

        # ── Step 2: Execute UPDATEs ──
        success_count = 0
        fail_count = 0
        failed_details: List[dict] = []
        editable_fields = [f for f in fields if f.is_editable and f.include_in_import]

        for irow in import_rows:
            row_data = irow["data"]
            pk_key = irow["pk_key"]

            # Build SET clause from editable fields that changed
            set_parts = []
            set_params = []
            for ef in editable_fields:
                fn = ef.field_name
                if fn in row_data:
                    new_val = row_data[fn]
                    if ds.db_type == "sqlserver":
                        set_parts.append(f"[{fn}] = ?")
                    elif ds.db_type == "mysql":
                        set_parts.append(f"`{fn}` = %s")
                    else:
                        set_parts.append(f'"{fn}" = %s')
                    set_params.append(new_val)

            if not set_parts:
                continue

            # Build WHERE from PK
            where_parts = []
            where_params = []
            pk_vals = pk_key.split("|")
            for i, pkf in enumerate(pk_fields_list):
                pk_val = pk_vals[i] if i < len(pk_vals) else ""
                if ds.db_type == "sqlserver":
                    where_parts.append(f"CAST([{pkf}] AS NVARCHAR(MAX)) = ?")
                elif ds.db_type == "mysql":
                    where_parts.append(f"CAST(`{pkf}` AS CHAR) = %s")
                else:
                    where_parts.append(f'CAST("{pkf}" AS TEXT) = %s')
                where_params.append(pk_val)

            update_sql = f"UPDATE {qt} SET {', '.join(set_parts)} WHERE {' AND '.join(where_parts)}"
            try:
                cur.execute(update_sql, set_params + where_params)
                success_count += 1
            except Exception as e:
                fail_count += 1
                failed_details.append({
                    "row_num": irow["row_num"],
                    "pk_key": pk_key,
                    "error": str(e),
                })

        conn.commit()

        finished_at = datetime.utcnow()
        wb_status = "success" if fail_count == 0 else ("failed" if success_count == 0 else "partial")

        # Record writeback log
        wb_log = WritebackLog(
            writeback_batch_no=wb_batch,
            import_task_id=task_id,
            table_config_id=tc.id,
            datasource_id=tc.datasource_id,
            backup_version_no=bk_batch,
            total_row_count=len(import_rows),
            success_row_count=success_count,
            failed_row_count=fail_count,
            skipped_row_count=0,
            writeback_status=wb_status,
            writeback_message=f"成功 {success_count}，失败 {fail_count}",
            failed_detail_json=json.dumps(failed_details, ensure_ascii=False) if failed_details else None,
            operator_user=_get_username(user),
            started_at=started_at,
            finished_at=finished_at,
        )
        db.add(wb_log)
        log_operation(db, "数据维护", "执行回写", wb_status,
                      target_id=tc.id, target_name=tc.table_name,
                      message=f"回写 {wb_batch}，成功 {success_count}，失败 {fail_count}，备份 {bk_batch}",
                      operator=_get_username(user))

        # Update import task status
        task.import_status = "confirmed"
        task.updated_at = datetime.utcnow()

        db.commit()

        return {
            "writeback_batch_no": wb_batch,
            "backup_version_no": bk_batch,
            "status": wb_status,
            "total": len(import_rows),
            "success": success_count,
            "failed": fail_count,
            "backup_table": backup_table_name,
            "backup_record_count": backup_count,
            "operator_user": "admin",
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "failed_details": failed_details[:50],
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"回写失败: {str(e)}")
    finally:
        conn.close()
