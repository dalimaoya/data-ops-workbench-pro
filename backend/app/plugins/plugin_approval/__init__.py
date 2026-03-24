"""Plugin: Approval Workflow — 审批流"""

from fastapi import FastAPI


def register(app: FastAPI, manifest: dict):
    from app.routers.approvals import router
    app.include_router(router)
    print(f"[PLUGIN] {manifest['display_name']} v{manifest['version']} loaded")
