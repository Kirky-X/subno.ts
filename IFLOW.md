<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# subno.ts 项目上下文指南

## 项目概述

**subno.ts** (品牌名: SecureNotify) 是一个加密推送通知服务，专注于公钥存储与消息分发。该项目使用 Next.js 16 + TypeScript 构建，提供端到端加密通信、实时消息推送和密钥管理功能。

### 核心特性

- **公钥注册与管理** - 注册和存储加密公钥，支持多种加密算法（RSA-2048、RSA-4096、ECC-SECP256K1）
- **频道管理** - 支持公开频道、加密频道和临时频道
- **实时消息推送** - 基于 Server-Sent Events (SSE) 的实时消息分发
- **消息加密** - 端到端加密支持，保护消息机密性
- **安全控制** - API 密钥认证、请求限流、审计日志
- **消息优先级** - 支持优先级队列（CRITICAL/HIGH/NORMAL/LOW/BULK）

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | >=20.9.0 |
| 框架 | Next.js | ^16.1.1 |
| 语言 | TypeScript | ^5.x |
| 数据库 | PostgreSQL | 14+ |
| 缓存/消息队列 | Redis | 7+ |
| ORM | Drizzle ORM | ^0.45.1 |
| 验证 | Zod | ^3.24.1 |
| 测试框架 | Vitest | ^4.0.16 |
| 云服务 | Vercel | ^50.1.3 |

---

## 项目结构

```
subno.ts/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── channels/            # 频道管理 API
│   │   ├── cron/                # 定时任务（清理过期数据）
│   │   ├── keys/                # 密钥管理 API
│   │   ├── publish/             # 消息发布 API
│   │   ├── register/            # 公钥注册 API
│   │   └── subscribe/           # 实时订阅（SSE）
│   ├── globals.css              # 全局样式
│   ├── layout.tsx               # 根布局
│   ├── page.module.css          # 首页样式模块
│   └── page.tsx                 # 首页
├── src/
│   ├── config/
│   │   └── env.ts               # 环境变量配置（Zod 验证）
│   ├── db/
│   │   ├── schema.ts            # 数据库表定义（Drizzle）
│   │   └── migrations/          # 数据库迁移文件
│   ├── lib/
│   │   ├── db.ts                # 数据库导出
│   │   ├── redis.ts             # Redis 客户端
│   │   ├── repositories/        # 数据访问层
│   │   │   └── redis.repository.ts
│   │   ├── services/            # 业务逻辑层
│   │   │   ├── api-key.service.ts
│   │   │   ├── audit.service.ts
│   │   │   ├── channel.service.ts
│   │   │   ├── cleanup.service.ts
│   │   │   ├── encryption-key.service.ts
│   │   │   ├── encryption.service.ts
│   │   │   ├── index-monitor.service.ts
│   │   │   ├── message.service.ts
│   │   │   ├── rate-limiter.service.ts
│   │   │   └── encryption/      # 加密服务模块
│   │   │       ├── aes.service.ts
│   │   │       ├── hybrid.service.ts
│   │   │       ├── index.ts
│   │   │       ├── key-cache.service.ts
│   │   │       └── rsa.service.ts
│   │   ├── types/
│   │   │   └── message.types.ts
│   │   └── utils/
│   │       ├── cors.util.ts
│   │       └── validation.util.ts
│   ├── tests/
│   │   └── health.test.ts
│   └── middleware.ts            # Next.js 中间件（CORS、安全头）
├── __tests__/                   # 测试文件
│   ├── e2e/                     # 端到端测试
│   ├── integration/             # 集成测试
│   ├── performance/             # 性能测试
│   ├── unit/                    # 单元测试
│   ├── utils/
│   │   └── test-server.ts
│   └── setup.ts                 # 测试配置
├── docs/                        # 文档
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── configuration.md
│   ├── CONTRIBUTING.md
│   ├── FAQ.md
│   └── USER_GUIDE.md
├── sdk/                         # 多语言 SDK
│   ├── c/                       # C 语言 SDK
│   ├── java/                    # Java SDK
│   ├── python/                  # Python SDK
│   ├── rust/                    # Rust SDK
│   └── typescript/              # TypeScript SDK
├── scripts/                     # 脚本
│   ├── add-license-header.js    # 添加许可证头
│   ├── deploy.sh                # 部署脚本
│   ├── deploy_huaweicloud.sh    # 华为云部署脚本
│   ├── deploy-vercel.sh         # Vercel 部署脚本
│   ├── docker-compose.yml       # Docker Compose 配置
│   ├── pre-check.js             # 预检查脚本
│   ├── run-migrations.ts        # 运行迁移脚本
│   └── test_api.sh              # API 测试脚本
├── .env.example                 # 环境变量示例
├── drizzle.config.ts            # Drizzle ORM 配置
├── next.config.ts               # Next.js 配置
├── package.json                 # 项目依赖
├── tsconfig.json                # TypeScript 配置
└── vitest.config.ts             # Vitest 配置
```

