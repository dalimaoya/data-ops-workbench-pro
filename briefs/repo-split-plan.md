# 仓库拆分与开源规划

## 一、拆分原则

| 原则 | 说明 |
|------|------|
| 框架开源，能力私有 | 通用插件框架和基础功能开源，AI 能力和高级业务插件私有 |
| 竞争壁垒不外泄 | AI 引擎、智能分析、预测等核心差异化能力保留在私有仓库 |
| 社区可用 | 开源部分独立可运行，社区拿到就能用，不依赖私有模块 |
| 内部文档不公开 | PRD、测试报告、任务派发、项目状态等不进公开仓库 |

## 二、仓库划分

### 公开仓库：`data-ops-workbench`（GitHub Public）

定位：开源数据运维工作台框架 + 基础插件集

```
data-ops-workbench/                    # 公开仓库
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI 入口
│   │   ├── database.py                # 数据库抽象层
│   │   ├── models.py                  # 基础数据模型
│   │   ├── plugin_loader.py           # 插件加载框架 ⭐ 核心开源价值
│   │   ├── schemas/                   # Pydantic schemas
│   │   ├── i18n/                      # 国际化
│   │   ├── routers/
│   │   │   ├── auth.py                # 认证
│   │   │   ├── dashboard.py           # 仪表盘
│   │   │   ├── datasource.py          # 数据源管理
│   │   │   ├── table_config.py        # 纳管表配置
│   │   │   ├── field_config.py        # 字段配置
│   │   │   ├── logs.py                # 日志
│   │   │   ├── users.py               # 用户管理
│   │   │   ├── notifications.py       # 通知
│   │   │   ├── health_check.py        # 健康检查
│   │   │   ├── backup_version.py      # 备份版本
│   │   │   ├── platform_backup.py     # 平台备份
│   │   │   ├── scheduler.py           # 调度器
│   │   │   └── batch_manage.py        # 批量管理
│   │   ├── utils/
│   │   │   ├── audit.py               # 审计
│   │   │   ├── auth.py                # 认证工具
│   │   │   ├── captcha.py             # 验证码
│   │   │   ├── db_connector.py        # 数据库连接器
│   │   │   ├── remote_db.py           # 远程数据库
│   │   │   ├── notifications.py       # 通知工具
│   │   │   └── permissions.py         # 权限
│   │   ├── scheduler/                 # 调度引擎
│   │   └── plugins/                   # 开源插件 ↓
│   │       ├── plugin_backup/         # 备份插件
│   │       ├── plugin_health_check/   # 健康检查
│   │       ├── plugin_audit_export/   # 审计导出
│   │       ├── plugin_db_manager/     # 数据库管理
│   │       ├── plugin_sql_console/    # SQL 控制台
│   │       ├── plugin_scheduler/      # 定时任务
│   │       ├── plugin_notification/   # 通知
│   │       ├── plugin_batch_ops/      # 批量操作
│   │       ├── plugin_report/         # 报表
│   │       └── plugin_webhook/        # Webhook
│   ├── app_entry.py
│   └── requirements.txt
├── frontend/                          # 完整前端（UI 不构成壁垒）
│   ├── src/
│   ├── package.json
│   └── ...
├── database/
│   ├── init/                          # 初始化脚本
│   ├── migrations/                    # 迁移脚本
│   └── seeds/                         # 种子数据
├── docker-compose.yml
├── Dockerfile
├── build.sh
├── start.sh / start.bat
├── README.md                          # 开源说明（重写）
├── LICENSE                            # AGPL-3.0（保留）
├── CONTRIBUTING.md                    # 贡献指南（新增）
├── docs/
│   ├── 使用手册.md
│   ├── 技术选型说明.md
│   ├── 插件架构设计.md
│   ├── 系统说明.md
│   └── CHANGELOG.md
└── tests/                             # 开源部分测试
```

**开源的 10 个插件（基础运维能力）：**
1. plugin_backup — 备份
2. plugin_health_check — 健康检查
3. plugin_audit_export — 审计导出
4. plugin_db_manager — 数据库管理
5. plugin_sql_console — SQL 控制台
6. plugin_scheduler — 定时任务
7. plugin_notification — 通知
8. plugin_batch_ops — 批量操作
9. plugin_report — 报表
10. plugin_webhook — Webhook

---

### 私有仓库：`data-ops-workbench-pro`（GitHub Private / Gitee Private）

定位：AI 能力 + 高级业务插件 + 内部项目管理文档

