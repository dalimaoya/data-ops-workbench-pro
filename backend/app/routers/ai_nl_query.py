"""AI Natural Language Query API — POST /api/ai/nl-query"""

import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TableConfig, FieldConfig, DatasourceConfig
from app.utils.auth import get_current_user
from app.ai.ai_engine import AIEngine
from app.ai.nl_query_engine import parse_nl_query_rules, parse_nl_query_llm

router = APIRouter(prefix="/api/ai", tags=["AI NL Query"])


# ── Schemas ──

class FieldContext(BaseModel):
    name: str
    display_name: Optional[str] = None
    type: Optional[str] = None
    enum_values: Optional[List[str]] = None


class NLQueryRequest(BaseModel):
    table_id: int
    query_text: str
    context: Optional[dict] = None  # { fields: [...], previous_filters: [...] }


class NLQueryFilter(BaseModel):
    field: str
    operator: str
    value: Optional[object] = None
    display: str


class NLQueryResponse(BaseModel):
    filters: List[dict]
    explanation: str
    confidence: float
    engine: Optional[str] = None


# ── Helpers ──

def _build_field_context(db: Session, table_config_id: int) -> list[dict]:
    """Build field context list from DB for a managed table."""
    fields = (
        db.query(FieldConfig)
        .filter(FieldConfig.table_config_id == table_config_id, FieldConfig.is_deleted == 0)
        .order_by(FieldConfig.field_order_no)
        .all()
    )
    result = []
    for f in fields:
        if not f.is_displayed:
            continue
        enum_vals = []
        if f.enum_options_json:
            try:
                enum_vals = json.loads(f.enum_options_json)
                if not isinstance(enum_vals, list):
                    enum_vals = []
            except (json.JSONDecodeError, TypeError):
                enum_vals = []

        result.append({
            "name": f.field_name,
            "display_name": f.field_alias or f.field_name,
            "type": f.db_data_type or "VARCHAR",
            "enum_values": enum_vals,
        })
    return result


# ── Endpoint ──

@router.post("/nl-query")
async def nl_query(
    body: NLQueryRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Parse natural language query into structured filter conditions."""
    # Validate table exists
    tc = db.query(TableConfig).filter(
        TableConfig.id == body.table_id,
        TableConfig.is_deleted == 0,
        TableConfig.status == "enabled",
    ).first()
    if not tc:
        raise HTTPException(404, "纳管表不存在或已禁用")

    query_text = (body.query_text or "").strip()
    if not query_text:
        raise HTTPException(400, "查询文本不能为空")

    # Build field context — prefer request context, fallback to DB
    if body.context and body.context.get("fields"):
        fields_ctx = body.context["fields"]
    else:
        fields_ctx = _build_field_context(db, body.table_id)

    previous_filters = []
    if body.context and body.context.get("previous_filters"):
        previous_filters = body.context["previous_filters"]

    # Check AI engine config
    engine = AIEngine(db)

    if not engine.is_enabled or not engine.is_feature_enabled("nl_query"):
        # AI disabled or nl_query feature off — use rules only
        result = parse_nl_query_rules(query_text, fields_ctx, previous_filters)
        return {"success": True, "data": result}

    # Try LLM if available
    llm_client = engine.get_llm_client()
    if llm_client:
        # LLM mode: try LLM first, falls back to rules internally
        result = await parse_nl_query_llm(query_text, fields_ctx, previous_filters, llm_client)
    else:
        # Builtin mode (no LLM configured)
        result = parse_nl_query_rules(query_text, fields_ctx, previous_filters)

    # If rules engine returned nothing useful, provide friendly message
    if not result.get("filters") and result.get("confidence", 0) == 0:
        result["explanation"] = "未能理解您的查询意图，请尝试用更具体的方式描述，例如：\"找出状态是停用的记录\" 或 \"最近7天更新过的数据\""

    return {"success": True, "data": result}
