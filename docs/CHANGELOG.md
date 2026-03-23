# CHANGELOG

---

## v1.2.0 — 2026-03-23 模板安全加固

### 模板 Excel 保护机制
- 表头行（第一行）锁定，不可修改不可删除
- 主键列已有数据单元格锁定只读
- 可编辑字段的数据区域正常可编辑
- 工作表保护启用：禁止删除行/列、禁止插入列
- 模板底部预留 50 行空白行（为将来新增行功能做准备）
- meta sheet 新增 field_aliases 供导入校验

### 导入校验增强
- 列数校验：上传文件列数与模板定义不一致时 400 阻断
- 列名校验：逐列比对列头名称，不匹配报错并指出具体哪列
- 主键不可变校验：上传数据的主键在数据库中不存在时标记错误

---

## v1.1.0 — 2026-03-23 体验修正与基础完善

### 时间显示全局修正
- 新建 `formatBeijingTime` 工具函数（dayjs + Asia/Shanghai 时区）
- 覆盖范围：数据维护更新时间、版本回退备份时间（列表+详情+回退确认）、日志中心四个 Tab 所有时间字段
- 统一输出格式：`YYYY-MM-DD HH:mm:ss`

### 结构状态中文化
- `normal` → 正常、`changed` → 已变化、`error` → 检查失败
- 修正位置：DataBrowse、MaintenanceList（全部覆盖）
- TableConfigList、TableConfigDetail 已确认正确

### 新增关于页面
- 新增 `/about` 路由 + 侧边栏「关于」入口
- 展示：系统名称、版本号 v1.0.0、功能简介、GitHub/Gitee 链接、技术栈

### 其他
- README 增加 GitHub/Gitee 仓库链接和徽章
- Windows start.bat 修复：去除 emoji 避免 CMD 编码问题、pip 权限修复、uvicorn 调用方式修复
- Python 3.8 兼容性：所有 `X | None` 语法改为 `Optional[X]`

---

## v1.0.0 — 2026-03-23 MVP 正式版

基于 2026-03-19 ~ 2026-03-20 开发的 P0~P4 全阶段成果，首次正式存档发布。

---

## 2026-03-19 — P4 收尾与验收（维克托）

### P4-1 登录认证-后端
- 新增 `user_account` 表（id/username/password_hash/role/display_name/status/created_at/updated_at）
- 新增 `POST /api/auth/login` — JWT 登录接口
- 新增 `GET /api/auth/me` — 获取当前用户信息
- 三角色权限控制：admin（管理员）、operator（操作员）、readonly（只读用户）
  - 管理员：所有操作
  - 操作员：查看数据、下载模板、上传模板、预览差异、提交写入
  - 只读用户：查看数据、下载模板，不允许上传写入
- 预置管理员账号：admin / admin123
- 所有 API 接口加 JWT 校验中间件（HTTPBearer）
- `operator_user` 字段从 JWT token 中获取真实用户名（替代之前硬编码的 "admin"）
- JWT 有效期 24 小时

### P4-2 登录页-前端
- 登录页：用户名 + 密码 + 登录按钮，渐变背景样式
- 登录成功后跳转首页，失败显示错误信息
- 路由守卫（RequireAuth）：未登录自动跳转登录页
- 请求拦截器：自动携带 JWT token（Authorization: Bearer）
- 响应拦截器：401 自动清除 token 并跳转登录页
- Header 右侧显示用户名 + 角色 + 退出登录按钮
- AuthProvider 上下文管理登录状态

### P4-3 首页/总览-前端
- 工作台总览页，4 个卡片区：
  - 基础统计：数据源数量、已纳管表数量、今日导出/导入/回写次数（5 个统计卡片）
  - 最近操作：最近 10 条操作记录（列表展示，含模块/类型/状态/操作人/时间）
  - 待处理提醒：表结构变化提醒、导入失败提醒
  - 快捷入口：新建数据源、配置表、数据维护、查看日志、版本回退
