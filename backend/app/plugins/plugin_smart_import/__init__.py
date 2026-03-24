"""Plugin: Smart Import Center — 智能数据导入中心"""

from fastapi import FastAPI


def register(app: FastAPI, manifest: dict):
    from app.routers.smart_import import router
    app.include_router(router)
    print(f"[PLUGIN] {manifest['display_name']} v{manifest['version']} loaded")
