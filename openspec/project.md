# Project Context

## Purpose

**SecureNotify (subno.ts)** 是一个专注于**端到端加密**的推送通知服务，提供公钥存储、实时消息分发和密钥管理功能。

### 核心目标

| 目标 | 描述 |
|------|------|
| **安全性** | 端到端加密、密钥管理、审计日志 |
| **实时性** | 基于 SSE 的实时消息推送 (<100ms 延迟) |
| **可靠性** | 消息持久化、重连机制、优先级队列 |
| **可扩展性** | 水平扩展，支持 10,000+ SSE 连接 |

### 核心特性

- **公钥托管**: 支持 RSA-2048/RSA-4096/ECC-SECP256K1 多种算法
- **实时推送**: 基于 Server-Sent Events (SSE) 的实时分发
- **端到端加密**: 混合加密架构 (RSA + AES-256-GCM)
- **频道管理**: 公开频道、加密频道、临时频道
- **消息优先级**: CRITICAL/HIGH/NORMAL/LOW/BULK 五级优先级

## Tech Stack

### 运行时与框架
| 技术 | 版本/说明 |
|------|-----------|
| **Node.js** | >= 20.9.0 |
| **Next.js** | ^16.1.1 (App Router) |
| **TypeScript** | ^5.x (strict mode) |

### 数据层
| 技术 | 版本/说明 |
|------|-----------|
| **PostgreSQL** | 14+ (持久化存储) |
| **Redis** | 7+ (缓存、发布订阅、优先级队列) |
| **Drizzle ORM** | ^0.45.1 |
| **@neondatabase/serverless** | ^0.10.0 |
| **ioredis** | ^5.4.0 |

### 验证与工具
| 技术 | 版本/说明 |
|------|-----------|
| **Zod** | ^3.24.1 (运行时验证) |
| **Vitest** | ^4.0.16 (测试框架) |
| **@vitest/coverage-v8** | ^4.0.0 (代码覆盖率) |

### 部署
| 技术 | 版本/说明 |
|------|-----------|
| **Vercel** | ^50.1.3 |
| **输出模式** | standalone |

## Project Conventions

### Code Style

#### 许可证头 (所有文件必须包含)
```typescript
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.
```

#### TypeScript 严格模式配置
- `strict: true` 启用
- `noEmit: true` (Next.js 编译)
- `jsx: react-jsx`
- 路径别名: `@/*` → `./*`

#### 文件命名约定
| 类型 | 命名模式 | 示例 |
|------|----------|------|
| 组件 | `PascalCase.tsx` | `StarField.tsx` |
| 页面 | `kebab-case/page.tsx` | `api-docs/page.tsx` |
| 服务 | `*.service.ts` | `encryption.service.ts` |
| 仓库 | `*.repository.ts` | `user.repository.ts` |
| 工具库 | `*.util.ts` 或 `*.helper.ts` | - |

#### 代码组织结构
```
src/                           # 核心库 (待实现)
  ├── lib/
  │   ├── services/           # 业务逻辑服务
  │   │   ├── encryption/     # 加密服务
  │   │   ├── rate-limiter.service.ts
  │   │   └── audit.service.ts
  │   └── repositories/       # 数据访问层
  └── middleware.ts           # Next.js 中间件

app/                           # Next.js App Router
  ├── api/                    # API 端点
  │   ├── channels/
  │   ├── keys/
  │   ├── publish/
  │   ├── register/
  │   ├── subscribe/
  │   └── cron/
  ├── components/             # React 组件
  └── page.tsx                # 页面
```

### Architecture Patterns

#### 分层架构
```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway Layer                      │
│         (Next.js App Router + Middleware)               │
├─────────────────────────────────────────────────────────┤
│                   Presentation Layer                     │
│              (API Routes / Request Handlers)             │
├─────────────────────────────────────────────────────────┤
│                  Business Logic Layer                    │
│              (Services / 业务逻辑)                       │
├─────────────────────────────────────────────────────────┤
│                 Data Access Layer                        │
│            (Repositories / 数据访问对象)                 │
├─────────────────────────────────────────────────────────┤
│                     Data Layer                           │
│         (PostgreSQL + Redis + File Storage)             │
└─────────────────────────────────────────────────────────┘
```

#### API 响应格式
```typescript
// 成功响应
{ success: true, data: T }

// 错误响应
{ success: false, error: { code: string, message: string } }
```

