"""Template Market — 模板市场"""

import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Text, DateTime, SmallInteger
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from app.database import get_db, engine, Base
from app.models import DatasourceConfig, UserAccount
from app.utils.auth import get_current_user, require_role
from app.utils.crypto import decrypt_password
from app.utils.remote_db import _connect
from app.utils.audit import log_operation

_BJT = timezone(timedelta(hours=8))


def _now_bjt():
    return datetime.now(_BJT)


class CustomTemplate(Base):
    __tablename__ = "custom_template"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    category = Column(String(64), nullable=True)
    description = Column(String(500), nullable=True)
    tables_json = Column(Text, nullable=False)  # JSON array of table definitions
    is_builtin = Column(SmallInteger, nullable=False, default=0)
    created_by = Column(String(64), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=_now_bjt)


Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/api/template-market", tags=["template-market"])

# ─── Built-in templates ───
BUILTIN_TEMPLATES = [
    {
        "id": "economic_indicators",
        "name": "经济指标模板",
        "name_en": "Economic Indicators",
        "category": "经济",
        "description": "GDP、财政收入、固定资产投资等常见经济指标",
        "tables": [
            {
                "table_name": "tpl_gdp",
                "comment": "地区生产总值",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "region", "type": "VARCHAR(64)", "comment": "地区"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "quarter", "type": "VARCHAR(8)", "comment": "季度"},
                    {"name": "gdp_total", "type": "DECIMAL(18,2)", "comment": "GDP总量(亿元)"},
                    {"name": "gdp_primary", "type": "DECIMAL(18,2)", "comment": "第一产业(亿元)"},
                    {"name": "gdp_secondary", "type": "DECIMAL(18,2)", "comment": "第二产业(亿元)"},
                    {"name": "gdp_tertiary", "type": "DECIMAL(18,2)", "comment": "第三产业(亿元)"},
                    {"name": "growth_rate", "type": "DECIMAL(6,2)", "comment": "增速(%)"},
                ],
            },
            {
                "table_name": "tpl_fiscal_revenue",
                "comment": "财政收入",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "region", "type": "VARCHAR(64)", "comment": "地区"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "month", "type": "INTEGER", "comment": "月份"},
                    {"name": "general_revenue", "type": "DECIMAL(18,2)", "comment": "一般公共预算收入(万元)"},
                    {"name": "tax_revenue", "type": "DECIMAL(18,2)", "comment": "税收收入(万元)"},
                    {"name": "non_tax_revenue", "type": "DECIMAL(18,2)", "comment": "非税收入(万元)"},
                ],
            },
            {
                "table_name": "tpl_fixed_investment",
                "comment": "固定资产投资",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "region", "type": "VARCHAR(64)", "comment": "地区"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "total_investment", "type": "DECIMAL(18,2)", "comment": "投资总额(亿元)"},
                    {"name": "infrastructure", "type": "DECIMAL(18,2)", "comment": "基础设施(亿元)"},
                    {"name": "real_estate", "type": "DECIMAL(18,2)", "comment": "房地产(亿元)"},
                    {"name": "manufacturing", "type": "DECIMAL(18,2)", "comment": "制造业(亿元)"},
                ],
            },
        ],
    },
    {
        "id": "population",
        "name": "人口统计模板",
        "name_en": "Population Statistics",
        "category": "人口",
        "description": "人口总量、出生率、城镇化率等人口统计数据",
        "tables": [
            {
                "table_name": "tpl_population",
                "comment": "人口统计",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "region", "type": "VARCHAR(64)", "comment": "地区"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "total_population", "type": "DECIMAL(12,2)", "comment": "总人口(万人)"},
                    {"name": "urban_population", "type": "DECIMAL(12,2)", "comment": "城镇人口(万人)"},
                    {"name": "rural_population", "type": "DECIMAL(12,2)", "comment": "乡村人口(万人)"},
                    {"name": "birth_rate", "type": "DECIMAL(6,2)", "comment": "出生率(‰)"},
                    {"name": "death_rate", "type": "DECIMAL(6,2)", "comment": "死亡率(‰)"},
                    {"name": "urbanization_rate", "type": "DECIMAL(6,2)", "comment": "城镇化率(%)"},
                ],
            },
        ],
    },
    {
        "id": "government_service",
        "name": "政务服务模板",
        "name_en": "Government Services",
        "category": "政务",
        "description": "政务服务事项、办件量、好评率等",
        "tables": [
            {
                "table_name": "tpl_gov_service",
                "comment": "政务服务统计",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "department", "type": "VARCHAR(128)", "comment": "部门"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "month", "type": "INTEGER", "comment": "月份"},
                    {"name": "total_items", "type": "INTEGER", "comment": "事项总数"},
                    {"name": "online_items", "type": "INTEGER", "comment": "可网办事项"},
                    {"name": "handled_count", "type": "INTEGER", "comment": "办件量"},
                    {"name": "online_rate", "type": "DECIMAL(6,2)", "comment": "网办率(%)"},
                    {"name": "satisfaction_rate", "type": "DECIMAL(6,2)", "comment": "好评率(%)"},
                ],
            },
        ],
    },
    {
        "id": "education",
        "name": "教育数据模板",
        "name_en": "Education Data",
        "category": "教育",
        "description": "学校数、在校生数、师生比等教育统计",
        "tables": [
            {
                "table_name": "tpl_education",
                "comment": "教育统计",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "region", "type": "VARCHAR(64)", "comment": "地区"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "school_level", "type": "VARCHAR(32)", "comment": "学段"},
                    {"name": "school_count", "type": "INTEGER", "comment": "学校数"},
                    {"name": "student_count", "type": "INTEGER", "comment": "在校生数"},
                    {"name": "teacher_count", "type": "INTEGER", "comment": "教师数"},
                    {"name": "graduate_count", "type": "INTEGER", "comment": "毕业生数"},
                ],
            },
        ],
    },
    {
        "id": "safety_production",
        "name": "安全生产模板",
        "name_en": "Safety Production",
        "category": "安全",
        "description": "安全生产事故、隐患排查、执法检查等",
        "tables": [
            {
                "table_name": "tpl_safety",
                "comment": "安全生产统计",
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "region", "type": "VARCHAR(64)", "comment": "地区"},
                    {"name": "year", "type": "INTEGER", "comment": "年份"},
                    {"name": "month", "type": "INTEGER", "comment": "月份"},
                    {"name": "accident_count", "type": "INTEGER", "comment": "事故起数"},
                    {"name": "death_count", "type": "INTEGER", "comment": "死亡人数"},
                    {"name": "hazard_found", "type": "INTEGER", "comment": "隐患排查数"},
                    {"name": "hazard_fixed", "type": "INTEGER", "comment": "隐患整改数"},
                    {"name": "inspection_count", "type": "INTEGER", "comment": "执法检查次数"},
                ],
            },
        ],
    },
]


