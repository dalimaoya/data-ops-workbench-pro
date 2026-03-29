# 数据运维工作台 (Data Ops Workbench)

> 不碰数据库客户端，也能安全修订结果表。

[![GitHub](https://img.shields.io/badge/GitHub-dalimaoya-blue?logo=github)](https://github.com/dalimaoya/data-ops-workbench)
[![Gitee](https://img.shields.io/badge/Gitee-dalimaoya-red?logo=gitee)](https://gitee.com/dalimaoya/data-ops-workbench)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-green.svg)](https://www.gnu.org/licenses/agpl-3.0.html)

---

## 这是什么？

数据运维工作台是一个**轻量级的数据安全修订平台**，专为政企项目交付和运维现场设计。让普通运维和业务人员在完全不接触数据库客户端的前提下，通过「平台模板 + 校验预览 + 安全回写」的标准流程，完成结果数据表的日常维护。

**核心理念：研发配置一次，普通用户反复安全使用。**

<!-- 功能截图（后续补充）-->

---

## 核心功能

### 底座能力

| 功能 | 说明 |
|---|---|
| **数据源管理** | 支持 7 种数据库：MySQL / PostgreSQL / SQL Server / Oracle / 达梦 / 人大金仓 / SQLite |
| **纳管表配置** | 选表、自动拉取字段、配置语义与编辑规则、复合主键 |
| **安全回写** | 写前校验 → 差异预览 → 自动备份 → 执行写入 → 日志留痕 → 可回退 |
| **平台模板** | 所有修订通过受控 Excel 模板完成，嵌入元信息防篡改 |
| **在线编辑** | 页面直接修改少量数据，差异预览确认 |
| **统一认证** | 微信扫码 + 账号密码双登录，自动网络检测切换 |
| **四级角色** | 超级管理员 / 管理员 / 操作员 / 只读，数据源级权限隔离 |
| **中英文双语** | 完整国际化，一键切换 |
| **日志审计** | 全类型操作日志 + 逐字段变更明细 |
| **版本回退** | 任意备份版本一键回退 |

### 内置插件（7 个，始终可用）

| 插件 | 功能 |
|---|---|
| **备份迁移** | 一键导出/导入平台配置，敏感信息脱敏 |
| **数据库维护** | 批量纳管、批量导出、多表变更对比 |
| **库表管理** | 数据库表结构浏览和管理 |
| **SQL 控制台** | 在线 SQL 查询（只读） |
| **健康巡检** | 数据源连接状态和结构变化检测 |
| **通知中心** | 站内通知：回写/审批/导出事件 |
| **定时任务** | 定时巡检、备份、导出 |

### 扩展插件（12 个，需试用/激活）

| 插件 | 功能 |
|---|---|
| **AI 智能助手** | 9 大模型预设，智能字段配置、自然语言查询、AI 批量修改 |
| **AI 数据预填** | 基于历史数据 AI 预测下一期数据 |
| **智能导入** | AI 辅助的模板映射和导入 |
| **审批中心** | 回写审批流 |
| **数据趋势** | 数据变更趋势分析 |
| **数据对比** | 数据差异对比分析 |
| **模板市场** | 共享配置模板 |
| **通知推送** | 企业微信/钉钉/飞书/邮件 |
| **Webhook** | 外部系统回调集成 |
| **数据脱敏** | 敏感数据脱敏导出 |
| **审计报告** | PDF 审计报告导出 |
| **AI 预测** | 数据预测分析 |

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Ant Design 6 + Vite 8 |
| 后端 | Python FastAPI + SQLAlchemy 2.0 + Pydantic 2 |
| 平台数据库 | SQLite（零配置，随文件夹走） |
| 认证 | JWT + bcrypt + 统一认证平台（微信扫码） |
| 桌面窗口 | pywebview（Windows 安装包） |
| 国际化 | react-i18next + 后端 i18n |

---

## 快速开始

### Linux / macOS

```bash
chmod +x start.sh
./start.sh
```

### Windows

双击 `DataOpsWorkbench.exe`（安装包版本）或运行 `start.bat`（文件夹版本）。

### 启动后

| 项目 | 地址 |
|---|---|
| 系统首页 | http://localhost:9590 |
| API 文档 | http://localhost:9590/docs |
| 默认账号 | `admin` / `dalimaoya`（超级管理员） |

> 首次登录后请立即修改默认密码！

---

## 支持的数据库

| 数据库 | 版本要求 | 默认端口 |
|---|---|---|
| MySQL | 5.7+ / 8.0+ | 3306 |
| PostgreSQL | 10+ | 5432 |
| SQL Server | 2012+ | 1433 |
| Oracle | 11g+ | 1521 |
| 达梦 (DM) | DM8 | 5236 |
| 人大金仓 (KingbaseES) | V8+ | 54321 |
| SQLite | 3.x | — |

---

## 部署方式

| 方式 | 说明 |
|---|---|
| **本地文件夹** | 解压即用，零环境依赖（推荐） |
| **Windows 安装包** | pywebview 桌面窗口，双击运行 |
| **源码运行** | 需 Python 3.9+ 和 Node.js 18+ |

交付物是一个完整的文件夹，拷贝到目标机器即可运行。支持单机部署、内网服务器、局域网多人访问。

---

## License

本项目采用 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) 许可协议。

- 允许学习、交流、研究
- 允许修改和分发（必须以相同协议开源）
- 任何形式的部署（包括网络服务）都必须开源全部源代码
- 如需商业授权请联系作者

---

## 链接

- **GitHub:** [dalimaoya/data-ops-workbench](https://github.com/dalimaoya/data-ops-workbench)
- **Gitee 镜像:** [dalimaoya/data-ops-workbench](https://gitee.com/dalimaoya/data-ops-workbench)
- **Issues:** [GitHub Issues](https://github.com/dalimaoya/data-ops-workbench/issues) | [Gitee Issues](https://gitee.com/dalimaoya/data-ops-workbench/issues)
