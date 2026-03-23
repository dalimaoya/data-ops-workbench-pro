"""FastAPI application entry point."""

import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, SessionLocal
from app.routers import datasource, table_config, field_config, data_maintenance, backup_version, logs
from app.routers import auth as auth_router
from app.routers import dashboard as dashboard_router
from app.routers import users as users_router
from app.routers import approvals as approvals_router
from app.utils.auth import init_default_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    Base.metadata.create_all(bind=engine)
    # Init default admin account
    db = SessionLocal()
    try:
        init_default_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="数据运维工作台",
    description="Data Ops Workbench API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
app.include_router(datasource.router)
app.include_router(table_config.router)
app.include_router(field_config.router)
app.include_router(data_maintenance.router)
app.include_router(backup_version.router)
app.include_router(logs.router)
app.include_router(users_router.router)
app.include_router(approvals_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Mount frontend static files (production)
# When frozen by PyInstaller, look for web/ in the bundle's _MEIPASS directory
if getattr(sys, 'frozen', False):
    _bundle_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    STATIC_DIR = os.path.join(_bundle_dir, "web")
else:
    STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
if os.path.isdir(STATIC_DIR):
    ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(ASSETS_DIR):
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(request: Request, full_path: str):
        # Skip API routes
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"detail": "Frontend not built yet"}