- 欢迎语显示当前用户名和角色

### P4-4 首页数据-后端
- 新增 `GET /api/dashboard/stats` — 统计数据（数据源数/纳管表数/今日导出导入回写次数）
- 新增 `GET /api/dashboard/recent-operations` — 最近 10 条操作记录
- 新增 `GET /api/dashboard/alerts` — 待处理提醒（结构变化/导入失败）

### P4-5 全链路联调
- ✅ 登录→首页→数据源管理→表配置→数据维护→导出→导入→校验→差异→回写→日志→版本回退 全链路走通
- ✅ JWT 认证贯穿所有接口
- ✅ 前端请求自动携带 token
- ✅ 未登录自动跳转登录页
- ✅ 退出登录清除状态

### P4-8 启动脚本 + 文件夹交付形态
- `start.sh`（Linux/macOS）完善：
  - 自动检测 Python
  - 自动创建 venv
  - 自动安装后端依赖
  - 自动构建前端（如果 web/ 不存在或为空）
  - 自动初始化数据库和默认管理员账号
  - 启动后端服务
  - 输出访问地址 http://localhost:8580
- `start.bat`（Windows）同步更新
- `README.md` 创建完成：功能简介、启动方法、目录结构、技术栈、角色权限、API 文档入口

### 前端构建
- ✅ 前端构建成功，静态资源已更新至 backend/web/

---

## 2026-03-19 — P3 安全与日志（维克托）

### P3-1 版本回退-后端
- 新增 `GET /api/backup-versions` — 备份版本列表（支持按数据源/表名/时间范围/操作人筛选，分页）
- 新增 `GET /api/backup-versions/{id}` — 版本详情（含关联回写信息）
- 新增 `POST /api/backup-versions/{id}/rollback` — 执行回退
  - 回退前自动备份当前数据（trigger_type: triggered_by_rollback）
  - DELETE + INSERT FROM backup_table 方式恢复
  - 记录系统操作日志
  - 支持 MySQL/PostgreSQL/SQL Server

### P3-2 版本回退-前端
- 版本回退页：筛选区（数据源/表名/操作人/时间范围）+ 表格
- 表格字段：版本号/数据源/表名/备份时间/触发类型/关联批次/操作人/记录数/可回退状态
- 版本详情弹窗：完整备份信息 + 关联回写信息展示
- 回退确认弹窗：目标表、版本号、备份时间、风险提示（黄色警告框）
- 回退结果反馈（message 提示）

### P3-3 日志中心-后端
- 新增 `GET /api/logs/system` — 系统操作日志查询（按模块/类型/操作人/时间范围/状态筛选，分页）
- 新增 `GET /api/logs/export` — 模板导出日志查询（按数据源/表名/操作人/时间范围筛选，分页）
- 新增 `GET /api/logs/import` — 模板导入日志查询（按数据源/表名/操作人/校验状态/时间范围筛选，分页）
- 新增 `GET /api/logs/writeback` — 回写日志查询（按数据源/表名/操作人/状态/时间范围筛选，分页）

### P3-4 日志中心-前端
- 日志中心页，4 个页签：系统操作日志 / 模板导出日志 / 模板导入日志 / 回写日志
- 每个页签有独立筛选区 + 分页表格
- 系统日志：时间/模块/操作类型/目标/状态/操作人/详情
- 导出日志：批次号/数据源/表名/导出类型/行数/字段数/文件名/操作人/时间
- 导入日志：批次号/数据源/表名/文件名/总行数/通过/失败/校验状态/导入状态/操作人/时间
- 回写日志：批次号/数据源/表名/操作人/文件名/成功数/失败数/备份版本号/操作时间/状态

