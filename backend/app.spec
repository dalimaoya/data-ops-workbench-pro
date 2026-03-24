# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for 数据运维工作台 (Data Ops Workbench)
Usage:
  cd backend/
  pyinstaller app.spec
Output: dist/app/ directory containing the executable and all dependencies
"""

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# Collect all app submodules
app_hiddenimports = collect_submodules('app')

# Core hidden imports that PyInstaller may miss
extra_hiddenimports = [
    # FastAPI / Starlette / Uvicorn
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'uvloop',
    'httptools',
    'multipart',
    'multipart.multipart',
    # SQLAlchemy dialects
    'sqlalchemy.dialects.sqlite',
    'sqlalchemy.dialects.mysql',
    'sqlalchemy.dialects.mysql.pymysql',
    'sqlalchemy.dialects.postgresql',
    'sqlalchemy.dialects.postgresql.psycopg2',
    # NOTE: mssql/pyodbc excluded - requires system libodbc
    # 'sqlalchemy.dialects.mssql',
    # 'sqlalchemy.dialects.mssql.pyodbc',
    # Database drivers
    'pymysql',
    'aiosqlite',
    # NOTE: pyodbc excluded from hidden imports - requires system libodbc
    # Auth & crypto
    'passlib',
    'passlib.handlers',
    'passlib.handlers.bcrypt',
    'bcrypt',
    'cryptography',
    'cryptography.fernet',
    'jose',
    'jose.jwt',
    'jose.jws',
    # Excel
    'openpyxl',
    # Pydantic
    'pydantic',
    'pydantic_core',
    'pydantic.deprecated',
    'annotated_types',
    # Email validator (pydantic optional)
    'email_validator',
    # Captcha (Pillow)
    'PIL',
    'PIL.Image',
    'PIL.ImageDraw',
    'PIL.ImageFont',
    # Other
    'anyio',
    'anyio._backends',
    'anyio._backends._asyncio',
    'sniffio',
    'starlette',
    'starlette.responses',
    'starlette.routing',
    'starlette.middleware',
    'starlette.middleware.cors',
]

# Conditionally add psycopg2 / pyodbc if installed
for optional_mod in ['psycopg2']:
    try:
        __import__(optional_mod)
        extra_hiddenimports.append(optional_mod)
    except ImportError:
        print(f"[INFO] {optional_mod} not installed, skipping")

hiddenimports = list(set(app_hiddenimports + extra_hiddenimports))

# Data files: include the web/ directory (frontend build output)
# Use os.path.join for cross-platform path separators (Linux / vs Windows \)
datas = []
web_dir = os.path.join(SPECPATH, 'web')
if os.path.isdir(web_dir):
    datas.append((web_dir, 'web'))
else:
    print("[WARN] web/ directory not found - frontend will not be bundled")

# Include i18n locale JSON files
i18n_dir = os.path.join(SPECPATH, 'app', 'i18n', 'locales')
if os.path.isdir(i18n_dir):
    datas.append((i18n_dir, os.path.join('app', 'i18n', 'locales')))
else:
    print("[WARN] app/i18n/locales/ not found - translations will not be bundled")

a = Analysis(
    ['app_entry.py'],
    pathex=[SPECPATH],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', '_tkinter', 'matplotlib', 'scipy', 'numpy',
        'IPython', 'notebook', 'pytest', 'setuptools',
        'pyodbc',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='app',
)
