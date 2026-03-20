# 数据运维工作台 (Data Ops Workbench)

> 为交付和运维现场提供"不碰数据库客户端也能安全修订结果表"的可视化工作台。

## 功能简介

| 模块 | 功能 |
|---|---|
| 数据源管理 | 新增/编辑/删除/测试连接，支持 MySQL、PostgreSQL、SQL Server |
| 纳管表配置 | 选表、自动拉取字段、配置字段语义与编辑规则 |
| 数据维护 | 分页浏览、模板导出、导入校验、差异预览、安全回写 |
| 日志中心 | 系统日志 / 导出日志 / 导入日志 / 回写日志 |
| 版本回退 | 备份版本列表、一键回退 |
| 登录权限 | 管理员 / 操作员 / 只读用户 三角色 |

## 快速启动

### 前置条件

- Python 3.9+
- Node.js 18+（仅首次构建前端需要，构建完成后不再需要）

### Linux / macOS

```bash
chmod +x start.sh
./start.sh
```

### Windows

```cmd
start.bat
```

### 启动后

- 访问地址：**http://localhost:8580**
- 默认管理员账号：`admin` / `admin123`

## 目录结构

```
data-ops-workbench/
├── backend/           # 后端 FastAPI 项目
│   ├── app/          # 应用代码
│   │   ├── main.py   # 入口
│   │   ├── models.py # 数据模型
│   │   ├── routers/  # API 路由
│   │   ├── schemas/  # Pydantic 模型
│   │   └── utils/    # 工具函数
│   ├── web/          # 前端构建产物（自动生成）
│   └── requirements.txt
├── frontend/          # 前端 React 项目
│   ├── src/
│   └── package.json
├── data/              # 运行时数据（SQLite 数据库、上传文件等）
├── docs/              # 项目文档
├── start.sh           # Linux/macOS 一键启动
├── start.bat          # Windows 一键启动
└── README.md
```

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Ant Design 6 + Vite |
| 后端 | FastAPI + SQLAlchemy 2.0 + Pydantic 2 |
| 平台数据库 | SQLite（零配置） |
| 业务数据库 | MySQL / PostgreSQL / SQL Server |
| 认证 | JWT（24小时有效期） |

## 角色权限

| 操作 | 管理员 (admin) | 操作员 (operator) | 只读用户 (readonly) |
|---|:---:|:---:|:---:|
| 查看数据 | ✅ | ✅ | ✅ |
| 下载模板 | ✅ | ✅ | ✅ |
| 上传模板 | ✅ | ✅ | ❌ |
| 预览差异 | ✅ | ✅ | ❌ |
| 提交写入 | ✅ | ✅ | ❌ |
| 数据源管理 | ✅ | ❌ | ❌ |
| 版本回退 | ✅ | ❌ | ❌ |

## API 文档

启动服务后访问 Swagger 文档：**http://localhost:8580/docs**

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | `8580` |
| `JWT_SECRET` | JWT 密钥 | 内置默认值 |

## License

Private - Internal Use Only