---

## 构建和运行

### 环境要求

- Node.js >=20.9.0
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose（可选）

### 快速启动

**方式一：Docker Compose（推荐）**

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

**方式二：手动部署**

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和 Redis 连接

# 3. 启动开发服务器（自动运行迁移）
npm run dev
```

### 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（自动运行迁移） |
| `npm run build` | 构建生产版本（自动运行迁移） |
| `npm start` | 启动生产服务器（自动运行迁移） |
| `npm run lint` | 运行 ESLint 检查 |
| `npm test` | 运行测试（监听模式） |
| `npm run test:run` | 运行测试（单次） |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run db:migrate` | 运行数据库迁移 |
| `npm run db:push` | 推送 schema 到数据库（开发用） |
| `npm run db:generate` | 生成数据库迁移文件 |
| `npm run add-header` | 为源文件添加许可证头 |
| `npm run pre-check` | 运行预检查脚本 |

---

## 环境配置

### 必需的环境变量

```bash
# 数据库连接
DATABASE_URL=postgresql://user:password@localhost:5432/securenotify

# Redis 连接
REDIS_URL=redis://localhost:6379
```

### 可选的环境变量

#### 消息配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PUBLIC_MESSAGE_TTL` | 43200 | 公开消息 TTL（秒） |
| `PRIVATE_MESSAGE_TTL` | 86400 | 私有消息 TTL（秒） |
| `PUBLIC_MESSAGE_MAX_COUNT` | 1000 | 公开消息最大数量 |
| `PRIVATE_MESSAGE_MAX_COUNT` | 100 | 私有消息最大数量 |

#### 频道配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TEMPORARY_CHANNEL_TTL` | 1800 | 临时频道 TTL（30分钟） |
| `PERSISTENT_CHANNEL_DEFAULT_TTL` | 86400 | 持久化频道默认 TTL（24小时） |
| `PERSISTENT_CHANNEL_MAX_TTL` | 604800 | 持久化频道最大 TTL（7天） |
| `CHANNEL_CLEANUP_INTERVAL` | 300 | 清理间隔（5分钟） |
| `AUTO_CREATE_CHANNELS_ENABLED` | true | 是否自动创建频道 |
| `MAX_CHANNEL_METADATA_SIZE` | 2048 | 频道元数据最大大小（字节） |

#### 加密配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AES_KEY_LENGTH` | 32 | AES 密钥长度（256 位） |
| `AES_IV_LENGTH` | 16 | AES IV 长度（128 位） |
| `RSA_DEFAULT_KEY_SIZE` | 4096 | RSA 默认密钥大小（位） |
| `RSA_HASH_ALGORITHM` | sha256 | RSA 哈希算法 |
| `PUBLIC_KEY_CACHE_TTL` | 604800 | 公钥缓存 TTL（7天） |

#### 安全配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAX_MESSAGE_SIZE` | 4718592 | 最大消息大小（4.5MB） |
| `RATE_LIMIT_PUBLISH` | 10 | 发布限流（每分钟） |
| `RATE_LIMIT_REGISTER` | 5 | 注册限流（每分钟） |
| `RATE_LIMIT_SUBSCRIBE` | 5 | 订阅限流（每分钟） |
| `MAX_PUBLIC_KEY_SIZE` | 4096 | 最大公钥大小（4KB） |

#### 密钥配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KEY_EXPIRY_DEFAULT` | 604800 | 默认密钥过期时间（7天） |
| `KEY_EXPIRY_MAX` | 2592000 | 最大密钥过期时间（30天） |

#### 管理配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_MASTER_KEY` | - | 管理员主密钥（生产必需） |
| `CRON_SECRET` | - | Cron 任务密钥（生产必需） |

#### 清理配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CLEANUP_BATCH_SIZE` | 1000 | 批量清理大小 |
| `AUDIT_LOG_RETENTION_DAYS` | 90 | 审计日志保留天数 |
| `MESSAGE_CLEANUP_MAX_AGE_HOURS` | 12 | 消息最大保留时间（小时） |

