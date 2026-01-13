# SecureNotify (subno.ts)

<div align="center">

**加密推送通知服务** | 公钥存储与消息分发

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.9.0-339933?logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis)](https://redis.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

</div>

## 简介

**SecureNotify** (品牌名：subno.ts) 是一个专注于公钥存储与消息分发的加密推送通知服务。它提供端到端加密通信、实时消息推送和密钥管理功能，确保您的消息在传输过程中得到最大程度的安全保护。

### 核心特性

| 特性 | 描述 |
|------|------|
| **公钥注册与管理** | 支持多种加密算法（RSA-2048、RSA-4096、ECC-SECP256K1）的公钥注册、存储和查询 |
| **频道管理** | 支持公开频道、加密频道和临时频道三种类型，满足不同场景需求 |
| **实时消息推送** | 基于 Server-Sent Events (SSE) 的实时消息分发，即时送达订阅者 |
| **消息加密** | 采用混合加密架构（RSA + AES-256-GCM），支持端到端加密 |
| **安全控制** | API 密钥认证、请求限流、审计日志、输入验证等多重安全机制 |
| **消息优先级** | 支持优先级队列（CRITICAL/HIGH/NORMAL/LOW/BULK），确保重要消息优先处理 |

### 技术栈

| 技术 | 版本/说明 |
|------|-----------|
| **运行时** | Node.js >= 20.9.0 |
| **框架** | Next.js ^16.1.1 (App Router) |
| **语言** | TypeScript ^5.x (strict mode) |
| **数据库** | PostgreSQL 14+ (持久化存储) |
| **缓存/消息队列** | Redis 7+ (缓存、发布订阅、优先级队列) |
| **ORM** | Drizzle ORM ^0.45.1 |
| **验证** | Zod ^3.24.1 (运行时验证) |
| **测试** | Vitest ^4.0.16 |
| **部署** | Vercel ^50.1.3 |

## 快速开始

### 前置要求

- Node.js >= 20.9.0
- PostgreSQL 14+
- Redis 7+

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/subno.ts.git
cd subno.ts

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置数据库和 Redis 连接
```

### 环境配置

创建 `.env` 文件：

```env
# Database Connection
DATABASE_URL=postgresql://securenotify:password@localhost:5432/securenotify
REDIS_URL=redis://localhost:6379

# Admin Configuration (生产环境必须设置)
ADMIN_MASTER_KEY=your-secure-master-key
CRON_SECRET=your-cron-secret

# Message Configuration (可选，使用默认值)
PUBLIC_MESSAGE_TTL=43200
PRIVATE_MESSAGE_TTL=86400

# Security Configuration (可选，使用默认值)
MAX_MESSAGE_SIZE=4718592
RATE_LIMIT_PUBLISH=10
RATE_LIMIT_REGISTER=5
RATE_LIMIT_SUBSCRIBE=5
```

### 运行开发服务器

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 构建生产版本

```bash
npm run build
npm start
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 运行特定测试
npm test -- channel.test.ts
```

## 项目结构

```
subno.ts/
├── app/                    # Next.js App Router 路由
│   └── api/               # API 端点
│       ├── channels/      # 频道管理 API
│       ├── keys/          # 密钥管理 API
│       ├── publish/       # 消息发布 API
│       ├── register/      # 公钥注册 API
│       ├── subscribe/     # 实时订阅 API
│       └── cron/          # 定时任务 API
├── src/
│   ├── lib/               # 核心库
│   │   ├── services/     # 业务逻辑服务
│   │   │   ├── encryption/    # 加密服务 (RSA, AES, Hybrid)
│   │   │   ├── rate-limiter.service.ts   # 速率限制
│   │   │   └── audit.service.ts          # 审计日志
│   │   └── repositories/ # 数据访问层
│   └── middleware.ts      # Next.js 中间件
├── docs/                   # 文档
├── openspec/              # OpenSpec 规范文档
└── __tests__/             # 测试文件
```

## API 概览

### 公钥注册

```bash
# 注册公钥
POST /api/register
Content-Type: application/json

{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "algorithm": "RSA-4096",
  "expiresIn": 604800
}
```

### 频道管理

```bash
# 创建频道
POST /api/channels
Content-Type: application/json

{
  "name": "my-channel",
  "type": "public",
  "expiresIn": 86400
}
```

### 消息发布

```bash
# 发布消息
POST /api/publish
Content-Type: application/json

{
  "channel": "my-channel",
  "message": "Hello, World!",
  "priority": "normal"
}
```

### 实时订阅

```bash
# SSE 订阅频道
GET /api/subscribe?channel=my-channel
```

详细 API 文档请参阅 [API 参考](docs/API_REFERENCE.md)。

## 核心概念

### 频道类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| **公开频道 (public)** | 无加密，所有订阅者可访问 | 公告、广播通知 |
| **加密频道 (encrypted)** | 需要公钥注册，端到端加密 | 私密消息、敏感通知 |
| **临时频道 (temporary)** | 自动过期（默认 30 分钟） | 临时会话、一次性通知 |

### 消息优先级

| 优先级 | 值 | 说明 |
|--------|-----|------|
| **CRITICAL** | 100 | 最高优先级，立即送达 |
| **HIGH** | 75 | 高优先级消息 |
| **NORMAL** | 50 | 默认优先级 |
| **LOW** | 25 | 低优先级 |
| **BULK** | 0 | 批量消息，最低优先级 |

### 加密算法

| 算法 | 密钥长度 | 说明 |
|------|----------|------|
| **RSA-2048** | 2048 位 | 默认非对称加密 |
| **RSA-4096** | 4096 位 | 增强安全性 |
| **ECC-SECP256K1** | 256 位 | 椭圆曲线加密 |
| **AES-256-GCM** | 256 位 | 对称加密（混合加密） |

## 文档

| 文档 | 描述 |
|------|------|
| [API 参考](docs/API_REFERENCE.md) | 完整的 API 端点文档 |
| [用户指南](docs/USER_GUIDE.md) | 产品概述、使用示例、常见问题 |
| [架构文档](docs/ARCHITECTURE.md) | 系统架构、数据流程、安全设计 |

## 贡献指南

### 开发流程

1. **Fork** 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add: your feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 创建 **Pull Request**

### 代码规范

- TypeScript 严格模式
- 所有文件必须包含 Apache 2.0 许可证头
- 使用 ESLint 进行代码检查
- 提交前运行 `npm run lint`

### 测试要求

- 所有新功能必须有对应的测试
- 单元测试覆盖核心逻辑
- 集成测试覆盖 API 端点
- 目标测试覆盖率 >80%

## 许可证

本项目采用 **Apache License 2.0** 许可证。详见 [LICENSE](LICENSE) 文件。

## 联系方式

- **项目仓库**: https://github.com/your-org/subno.ts
- **问题反馈**: https://github.com/your-org/subno.ts/issues

---

<div align="center">

**SecureNotify** - 安全、实时、可靠的推送通知服务

</div>
