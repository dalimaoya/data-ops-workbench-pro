@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Data Ops Workbench - Build

echo ============================================
echo   数据运维工作台 - 打包构建 (Windows)
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"
set "WEB_DIR=%BACKEND_DIR%\web"
set "DIST_DIR=%SCRIPT_DIR%dist\data-ops-workbench"
set "VENV_DIR=%BACKEND_DIR%\.venv"

:: Step 1: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo [OK] %%i

:: Step 2: Setup venv
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [INFO] Creating virtual environment...
    python -m venv "%VENV_DIR%"
)
call "%VENV_DIR%\Scripts\activate.bat"

echo [INFO] Installing dependencies...
python -m pip install -q --upgrade pip
python -m pip install -q -r "%BACKEND_DIR%\requirements.txt"
python -m pip install -q pyinstaller
echo [OK] Dependencies installed

:: Step 3: Build frontend
if not exist "%WEB_DIR%\index.html" (
    echo [INFO] Building frontend...
    if exist "%FRONTEND_DIR%\package.json" (
        cd /d "%FRONTEND_DIR%"
        where pnpm >nul 2>&1
        if !errorlevel! equ 0 (
            pnpm install
            pnpm run build
        ) else (
            npm install
            npm run build
        )
        cd /d "%SCRIPT_DIR%"
    ) else (
        echo [ERROR] No frontend source and no build output
        pause
        exit /b 1
    )
) else (
    echo [OK] Frontend already built
)

:: Step 4: PyInstaller
echo [INFO] Running PyInstaller...
cd /d "%BACKEND_DIR%"
if exist "build" rmdir /s /q build
if exist "dist" rmdir /s /q dist

pyinstaller app.spec --noconfirm
if !errorlevel! neq 0 (
    echo [ERROR] PyInstaller failed
    pause
    exit /b 1
)
echo [OK] PyInstaller build complete

:: Step 5: Assemble release
echo [INFO] Assembling release directory...
if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
mkdir "%DIST_DIR%\server"

xcopy /E /I /Q "%BACKEND_DIR%\dist\app" "%DIST_DIR%\server\app"
copy "%SCRIPT_DIR%start.sh" "%DIST_DIR%\start.sh"
copy "%SCRIPT_DIR%start.bat" "%DIST_DIR%\start.bat"
copy "%SCRIPT_DIR%README.md" "%DIST_DIR%\README.md"
mkdir "%DIST_DIR%\data"
mkdir "%DIST_DIR%\backups"
mkdir "%DIST_DIR%\logs"

echo.
echo ============================================
echo   [OK] Build complete!
echo   Output: %DIST_DIR%
echo ============================================
pause