#### 监控配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LOG_LEVEL` | info | 日志级别：debug/info/warn/error |
| `ENABLE_AUDIT_LOG` | true | 是否启用审计日志 |

#### CORS 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORS_ORIGINS` | - | 允许的跨域来源（逗号分隔） |

**注意：** 在生产环境中，`ADMIN_MASTER_KEY` 和 `CRON_SECRET` 是必需的。开发环境中，如果未设置，系统会自动生成并显示警告。

---

## 开发约定

### 代码风格

- **语言**：TypeScript（严格模式）
- **格式化**：遵循 ESLint 配置
- **许可证头**：所有源文件必须包含 Apache 2.0 许可证头
  ```typescript
  // SPDX-License-Identifier: Apache-2.0
  // Copyright (c) 2026 KirkyX. All rights reserved.
  ```

### 项目架构原则

1. **分层架构**
   - **API 层**（`app/api/`）：处理 HTTP 请求/响应
   - **业务逻辑层**（`src/lib/services/`）：实现核心业务逻辑
   - **数据访问层**（`src/lib/repositories/`）：封装数据库和缓存操作

2. **模块化加密服务**
   - **RSA 服务**（`encryption/rsa.service.ts`）：RSA 密钥生成、加密、解密、签名、验证
   - **AES 服务**（`encryption/aes.service.ts`）：AES-256-GCM 对称加密
   - **混合服务**（`encryption/hybrid.service.ts`）：RSA + AES 组合加密大消息
   - **密钥缓存服务**（`encryption/key-cache.service.ts`）：公钥缓存（Cache-Aside 模式）

3. **类型安全**
   - 所有函数必须使用 TypeScript 类型注解
   - 使用 Zod 进行运行时数据验证
   - 数据库 schema 定义类型自动推断

4. **错误处理**
   - 使用统一的错误响应格式
   - 记录错误日志和审计信息
   - 提供清晰的错误消息和错误码

5. **安全优先**
   - 所有输入必须验证（使用 Zod）
   - 敏感操作需要 API 密钥认证
   - 实施请求限流防止滥用
   - 记录审计日志

### 测试约定

- **单元测试**：测试单个函数或类（`__tests__/unit/`）
- **集成测试**：测试 API 端点（`__tests__/integration/`）
- **端到端测试**：测试完整用户流程（`__tests__/e2e/`）
- **性能测试**：API 负载测试（`__tests__/performance/`）
- **测试覆盖率**：目标覆盖率 > 80%

### 提交规范

项目使用 Husky + lint-staged 进行提交前检查：
- 自动添加许可证头
- 运行 ESLint 检查
- 确保代码质量

---

## 数据库 Schema

### 核心表

#### public_keys（公钥表）
存储加密公钥信息
- `id` (UUID): 主键
- `channelId` (varchar): 频道 ID（唯一）
- `publicKey` (text): PEM 格式公钥
- `algorithm` (varchar): 加密算法
- `createdAt` (timestamp): 创建时间
- `expiresAt` (timestamp): 过期时间
- `lastUsedAt` (timestamp): 最后使用时间
- `metadata` (jsonb): 元数据

索引：
- `idx_public_keys_expires_at` (expiresAt)
- `idx_public_keys_channel_id` (channelId)

#### channels（频道表）
存储频道元数据
- `id` (varchar): 频道 ID（主键）
- `name` (varchar): 频道名称
- `description` (text): 频道描述
- `type` (varchar): 频道类型（public/encrypted）
- `creator` (varchar): 创建者
- `createdAt` (timestamp): 创建时间
- `expiresAt` (timestamp): 过期时间
- `isActive` (boolean): 是否激活
- `metadata` (jsonb): 元数据

索引：
- `idx_channels_type` (type)
- `idx_channels_expires_at` (expiresAt)
- `idx_channels_is_active` (isActive)

#### messages（消息表）
存储持久化消息
- `id` (varchar): 消息 ID（主键）
- `channel` (varchar): 频道 ID
- `message` (text): 消息内容
- `encrypted` (boolean): 是否加密
- `createdAt` (timestamp): 创建时间

索引：
- `idx_messages_channel` (channel)
- `idx_messages_created_at` (createdAt)
- `idx_messages_channel_created` (channel, createdAt) - 复合索引

