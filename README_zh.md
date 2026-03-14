<div align="center">

<span id="-securenotify-subnots"></span>

<img src="public/assets/logo.png" alt="SecureNotify Logo" height="100" />

<h3 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.8rem; margin: 0.5rem 0;">
  加密推送通知服务
</h3>

<p style="color: #6b7280; margin: 0;">
  公钥存储与消息分发
</p>

---

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.9.0-339933?logo=node.js&style=flat-square&logoColor=fff)](https://nodejs.org)[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&style=flat-square&logoColor=fff)](https://nextjs.org)[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&style=flat-square&logoColor=fff)](https://typescriptlang.org)[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)

---

[🚀 快速开始](#-快速开始) • [📖 API 文档](docs/API_REFERENCE.md) • [🏗️ 架构设计](docs/ARCHITECTURE.md) • [📚 用户指南](docs/USER_GUIDE.md) • [📘 README English](./README_en.md)

</div>

---

## 💡 简介

> **SecureNotify** (subno.ts) 是一个专注于公钥存储与消息分发的加密推送通知服务。它提供端到端加密通信、实时消息推送和密钥管理功能，确保您的消息在传输过程中得到最大程度的安全保护。

---

## ✨ 核心特性

| 特性 | 状态 | 说明 |
|---|---|---|
| **🔐 公钥注册与管理** | 🚧 开发中 | 支持多种加密算法（RSA-2048、RSA-4096、ECC-SECP256K1）的公钥注册、存储和查询 |
| **📢 频道管理** | 🚧 开发中 | 支持公开频道、加密频道和临时频道三种类型，满足不同场景需求 |
| **⚡ 实时消息推送** | 🚧 开发中 | 基于 Server-Sent Events (SSE) 的实时消息分发，即时送达订阅者 |
| **🔒 消息加密** | 🚧 开发中 | 采用混合加密架构（RSA + AES-256-GCM），支持端到端加密 |
| **🛡️ 安全控制** | ✅ 已实现 | API 密钥认证、请求限流、审计日志、输入验证等多重安全机制 |
| **🎯 消息优先级** | 🚧 开发中 | 支持优先级队列（CRITICAL/HIGH/NORMAL/LOW/BULK），确保重要消息优先处理 |
| **🔑 两阶段撤销** | ✅ 已实现 | 密钥撤销采用两阶段确认机制，防止误操作 |

---

## 🛠️ 技术栈

<div style="display: flex; flex-direction: column; gap: 0.5rem;">

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.9.0-339933?logo=node.js)](https://nodejs.org)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org)

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql)](https://www.postgresql.org)

[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis)](https://redis.io)

[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.45.1-6291c5)](https://orm.drizzle.team)

[![Zod](https://img.shields.io/badge/Zod-3.24.1-c42427)](https://zod.dev)

</div>

---

## 🚀 快速开始

### 前置要求

- ✅ Node.js >= 20.9.0
- ✅ PostgreSQL 14+
- ✅ Redis 7+

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/subno.ts.git
cd subno.ts

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
```

### 环境配置

```env
DATABASE_URL=postgresql://user:password@localhost:5432/securenotify
REDIS_URL=redis://localhost:6379
ADMIN_MASTER_KEY=your-secure-master-key
CRON_SECRET=your-cron-secret
```

> ⚠️ **重要**：生产环境中，`ADMIN_MASTER_KEY` 和 `CRON_SECRET` 必须设置，且长度至少 32 字符。

### 运行

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm start

# 运行测试
npm test
```

---

## 📁 项目结构

```
subno.ts/
├── app/                    # Next.js App Router
│   ├── api/               # API 端点
│   │   └── keys/          # 密钥管理 ✅ 已实现
│   │       ├── [id]/           # 密钥操作
│   │       └── [id]/revoke/    # 两阶段撤销
│   ├── components/        # React 组件
│   └── api-docs/          # API 文档页面
├── src/
│   ├── config/            # 配置文件
│   ├── db/                # 数据库 schema
│   └── lib/               # 核心库
│       ├── services/      # 业务逻辑
│       ├── repositories/  # 数据访问
│       └── middleware/    # 中间件
├── sdk/                   # 多语言 SDK
│   ├── typescript/        # TypeScript SDK
│   ├── python/            # Python SDK
│   ├── rust/              # Rust SDK
│   ├── java/              # Java SDK
│   └── c/                 # C SDK
├── docs/                   # 文档
├── __tests__/              # 测试
└── scripts/                # 脚本工具
```

> ⚠️ **注意**：以下 API 端点正在开发中：`/api/register`、`/api/channels`、`/api/publish`、`/api/subscribe`、`/api/cron`

---

## 🔌 API 概览

### API 实现状态

| API 端点 | 方法 | 状态 | 说明 |
|----------|------|------|------|
| `/api/keys/[id]` | DELETE | ✅ 已实现 | 密钥删除（两阶段确认） |
| `/api/keys/[id]/revoke` | POST, GET | ✅ 已实现 | 请求/查询密钥撤销 |
| `/api/keys/[id]/revoke/cancel` | POST | ✅ 已实现 | 取消撤销请求 |
| `/api/register` | POST, GET | 🚧 开发中 | 公钥注册与查询 |
| `/api/channels` | POST, GET | 🚧 开发中 | 频道创建与查询 |
| `/api/publish` | POST, GET | 🚧 开发中 | 消息发布与队列状态 |
| `/api/subscribe` | GET (SSE) | 🚧 开发中 | 实时消息订阅 |
| `/api/cron/*` | GET | 🚧 开发中 | 定时清理任务 |

### 已实现 API 示例

#### 密钥撤销请求

```bash
POST /api/keys/enc_xxx/revoke
X-API-Key: your-api-key
Content-Type: application/json

{
  "reason": "Key rotation required",
  "confirmationHours": 24
}
```

#### 确认密钥撤销

```bash
DELETE /api/keys/enc_xxx?confirmationCode=xxxxxx
X-API-Key: your-api-key
```

### 开发中 API 示例

<details>
<summary>📋 点击查看计划中的 API 示例</summary>

#### 公钥注册（开发中）

```bash
POST /api/register
Content-Type: application/json

{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "algorithm": "RSA-4096",
  "expiresIn": 604800
}
```

#### 频道管理（开发中）

```bash
POST /api/channels
Content-Type: application/json

{
  "name": "my-channel",
  "type": "public"
}
```

#### 消息发布（开发中）

```bash
POST /api/publish
Content-Type: application/json

{
  "channel": "my-channel",
  "message": "Hello, World!",
  "priority": "normal"
}
```

#### 实时订阅（开发中）

```bash
GET /api/subscribe?channel=my-channel
```

</details>

📖 详细 API 文档请参阅 [API 参考](docs/API_REFERENCE.md)。

---

## 💡 核心概念

### 频道类型

| 类型 | 说明 | 加密 | 图标 |
|------|------|------|------|
| 公开频道 | 所有订阅者可访问 | ❌ | 🌐 |
| 加密频道 | 端到端加密 | ✅ | 🔒 |
| 临时频道 | 自动过期 | ❌/✅ | ⏱️ |

### 消息优先级

| 优先级 | 值 | 说明 | 颜色 |
|--------|-----|------|------|
| CRITICAL | 100 | 最高优先级 | 🔴 |
| HIGH | 75 | 高优先级 | 🟠 |
| NORMAL | 50 | 默认优先级 | 🟡 |
| LOW | 25 | 低优先级 | 🟢 |
| BULK | 0 | 批量消息 | ⚪ |

---

## 📚 文档

| 文档 | 描述 |
|------|------|
| [📖 API 参考](docs/API_REFERENCE.md) | 完整的 API 端点文档，包含请求/响应示例和错误码说明 |
| [📚 用户指南](docs/USER_GUIDE.md) | 产品概述、核心概念、使用示例、安全最佳实践 |
| [🏗️ 架构文档](docs/ARCHITECTURE.md) | 系统架构、数据流程、安全性设计、性能考虑 |

---

## 🤝 贡献指南

1. 🍴 Fork 本仓库
2. 🌿 创建特性分支：`git checkout -b feature/your-feature`
3. ✏️ 提交更改：`git commit -m 'Add: your feature'`
4. 📤 推送到分支：`git push origin feature/your-feature`
5. 🔀 创建 Pull Request

---

## 📄 许可证

本项目采用 **Apache License 2.0** 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 📞 联系方式

- **📦 项目仓库**: https://github.com/your-org/subno.ts
- **🐛 问题反馈**: https://github.com/your-org/subno.ts/issues

---

<div align="center">

**SecureNotify** - 安全、实时、可靠的推送通知服务

Made with ❤️ by [Kirky.X](https://github.com/KirkyX)

---

[⬆️ 回到顶部](#-securenotify-subnots)

</div>

---

<div align="center">

*© 2026 SecureNotify. All rights reserved.*

</div>