### P3-5 系统操作日志埋点-后端
- 新增 `app/utils/audit.py` — 统一审计日志工具函数
- 数据源管理埋点：创建/编辑/删除/测试连接
- 纳管表配置埋点：创建/编辑/删除/结构检测/字段同步
- 数据维护埋点：导出模板/导入模板/执行回写/执行回退

### Swagger 文档
- 新增 7 个 API 端点，tags: 版本回退、日志中心
- 全部接口自动生成 OpenAPI 文档

### 前端构建
- ✅ 前端构建成功，静态资源已更新至 backend/web/

---

## 2026-03-19 — P2 核心操作链路（维克托）

### P1 缺陷修复
- ✅ Bug#1: sync-fields 不再清除用户自定义字段配置，改为合并策略（保留 alias/max_length/enum 等用户自定义项，仅更新 db_data_type/order/pk/sample_value，新增字段自动生成，远程不存在的字段软删除）
- ✅ Bug#2: 创建纳管表时自动拉取 sample_value 填充到 field_config（通过 fetch_sample_data 获取前5行非空值）

### P2-1 数据浏览-后端
- 新增 `GET /api/data-maintenance/tables` — 可维护表列表（分页/搜索）
- 新增 `GET /api/data-maintenance/{table_config_id}/data` — 分页读取业务表数据，支持关键字筛选、按字段筛选
- 所有字段值统一按文本返回

### P2-2 数据浏览-前端
- 数据维护列表页：表别名/数据源/表名/字段数/配置版本/结构状态，点击"进入维护"
- 数据浏览页：顶部表信息栏、筛选区（全局关键字+按字段筛选）、动态表格、分页 20/50/100、横向滚动、主键固定左侧

### P2-3 模板导出-后端
- 新增 `POST /api/data-maintenance/{table_config_id}/export` — 生成含隐藏 _meta sheet 的 Excel 模板
- 模板元信息包含：datasource_id, table_config_id, config_version, export_time, export_batch_no, field_codes, primary_key_fields, structure_hash
- 新增 `GET /api/data-maintenance/{table_config_id}/export-info` — 导出前预估信息
- 记录 template_export_log
- 使用 openpyxl 生成

### P2-4 模板导出-前端
- 导出确认弹窗：导出类型选择（全量/当前筛选）、行数预估、配置版本展示
- 点击确认后自动下载 .xlsx 文件

### P2-5 模板导入-后端
- 新增 `POST /api/data-maintenance/{table_config_id}/import` — 上传平台模板
- 解析 _meta sheet 校验：模板合法性（非平台模板拒绝）、table_config_id 匹配、数据源匹配、版本匹配
- 逐行校验：必填校验、数据类型校验（int/decimal/float）、长度限制、枚举值、主键非空、重复行
- 不存在的主键行报错（首版不支持新增）
- 生成差异数据（原值 vs 新值），存入 diff JSON 文件
- 记录 import_task_log

### P2-6 模板导入-前端
- 模板导入页：拖拽上传 + 文件信息展示（文件名/大小）
- 点击"开始校验"上传文件

### P2-7 导入校验结果-前端
- 校验结果页：汇总卡片（总数/通过/失败/警告/差异项）
- 错误明细表格（行号/字段/类型/当前值/说明）
- 支持"查看差异预览"、"重新上传"操作

### P2-8 差异预览-后端
- 新增 `GET /api/data-maintenance/import-tasks/{task_id}/diff` — 返回原值/新值对比数据
- 新增 `GET /api/data-maintenance/import-tasks/{task_id}` — 导入任务详情

### P2-9 差异预览-前端
- 差异预览页：顶部表信息、汇总卡片（拟更新/差异项/失败数）
- 差异表格：行号/主键值/字段名/原值/新值/差异状态
- 确认写入（二次确认弹窗） / 取消按钮
- 仅当无失败项时允许写入