#### api_keys（API 密钥表）
存储 API 访问密钥
- `id` (UUID): 主键
- `keyHash` (varchar): 密钥哈希（唯一）
- `keyPrefix` (varchar): 密钥前缀
- `userId` (varchar): 用户 ID
- `name` (varchar): 密钥名称
- `permissions` (jsonb): 权限列表
- `isActive` (boolean): 是否激活
- `createdAt` (timestamp): 创建时间
- `lastUsedAt` (timestamp): 最后使用时间
- `expiresAt` (timestamp): 过期时间

索引：
- `idx_api_keys_user_id` (userId)
- `idx_api_keys_key_prefix` (keyPrefix)
- `idx_api_keys_is_active` (isActive)
- `idx_api_keys_active_expiry` (isActive, expiresAt) - 复合索引

#### audit_logs（审计日志表）
记录所有操作
- `id` (UUID): 主键
- `createdAt` (timestamp): 创建时间
- `action` (varchar): 操作类型
- `channelId` (varchar): 频道 ID
- `keyId` (varchar): 密钥 ID
- `messageId` (varchar): 消息 ID
- `userId` (varchar): 用户 ID
- `ip` (varchar): IP 地址
- `userAgent` (text): 用户代理
- `success` (boolean): 是否成功
- `error` (text): 错误信息
- `metadata` (jsonb): 元数据

索引：
- `idx_audit_logs_created_at` (createdAt)
- `idx_audit_logs_channel_id` (channelId)
- `idx_audit_logs_action` (action)
- `idx_audit_logs_key_id` (keyId)

### 类型导出

每个表都导出了对应的类型：

```typescript
export type PublicKey = typeof publicKeys.$inferSelect;
export type NewPublicKey = typeof publicKeys.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
```

---

## API 端点概览

### 公钥管理
- `POST /api/register` - 注册公钥（自动创建加密频道）
- `GET /api/register` - 查询公钥信息

### 频道管理
- `POST /api/channels` - 创建频道
- `GET /api/channels` - 查询频道列表

### 消息推送
- `POST /api/publish` - 发布消息（支持优先级）
- `GET /api/publish` - 获取消息队列状态

### 实时订阅
- `GET /api/subscribe` - SSE 订阅频道

### 密钥管理
- `GET /api/keys/[id]` - 获取公钥信息
- `POST /api/keys` - 创建 API 密钥
- `DELETE /api/keys/[id]` - 撤销公钥

### 定时任务
- `GET /api/cron/cleanup-channels` - 清理过期频道
- `GET /api/cron/cleanup-keys` - 清理过期密钥和数据
- `GET /api/cron/health` - 健康检查

**详细 API 文档请参考：** `docs/API_REFERENCE.md`

---

## 消息类型定义

### 消息优先级

```typescript
enum MessagePriority {
  CRITICAL = 100,  // 关键消息
  HIGH = 75,       // 高优先级
  NORMAL = 50,     // 普通（默认）
  LOW = 25,        // 低优先级
  BULK = 0,        // 批量消息
}
```

### 发布消息选项

```typescript
interface PublishMessageOptions {
  channel: string;              // 频道 ID
  message: string;              // 消息内容
  priority?: MessagePriority;   // 优先级
  sender?: string;              // 发送者
  cache?: boolean;              // 是否缓存（默认 true）
  encrypted?: boolean;          // 是否加密
  autoCreate?: boolean;         // 自动创建频道（默认 true）
  signature?: string;           // 签名
}
```

### 发布结果

```typescript
interface PublishResult {
  messageId: string;      // 消息 ID
  timestamp: number;      // 时间戳
  channel: string;        // 频道 ID
  autoCreated?: boolean;  // 是否自动创建的频道
}
```

---

## 关键设计决策

### 1. 为什么选择 Next.js？
- 全栈能力，支持 API 路由和前端
- 内置 TypeScript 支持
- 优秀的开发体验和部署优化（Vercel）
- App Router 提供更好的性能
- React 19 支持

### 2. 为什么使用 PostgreSQL + Redis？
- **PostgreSQL**：持久化存储，支持复杂查询和事务，使用 `subno` schema
- **Redis**：高性能缓存和消息队列，支持实时推送和优先级队列
- **Vercel KV**：用于边缘缓存（可选）
- 数据分层策略：核心数据用 PostgreSQL，高频访问用 Redis

### 3. 为什么选择 SSE 而不是 WebSocket？
- SSE 是单向推送（服务器→客户端），符合需求
- 使用标准 HTTP 协议，更简单可靠
- 内置自动重连机制
- 浏览器原生支持，无需额外库

