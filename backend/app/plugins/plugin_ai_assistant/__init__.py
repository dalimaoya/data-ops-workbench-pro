"""Plugin: AI Smart Assistant — AI 智能助手全功能"""

from fastapi import FastAPI


def register(app: FastAPI, manifest: dict):
    from app.routers.ai_config import router as ai_config_router
    from app.routers.ai_suggest import router as ai_suggest_router
    from app.routers.ai_validate import router as ai_validate_router
    from app.routers.ai_nl_query import router as ai_nl_query_router
    from app.routers.ai_batch_fill import router as ai_batch_fill_router
    from app.routers.ai_batch_fill_multi import router as ai_batch_fill_multi_router
    from app.routers.ai_log_analyze import router as ai_log_analyze_router
    from app.routers.ai_impact_assess import router as ai_impact_assess_router
    from app.routers.ai_indicator import router as ai_indicator_router

    app.include_router(ai_config_router)
    app.include_router(ai_suggest_router)
    app.include_router(ai_validate_router)
    app.include_router(ai_nl_query_router)
    app.include_router(ai_batch_fill_router)
    app.include_router(ai_batch_fill_multi_router)
    app.include_router(ai_log_analyze_router)
    app.include_router(ai_impact_assess_router)
    app.include_router(ai_indicator_router)

    print(f"[PLUGIN] {manifest['display_name']} v{manifest['version']} loaded")