### P2-10 安全回写-后端
- 新增 `POST /api/data-maintenance/import-tasks/{task_id}/writeback` — 执行回写
- 写前全表备份（CREATE TABLE ... AS SELECT * FROM ...）
- 逐行执行 UPDATE，按主键定位
- 记录 writeback_log 和 table_backup_version
- 自动清理超出 backup_keep_count 的历史备份（DROP + 标记 expired）
- 支持 MySQL/PostgreSQL/SQL Server 三种数据库

### P2-11 写入结果反馈-前端
- 写入结果页：成功/失败状态展示、成功/失败数、备份版本号、备份表名、操作人、完成时间
- 失败明细展示
- 返回数据浏览 / 返回数据维护按钮

### Swagger 文档
- 新增 8 个 API 端点，tags: 数据维护
- 前端构建产物已更新至 backend/web/

### 全链路验证
- ✅ 浏览 → 导出 → 修改 → 导入 → 校验 → 差异预览 → 回写 全链路走通
- ✅ 备份表在业务库中创建成功
- ✅ 数据回写正确（UPDATE 按主键定位）

---

## 2026-03-19 — P0 缺陷修复 + P1 配置链路（维克托）

### P0 缺陷修复
- ✅ 补上"系统设置"占位菜单和路由（PRD 要求 7 个菜单，之前缺少第 7 个）
- 前端 MainLayout 菜单项增加 SettingOutlined 图标 + `/system-settings` 路由
- App.tsx 增加 `/system-settings` 路由映射到占位页

### P1-1 纳管表配置-后端
- 新增 `GET /api/table-config/remote-tables/{ds_id}` — 获取远程数据库库表清单
- 新增 `POST /api/table-config` — 创建纳管表配置（自动拉取字段+计算结构 hash）
- 新增 `GET /api/table-config` — 纳管表列表（分页/筛选，关联数据源名称+字段数）
- 新增 `GET /api/table-config/{id}` — 纳管表详情
- 新增 `PUT /api/table-config/{id}` — 更新纳管表配置（自动升版本号）
- 新增 `DELETE /api/table-config/{id}` — 删除纳管表（逻辑删除，连带字段）
- 新增 `GET /api/table-config/{id}/sample-data` — 样例数据预览

### P1-2 纳管表配置-前端
- 纳管表列表页：筛选（数据源/状态/关键字）、分页、结构检查/配置/字段/删除操作
- 新建纳管表页：两步式——选数据源→选表→配置基本信息→保存并自动拉取字段
- 表配置详情页：基础信息展示、维护规则（Switch 开关）、主键设置、样例数据预览

### P1-3 字段自动拉取-后端
- 新增 `remote_db.py` 工具模块：
  - `list_tables()` — 查询 MySQL/PostgreSQL/SQL Server 的 information_schema
  - `list_columns()` — 获取字段名/类型/是否主键/排序号
  - `fetch_sample_data()` — 读取前 N 条样例数据
  - `compute_structure_hash()` — 基于字段名+类型+主键+排序号生成 SHA256 hash
- 创建纳管表时自动调用 list_columns + fetch_sample_data，生成默认字段配置
- 新增 `POST /api/table-config/{id}/sync-fields` — 重新从远程数据库拉取字段

### P1-4 字段配置-前端
- 字段配置页：完整字段表格，支持逐字段编辑（别名/长度限制/枚举值）
- Switch 开关直接切换：展示/可编辑/必填/导出/导入
- 主键和系统字段 Tag 标识
- 批量操作栏：全部展示/隐藏、全部可编辑/只读、全部参与导出/导入
- Checkbox 多选 + 批量更新

### P1-5 字段配置-后端
- 新增 `GET /api/field-config/{table_config_id}` — 获取表的全部字段配置
- 新增 `GET /api/field-config/detail/{field_id}` — 获取单个字段详情
- 新增 `PUT /api/field-config/{field_id}` — 更新单个字段配置
- 新增 `PUT /api/field-config/batch/update` — 批量更新字段配置
- 新增 `DELETE /api/field-config/{field_id}` — 删除字段