### 4. 为什么使用模块化加密服务？
- **单一职责**：每个服务只负责一种加密方式
- **可测试性**：可以单独测试每个加密服务
- **可扩展性**：容易添加新的加密算法
- **向后兼容**：保留 `EncryptionService` 类，内部委托给新服务

### 5. 为什么使用优先级队列？
- 支持消息重要性分级
- 确保关键消息优先传递
- 支持批量消息处理

---

## 常见任务

### 添加新的 API 端点

1. 在 `app/api/` 下创建新的路由文件
2. 实现请求验证（使用 Zod）
3. 调用相应的 Service 处理业务逻辑
4. 返回标准化的响应格式

示例：
```typescript
// app/api/endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  param: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    
    // 调用服务
    const result = await someService.doSomething(data);
    
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
```

### 添加新的加密算法

1. 在 `src/lib/services/encryption/` 下创建新的服务文件
2. 实现加密/解密逻辑
3. 在 `src/lib/services/encryption/index.ts` 中导出
4. 编写单元测试

### 添加新的数据库表

1. 在 `src/db/schema.ts` 中定义表结构（使用 `subnoSchema`）
2. 运行 `npm run db:generate` 生成迁移文件
3. 运行 `npm run db:push` 推送到数据库（开发）或 `npm run db:migrate`（生产）

### 添加新的服务

1. 在 `src/lib/services/` 下创建服务文件
2. 实现业务逻辑，使用 Repository 访问数据
3. 在 API 路由中调用服务
4. 编写单元测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- message.service.test.ts

# 生成覆盖率报告
npm run test:coverage
```

---

## SDK 支持

项目提供多语言 SDK：

| 语言 | 位置 | 说明 |
|------|------|------|
| TypeScript | `sdk/typescript/` | 官方 SDK |
| Python | `sdk/python/` | Python 客户端 |
| Rust | `sdk/rust/` | Rust 客户端 |
| Java | `sdk/java/` | Java 客户端 |
| C | `sdk/c/` | C 语言客户端 |

---

## 调试技巧

### 查看日志

- 开发环境：控制台输出（可配置 LOG_LEVEL）
- 生产环境：配置 LOG_LEVEL=debug 获取详细日志

### 数据库调试

```bash
# 连接到 PostgreSQL
psql $DATABASE_URL

# 查看所有表
\dt subno.*

# 查询数据
SELECT * FROM subno.public_keys LIMIT 10;
```

### Redis 调试

```bash
# 连接到 Redis
redis-cli -u $REDIS_URL

# 查看所有键
KEYS *

# 查看特定键
GET messages:channel-id

# 查看频道队列
ZRANGE messages:channel-id 0 -1 WITHSCORES
```

---

## 性能优化建议

1. **数据库查询优化**
   - 使用索引（已在 schema 中定义）
   - 避免 N+1 查询，使用关联查询
   - 使用连接池（已配置：min=2, max=20）

2. **Redis 缓存策略**
   - 热数据缓存（公钥、消息）
   - 设置合理的 TTL
   - 使用 Redis Pub/Sub 实现实时推送
   - 使用 ZRANGE 实现优先级队列

3. **API 优化**
   - 实施请求限流防止滥用
   - 使用流式响应（SSE）
   - 压缩响应（Next.js 自动处理）
   - 消息优先级排序确保关键消息优先

---

## 安全最佳实践

1. **输入验证**
   - 所有输入使用 Zod 验证
   - 限制输入大小（消息、公钥、元数据）
   - 验证频道 ID 格式

2. **认证授权**
   - 敏感操作需要 API 密钥
   - 实施请求限流
   - 记录审计日志

3. **数据保护**
   - 敏感数据加密存储
   - 使用 HTTPS（生产环境）
   - 实施 CORS 策略

4. **密钥管理**
   - 定期轮换密钥
   - 使用环境变量存储密钥
   - 不要在代码中硬编码密钥

5. **生产配置**
   - 必须设置 ADMIN_MASTER_KEY
   - 必须设置 CRON_SECRET
   - 启用审计日志

---

## 文档资源

- **用户指南**：`docs/USER_GUIDE.md`
- **API 参考**：`docs/API_REFERENCE.md`
- **架构设计**：`docs/ARCHITECTURE.md`
- **配置说明**：`docs/configuration.md`
- **常见问题**：`docs/FAQ.md`
- **贡献指南**：`docs/CONTRIBUTING.md`

---

## 许可证

Apache License 2.0

---

**项目维护者：** Kirky.X
**最后更新：** 2026-01-11
