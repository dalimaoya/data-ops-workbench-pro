@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title 数据运维工作台

echo ============================================
echo   数据运维工作台 Data Ops Workbench
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"
set "WEB_DIR=%BACKEND_DIR%\web"
set "DATA_DIR=%SCRIPT_DIR%data"
set "PORT=8580"

:: Step 1: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
echo ✅ 使用 %PY_VER%

:: Step 2: Create venv
set "VENV_DIR=%BACKEND_DIR%\.venv"
if not exist "%VENV_DIR%" (
    echo 📦 创建 Python 虚拟环境...
    python -m venv "%VENV_DIR%"
)

:: Activate venv
call "%VENV_DIR%\Scripts\activate.bat"
echo ✅ 虚拟环境已激活

:: Step 3: Install dependencies
echo 📦 安装后端依赖...
pip install -q --upgrade pip
pip install -q -r "%BACKEND_DIR%\requirements.txt"
echo ✅ 后端依赖安装完成

:: Step 4: Build frontend if needed
if not exist "%WEB_DIR%\index.html" (
    echo 🔨 前端未构建，开始构建...
    if exist "%FRONTEND_DIR%\package.json" (
        cd /d "%FRONTEND_DIR%"
        where pnpm >nul 2>&1
        if !errorlevel! equ 0 (
            pnpm install
            pnpm run build
        ) else (
            where npm >nul 2>&1
            if !errorlevel! equ 0 (
                npm install
                npm run build
            ) else (
                echo ⚠️  未找到 pnpm 或 npm，跳过前端构建
            )
        )
        cd /d "%SCRIPT_DIR%"
    )
) else (
    echo ✅ 前端已构建
)

:: Step 5: Initialize database
echo 🗄️  初始化数据库...
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
cd /d "%BACKEND_DIR%"
python -c "from app.database import engine, Base, SessionLocal; from app.models import *; Base.metadata.create_all(bind=engine); from app.utils.auth import init_default_admin; db = SessionLocal(); init_default_admin(db); db.close(); print('✅ 数据库初始化完成')"

:: Step 6: Start server
echo.
echo 🚀 启动后端服务...
echo ============================================
echo   访问地址: http://localhost:%PORT%
echo   默认账号: admin / admin123
echo   按 Ctrl+C 停止服务
echo ============================================
echo.

uvicorn app.main:app --host 0.0.0.0 --port %PORT%

pause
