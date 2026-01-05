# 🚀 部署指南 (Deployment Guide)

本文档详细说明如何将 securenotify 项目部署到 Vercel 平台。

## 📋 目录

- [前提条件](#-前提条件)
- [环境准备](#-环境准备)
  - [数据库配置 (PostgreSQL)](#数据库配置-postgresql)
  - [Redis 配置](#redis-配置)
- [环境变量](#-环境变量)
- [部署步骤](#-部署步骤)
  - [方式一：Git 集成自动部署（推荐）](#方式一git-集成自动部署推荐)
  - [方式二：Vercel CLI 手动部署](#方式二vercel-cli-手动部署)
  - [方式三：华为云函数工作流 (FunctionGraph)](#方式三华为云函数工作流-functiongraph)
- [数据库迁移](#-数据库迁移)
- [验证与监控](#-验证与监控)

## 🛠 前提条件

1. 拥有 [Vercel](https://vercel.com) 账号。
2. 拥有 GitHub/GitLab/Bitbucket 账号（用于自动部署）。
3. 安装 Node.js (>=20.9.0)。
4. (可选) 安装 Vercel CLI: `npm i -g vercel`

## 📦 环境准备

### 数据库配置 (PostgreSQL)

本项目使用 PostgreSQL 存储核心数据。推荐使用 Vercel Postgres 或 Neon。

**使用 Vercel Postgres:**
1. 在 Vercel 项目 Dashboard 中，点击 "Storage"。
2. 选择 "Postgres" 并创建一个新数据库。
3. 获取连接字符串 (Connection String)。

### Redis 配置

本项目使用 Redis 处理消息队列和缓存。推荐使用 Vercel KV 或 Upstash。

**使用 Vercel KV:**
1. 在 Vercel 项目 Dashboard 中，点击 "Storage"。
2. 选择 "KV" (Redis) 并创建一个新实例。
3. 获取连接 URL (`KV_URL` 或 `REDIS_URL`)。

## 🔑 环境变量

在 Vercel 项目设置 (Settings -> Environment Variables) 中添加以下变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | Redis 连接字符串 | `redis://default:token@host:port` |
| `ADMIN_MASTER_KEY` | 管理员主密钥 (用于生成 API Keys) | `secure-random-string-min-32-chars` |
| `CORS_ORIGINS` | 允许跨域的域名 (生产环境) | `https://your-domain.vercel.app` |
| `LOG_LEVEL` | 日志级别 | `info` |

**可选配置 (使用默认值即可):**
- `PUBLIC_MESSAGE_TTL`: 43200 (12小时)
- `PRIVATE_MESSAGE_TTL`: 86400 (24小时)
- `RATE_LIMIT_PUBLISH`: 10

## ⚠️ 注意事项

### SSE 连接超时

本项目使用 Server-Sent Events (SSE) 进行实时消息推送。在 Vercel 平台上：
- **Hobby (免费版)**: Serverless Function 默认超时时间为 **10秒** (甚至更短)。这意味着 SSE 连接可能每10秒断开一次，客户端会自动重连，但可能影响体验。
- **Pro (付费版)**: 可以配置更长的超时时间 (最高 300秒)。

如果在 `vercel.json` 中配置 `maxDuration` 无效 (Hobby 版限制)，建议：
1. 客户端做好断线重连处理 (本项目客户端已支持)。
2. 考虑将实时服务部署在支持长连接的平台 (如 Railway, Render, 或自建服务器)。

## 🚀 部署步骤

### 方式一：Git 集成自动部署（推荐）

1. 将代码推送到 GitHub/GitLab 仓库。
2. 登录 Vercel Dashboard，点击 "Add New..." -> "Project"。
3. 导入你的 Git 仓库。
4. 在 "Environment Variables" 部分，填入上述环境变量。
5. 点击 "Deploy"。
6. 等待构建和部署完成。

### 方式二：Vercel CLI 手动部署

在项目根目录下运行：

```bash
# 登录 Vercel
vercel login

# 部署 (按提示操作)
vercel
```

部署生产环境：

```bash
vercel --prod
```

### 方式三：华为云函数工作流 (FunctionGraph)

使用自定义容器 (Custom Container) 模式部署，以获得最佳的 Next.js 兼容性。

**1. 准备华为云资源**
- **RDS for PostgreSQL**: 购买并创建 PostgreSQL 实例。
- **DCS for Redis**: 购买并创建 Redis 实例。
- **SWR (容器镜像服务)**: 创建组织和镜像仓库。

**2. 构建并推送镜像**

确保项目根目录下已有 `Dockerfile` (已提供)。

```bash
# 登录 SWR (参考华为云控制台指令)
docker login -u [username] -p [password] [region].swr.myhuaweicloud.com

# 构建镜像
docker build -t [region].swr.myhuaweicloud.com/[org]/securenotify:v1 .

# 推送镜像
docker push [region].swr.myhuaweicloud.com/[org]/securenotify:v1
```

**3. 创建函数**
1. 进入 FunctionGraph 控制台，点击 "创建函数"。
2. 选择 "容器镜像" (Custom Container)。
3. 选择刚才推送的镜像。
4. **配置环境变量**: 添加 `DATABASE_URL`, `REDIS_URL`, `ADMIN_MASTER_KEY` 等。
5. **配置端口**: 设置监听端口为 `8080` (与 Dockerfile 中一致)。
6. **配置执行超时**: 建议设置为 60秒 或更长 (SSE 需要)。

**4. 配置触发器**
1. 创建 APIG (API网关) 触发器。
2. 将 API 网关的请求路径映射到函数。

## 🗄 数据库迁移

部署完成后，需要初始化数据库表结构。

**方法 A: 本地运行 (推荐)**
确保本地 `.env` 文件中有生产环境的 `DATABASE_URL`，然后运行：

```bash
npm run db:migrate
```

**方法 B: Vercel Console**
目前 Vercel 不直接支持在 Build 过程中连接外部受限数据库（取决于网络配置）。建议使用方法 A，或者在 CI/CD 流程中增加迁移步骤。

## ✅ 验证与监控

### 部署后验证

1. **访问首页**: 打开 Vercel 生成的域名 (e.g., `https://project.vercel.app`)，应显示应用首页。
2. **API 健康检查**: 访问 `/api/health` (如果已实现) 或尝试注册一个 API Key。
3. **功能测试**:
   - 使用 API 工具 (如 Postman) 测试 `/api/register`。
   - 测试 WebSocket/SSE 连接。

### 监控

- **Logs**: 在 Vercel Dashboard -> Deployments -> Logs 查看实时日志。
- **Usage**: 监控 Serverless Function 执行时间和带宽使用。
- **Cron Jobs**: 检查 `vercel.json` 配置的定时任务 (`/api/cron/*`) 是否正常执行。