@router.get("/templates")
def list_templates(db: Session = Depends(get_db), user: UserAccount = Depends(get_current_user)):
    """List all templates (builtin + custom)."""
    result = []
    for t in BUILTIN_TEMPLATES:
        result.append({
            "id": t["id"],
            "name": t["name"],
            "name_en": t.get("name_en", t["name"]),
            "category": t["category"],
            "description": t["description"],
            "table_count": len(t["tables"]),
            "is_builtin": True,
        })
    # Custom templates
    customs = db.query(CustomTemplate).all()
    for c in customs:
        tables = json.loads(c.tables_json) if c.tables_json else []
        result.append({
            "id": f"custom_{c.id}",
            "name": c.name,
            "name_en": c.name,
            "category": c.category or "自定义",
            "description": c.description or "",
            "table_count": len(tables),
            "is_builtin": False,
        })
    return {"templates": result}


@router.get("/templates/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db), user: UserAccount = Depends(get_current_user)):
    """Preview a template's table structures."""
    if template_id.startswith("custom_"):
        cid = int(template_id.replace("custom_", ""))
        ct = db.query(CustomTemplate).filter(CustomTemplate.id == cid).first()
        if not ct:
            raise HTTPException(404, "模板不存在")
        return {"template": {"name": ct.name, "tables": json.loads(ct.tables_json)}}
    for t in BUILTIN_TEMPLATES:
        if t["id"] == template_id:
            return {"template": t}
    raise HTTPException(404, "模板不存在")


class ImportTemplateRequest(BaseModel):
    template_id: str
    datasource_id: int
    table_prefix: str = ""
    schema_name: Optional[str] = None


def _type_to_sql(db_type: str, col_type: str) -> str:
    """Convert generic type to DB-specific SQL type."""
    upper = col_type.upper()
    if db_type == "mysql":
        if "INTEGER" in upper and "PRIMARY" not in upper:
            return "INT"
        return col_type
    elif db_type in ("postgresql", "kingbase"):
        if upper.startswith("DECIMAL"):
            return col_type.replace("DECIMAL", "NUMERIC")
        return col_type
    return col_type


@router.post("/import")
def import_template(
    body: ImportTemplateRequest,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(require_role("admin")),
):
    """Import template: create tables in the specified datasource."""
    # Find template
    tables = None
    if body.template_id.startswith("custom_"):
        cid = int(body.template_id.replace("custom_", ""))
        ct = db.query(CustomTemplate).filter(CustomTemplate.id == cid).first()
        if ct:
            tables = json.loads(ct.tables_json)
    else:
        for t in BUILTIN_TEMPLATES:
            if t["id"] == body.template_id:
                tables = t["tables"]
                break
    if not tables:
        raise HTTPException(404, "模板不存在")

    ds = db.query(DatasourceConfig).filter(DatasourceConfig.id == body.datasource_id, DatasourceConfig.is_deleted == 0).first()
    if not ds:
        raise HTTPException(404, "数据源不存在")

    pwd = decrypt_password(ds.password_encrypted)
    conn = _connect(ds.db_type, ds.host, ds.port, ds.username, pwd,
                    ds.database_name, body.schema_name, ds.charset, ds.connect_timeout_seconds or 10)

    created = []
    errors = []
    try:
        cur = conn.cursor()
        for tbl in tables:
            real_name = f"{body.table_prefix}{tbl['table_name']}" if body.table_prefix else tbl["table_name"]
            cols_sql = []
            for col in tbl["columns"]:
                col_def = f"{col['name']} {_type_to_sql(ds.db_type, col['type'])}"
                if col.get("primary_key"):
                    if ds.db_type == "mysql":
                        col_def += " AUTO_INCREMENT PRIMARY KEY"
                    elif ds.db_type in ("postgresql", "kingbase"):
                        col_def = f"{col['name']} SERIAL PRIMARY KEY"
                    elif ds.db_type == "sqlite":
                        col_def = f"{col['name']} INTEGER PRIMARY KEY AUTOINCREMENT"
                    else:
                        col_def += " PRIMARY KEY"
                cols_sql.append(col_def)
            ddl = f"CREATE TABLE {real_name} ({', '.join(cols_sql)})"
            try:
                cur.execute(ddl)
                created.append(real_name)
            except Exception as e:
                errors.append({"table": real_name, "error": str(e)})
        conn.commit()
    finally:
        conn.close()

    log_operation(db, "模板市场", "导入模板", "success",
                  message=f"导入 {len(created)} 张表, 失败 {len(errors)} 张",
                  operator=user.username)

    return {"created": created, "errors": errors}


class SaveTemplateRequest(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    tables: list


@router.post("/save-custom")
def save_custom_template(
    body: SaveTemplateRequest,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(require_role("admin")),
):
    """Save a custom template."""
    ct = CustomTemplate(
        name=body.name,
        category=body.category,
        description=body.description,
        tables_json=json.dumps(body.tables, ensure_ascii=False),
        created_by=user.username,
    )
    db.add(ct)
    db.commit()
    return {"success": True, "id": ct.id}