#### 环境变量
- 所有环境变量在 `.env.example` 中定义
- 生产环境敏感配置: `ADMIN_MASTER_KEY`, `CRON_SECRET`

### Testing Strategy

#### 测试要求
- 所有新功能必须有对应测试
- 目标测试覆盖率 > 80%
- 单元测试覆盖核心逻辑
- 集成测试覆盖 API 端点

#### 测试命令
```bash
npm test                 # 运行所有测试
npm run test:watch       # 监听模式
npm run test:coverage    # 生成覆盖率报告
```

#### 测试框架
- **Vitest**: 测试运行器
- **@vitest/coverage-v8**: V8 覆盖率报告

### Git Workflow

#### 分支命名
| 类型 | 命名模式 | 示例 |
|------|----------|------|
| 功能分支 | `feature/*` | `feature/add-two-factor-auth` |
| Bug 修复 | `bugfix/*` | `bugfix/fix-api-timeout` |
| 文档更新 | `docs/*` | `docs/update-api-reference` |

#### 提交信息约定
```
type(scope): description

Types:
- Add: 新功能
- Update: 更新功能
- Remove: 移除功能
- Refactor: 重构
- Fix: Bug 修复
- Docs: 文档更新
- Test: 测试相关
- Chore: 其他维护工作
```

#### PR 流程
1. Fork 仓库
2. 创建特性分支
3. 提交更改
4. 创建 Pull Request

## Domain Context

### 加密算法
| 算法 | 密钥长度 | 用途 |
|------|----------|------|
| **RSA-2048** | 2048 位 | 默认非对称加密 |
| **RSA-4096** | 4096 位 | 增强安全性 |
| **ECC-SECP256K1** | 256 位 | 椭圆曲线加密 |
| **AES-256-GCM** | 256 位 | 对称加密（混合加密） |

### 频道类型
| 类型 | 说明 | 使用场景 |
|------|------|----------|
| **public** | 公开频道，无加密 | 公告、广播通知 |
| **encrypted** | 加密频道，端到端加密 | 私密消息、敏感通知 |
| **temporary** | 自动过期（默认 30 分钟） | 临时会话、一次性通知 |

### 消息优先级
| 优先级 | 值 | 说明 |
|--------|-----|------|
| **CRITICAL** | 100 | 最高优先级，立即送达 |
| **HIGH** | 75 | 高优先级消息 |
| **NORMAL** | 50 | 默认优先级 |
| **LOW** | 25 | 低优先级 |
| **BULK** | 0 | 批量消息，最低优先级 |

### 工作流程
1. **接收者注册公钥**: 用户将加密公钥注册到服务端
2. **发布者加密消息**: 发布者使用接收者公钥加密内容
3. **服务端加密转发**: SSE 实时推送，全程不解密
4. **接收者私钥解密**: 只有持有私钥的用户才能阅读

## Important Constraints

### 技术约束
- Node.js 版本必须 >= 20.9.0
- TypeScript strict mode 强制启用
- 所有文件必须包含 Apache 2.0 许可证头
- API 响应必须包含 `success` 字段

### 安全约束
- 生产环境必须配置 `ADMIN_MASTER_KEY` 和 `CRON_SECRET`
- 公钥防篡改设计
- 消息端到端加密，服务端不解密
- API 密钥认证、请求限流、审计日志

### 性能约束
- 消息端到端延迟 < 100ms
- 支持 10,000+ SSE 并发连接
- 消息持久化 12 小时

### 部署约束
- Next.js output: standalone
- Vercel 部署优化
- 无优化图片 (unoptimized: true)

## External Dependencies

### 核心服务
| 服务 | 用途 | 连接方式 |
|------|------|----------|
| **PostgreSQL 14+** | 主数据库持久化 | `DATABASE_URL` 环境变量 |
| **Redis 7+** | 缓存、发布订阅、优先级队列 | `REDIS_URL` 环境变量 |

### 云服务
| 服务 | 用途 | 配置 |
|------|------|------|
| **Vercel** | 部署平台 | 自动部署 |

### 外部 API
- 无外部 API 依赖（完全自托管）

### 配置要求
```env
# 必需
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# 生产环境必需
ADMIN_MASTER_KEY=your-secure-key
CRON_SECRET=your-cron-secret

# 可选（使用默认值）
PUBLIC_MESSAGE_TTL=43200
PRIVATE_MESSAGE_TTL=86400
RATE_LIMIT_PUBLISH=10
RATE_LIMIT_SUBSCRIBE=5
RATE_LIMIT_REGISTER=5
```