### P1-6 表结构变化检测-后端
- 新增 `POST /api/table-config/{id}/check-structure` — 对比远程当前结构 hash 与已保存 hash
- 返回 normal/changed/error 三种状态
- 结构不一致时返回阻断信号，前端展示警告

### Swagger 文档
- 所有新增接口均带 tags 分组：纳管表配置、字段配置
- 前端构建产物已更新至 backend/web/

---

## 2026-03-19 — P0 完成验证（维克托）

### 验证结果
- ✅ 后端启动：`uvicorn app.main:app --port 8580` 正常运行，Swagger 文档可访问 `/docs`
- ✅ 8 张核心表自动建表：datasource_config, table_config, field_config, template_export_log, import_task_log, writeback_log, table_backup_version, system_operation_log
- ✅ 数据源 CRUD 接口全通：创建/列表/详情/更新/删除（逻辑删除）
- ✅ 测试连接接口正常：MySQL/PostgreSQL/SQL Server 驱动就绪
- ✅ 已有数据源一键测试 + 状态自动更新
- ✅ 密码 Fernet 加密存储正常
- ✅ 前端构建成功，静态资源由 FastAPI 托管，SPA fallback 正常
- ✅ `start.sh` 一键启动流程正常
- ✅ 前端菜单路由：首页/数据源管理/表配置管理/数据维护/日志中心/版本回退
- ✅ 数据源管理前端：列表页（筛选+分页）、新建/编辑页、测试连接交互

---

## 2026-03-19 — P0 项目骨架 + 基础管理（维克托）

### P0-1 前端项目初始化
- Vite + React 18 + TypeScript + Ant Design 5 + React Router v7
- 左侧菜单布局（首页/数据源管理/表配置管理/数据维护/日志中心/版本回退）
- 中文 locale 配置

### P0-2 后端项目初始化
- FastAPI + SQLAlchemy 2.0 + SQLite
- 项目结构：app/main.py, models.py, database.py, routers/, schemas/, utils/
- CORS 中间件、Swagger 文档自动生成
- FastAPI 托管前端静态资源（SPA fallback）

### P0-3 平台数据库建表
- 8 张核心表全部建好：datasource_config, table_config, field_config, template_export_log, import_task_log, writeback_log, table_backup_version, system_operation_log
- 审计字段统一（created_by/created_at/updated_by/updated_at/is_deleted）

### P0-4 启动脚本
- start.sh（Linux/macOS）：自动创建 venv、安装依赖、启动 uvicorn
- start.bat（Windows）：同上 Windows 版本
- 默认端口 8580

### P0-5 数据源管理-后端
- CRUD 接口：列表（分页/筛选）、详情、创建、更新、删除（逻辑删除）
- 测试连接接口：支持 MySQL/PostgreSQL/SQL Server
- 已有数据源一键测试 + 自动更新测试状态
- 密码 Fernet 加密存储
- 数据源编码自动生成（DS_YYYYMMDD_序号）

### P0-6 数据源管理-前端
- 列表页：筛选（名称/类型/状态）、分页、编辑/测试/删除操作
- 新建/编辑页：完整表单、测试连接按钮、数据库类型切换自动填充默认端口

### 技术选型确认
- 7 项决策点全部确认（详见技术选型说明.md）

---

## 2026-03-20
- 项目正式启动，斯维因接收李琪启动指令
- 李琪提供 3 份 v1 草稿文档，文件剪切至共享目录
- 斯维因完成 5 份正式文档收口：
  - `PRD.md` - 产品需求文档
  - `页面原型结构与字段设计.md` - 页面设计
  - `平台数据库表结构设计.md` - 表结构设计
  - `技术选型说明.md` - 技术选型建议
  - `开发任务拆解清单.md` - 开发任务拆解
- 更新 `决策记录.md`、`STATUS.md`、`TASKS.md`
- 当前状态：设计收口完成，待李琪确认