```
data-ops-workbench-pro/                # 私有仓库
├── plugins/                           # 私有插件（9 个）
│   ├── plugin_ai_assistant/           # AI 助手 ⭐
│   ├── plugin_ai_predict/             # AI 预测 ⭐
│   ├── plugin_smart_import/           # 智能导入 ⭐
│   ├── plugin_data_mask/              # 数据脱敏
│   ├── plugin_data_compare/           # 数据对比
│   ├── plugin_data_trend/             # 数据趋势
│   ├── plugin_template_market/        # 模板市场
│   ├── plugin_approval/               # 审批流
│   └── plugin_notify_push/            # 通知推送（高级）
├── ai/                                # AI 引擎核心 ⭐⭐⭐
│   ├── ai_client.py
│   ├── ai_config.py
│   ├── ai_engine.py
│   ├── batch_fill_engine.py
│   ├── file_parser.py
│   ├── nl_query_engine.py
│   ├── rules_engine.py
│   └── smart_import_engine.py
├── routers/                           # AI 相关路由
│   ├── ai_batch_fill.py
│   ├── ai_batch_fill_multi.py
│   ├── ai_config.py
│   ├── ai_impact_assess.py
│   ├── ai_indicator.py
│   ├── ai_log_analyze.py
│   ├── ai_nl_query.py
│   ├── ai_suggest.py
│   ├── ai_validate.py
│   ├── approvals.py
│   ├── data_maintenance.py
│   ├── smart_import.py
│   └── writeback_multi.py
├── utils/                             # 安全相关工具
│   ├── crypto.py                      # 加密工具
│   ├── security_middleware.py         # 安全中间件
│   └── sql_security.py               # SQL 安全
├── release/                           # 编译后发布包
│   └── *.tar.gz
├── build-nuitka.sh                    # Nuitka 编译脚本
├── docs/                              # 内部文档
│   ├── PRD.md
│   ├── AI功能设计-完整版.md
│   ├── AI功能规划-v1.md
│   ├── 安全加固需求.md
│   ├── 产品迭代计划-v1.1.md
│   ├── 开发任务拆解清单.md
│   ├── 决策记录.md
│   └── *测试报告*.md                  # 所有测试报告
├── briefs/                            # 任务派发
├── handoffs/                          # 交接文档
├── status/                            # 项目状态
└── README.md                          # 私有仓库说明
```

**私有的 9 个插件（AI + 高级业务能力）：**
1. plugin_ai_assistant — AI 对话助手 ⭐
2. plugin_ai_predict — AI 预测分析 ⭐
3. plugin_smart_import — 智能数据导入 ⭐
4. plugin_data_mask — 数据脱敏
5. plugin_data_compare — 数据对比
6. plugin_data_trend — 数据趋势分析
7. plugin_template_market — 模板市场
8. plugin_approval — 审批流程
9. plugin_notify_push — 高级通知推送

---

## 三、集成机制

私有插件如何加入开源框架运行：

```
# 部署目录结构
data-ops-workbench/                    # 从公开仓库 clone
└── backend/app/plugins/
    ├── plugin_backup/                 # 开源自带
    ├── plugin_health_check/           # 开源自带
    ├── ...
    ├── plugin_ai_assistant/           # ← 从私有仓库复制进来
    ├── plugin_ai_predict/             # ← 从私有仓库复制进来
    └── ...
```

- `plugin_loader.py` 是自动扫描机制，放进 plugins/ 目录就能加载
- 开源仓库独立运行时只有 10 个基础插件，功能完整
- 加入私有插件后变成完整 19 插件的 Pro 版本
- Nuitka 编译的发布包是全量 Pro 版，只在私有仓库产出

## 四、发布包管理

| 类型 | 存放位置 | 方式 |
|------|----------|------|
| 开源版源码 | GitHub Public | git push |
| 私有版源码 | GitHub Private / Gitee | git push |
| Pro 编译包 | GitHub Private → Releases | GitHub Release 附件上传 |
| 开源版编译包（可选） | GitHub Public → Releases | GitHub Release 附件上传 |

**不再把 .tar.gz 放进 git 仓库**，统一用 GitHub Releases 的附件功能。

## 五、.gitignore 调整

公开仓库新增排除：
```
# 私有插件（不应出现在公开仓库）
backend/app/plugins/plugin_ai_*/
backend/app/plugins/plugin_smart_import/
backend/app/plugins/plugin_data_mask/
backend/app/plugins/plugin_data_compare/
backend/app/plugins/plugin_data_trend/
backend/app/plugins/plugin_template_market/
backend/app/plugins/plugin_approval/
backend/app/plugins/plugin_notify_push/

# AI 引擎
backend/app/ai/

# 安全工具
backend/app/utils/crypto.py
backend/app/utils/security_middleware.py
backend/app/utils/sql_security.py

# 发布包
release/
dist/

# 内部文档
briefs/
handoffs/
status/
reviews/
artifacts/
```

## 六、确认方案：方案 C（2026-03-25 用户确认）

**策略：旧仓库转私有保留历史，新建干净公开仓库**

### 执行步骤

**阶段 1：等 Nuitka 编译完成**（维克托进行中）

**阶段 2：准备开源版代码**
1. 在本地准备一份只包含开源内容的干净代码目录
2. 移除 AI 引擎、私有插件、安全工具、内部文档
3. 只保留 10 个开源插件 + 框架 + 前端
4. 重写 README.md（开源项目说明 + 插件列表 + 使用方法 + 截图）
5. 新增 CONTRIBUTING.md（贡献指南）
6. 调整 .gitignore

**阶段 3：GitHub 仓库操作**（需用户在 GitHub 界面操作）
1. 把 `dalimaoya/data-ops-workbench` 在 Settings → Danger Zone 改为 **Private**
2. 同页面 Rename 为 `data-ops-workbench-pro`
3. 新建 `dalimaoya/data-ops-workbench` Public 仓库
4. 推送清理后的开源代码作为第一个 commit

**阶段 4：私有仓库整理**
1. 在私有仓库中整理目录结构
2. 发布包统一用 GitHub Releases 附件上传
3. Nuitka 编译脚本放入私有仓库
4. Gitee 同步策略：私有仓库同步到 Gitee 私有仓库

**阶段 5：验证**
1. 公开仓库 clone 后能独立运行（10 插件）
2. 私有插件复制到 plugins/ 后能变成完整 Pro 版
3. 公开仓库无任何敏感代码泄露

---

*创建时间：2026-03-25*
*状态：待用户确认后执行*
