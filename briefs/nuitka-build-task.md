# 任务：Nuitka 原生编译打包替换 PyInstaller

## 背景
当前 build.sh 使用 PyInstaller（block_cipher=None）打包，字节码未加密，可被反编译还原源码。
用户要求升级为 Nuitka 原生编译方式，实现强代码保护。

## 目标
1. 用 Nuitka 替代 PyInstaller，将后端 Python 代码编译为原生二进制
2. 功能完全等价：所有 19 个插件正常加载，全接口可用
3. 性能不退化：启动时间和接口响应不明显变慢（可接受 ±10%）
4. 产出新的 build-nuitka.sh 脚本（保留原 build.sh 作为备份）
5. 产出 release 包格式不变：data-ops-workbench-v3.3.1-linux-x64.tar.gz

## 技术要点
- Nuitka 编译模式：--standalone --onefile 或 --standalone（目录模式）
- 需要处理的特殊依赖：
  - FastAPI / Uvicorn（ASGI 动态导入较多）
  - SQLAlchemy 方言（sqlite/mysql/postgresql）
  - pymysql / psycopg2
  - 前端静态文件（web/ 目录）需要 --include-data-dir 打入
  - 插件目录动态加载逻辑需确认兼容
- 编译后二进制不包含 .pyc，无法用常规工具反编译
- C 编译器依赖：gcc / g++，确认服务器已安装

## 验收标准
1. ✅ Nuitka 编译成功，产出可执行二进制
2. ✅ ./start.sh 启动正常，无报错
3. ✅ 19/19 插件加载通过
4. ✅ 核心接口验证通过（仪表盘、数据源、纳管表、日志、脱敏、通知、趋势、模板市场）
5. ✅ 启动时间对比 PyInstaller 版本无明显退化
6. ✅ release 包大小合理（预计与 PyInstaller 版本相当或略大）
7. ✅ 原 build.sh 保留不删除

## 交付物
- `/root/.openclaw/workspace/projects/data-ops-workbench/build-nuitka.sh`
- `/root/.openclaw/workspace/projects/data-ops-workbench/release/data-ops-workbench-v3.3.1-linux-x64.tar.gz`
- 编译日志截图或摘要

## 优先级
高 — 用户明确要求

## 创建时间
2026-03-25
