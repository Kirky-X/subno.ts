# 架构设计文档

### SecureNotify 系统架构详解

[🏠 首页](../README.md) • [📖 用户指南](USER_GUIDE.md) • [📘 API 参考](API_REFERENCE.md)

---

## 系统概览

### 产品定位

**SecureNotify** 是一个专注于**端到端加密**的推送通知服务，旨在为应用程序提供安全、实时、可靠的消息分发能力。

### 设计目标

| 目标 | 描述 |
|------|------|
| **安全性** | 端到端加密，密钥管理，审计日志 |
| **实时性** | 基于 SSE 的实时消息推送 |
| **可靠性** | 消息持久化，重连机制，优先级队列 |
| **可扩展性** | 水平扩展，支持高并发 |

### 核心指标

| 指标 | 目标值 |
|------|--------|
| 消息延迟 | < 100ms |
| 连接稳定性 | 99.9% 可用性 |
| 消息持久化 | 12 小时 |
| 并发连接数 | 10,000+ |

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        SecureNotify 架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Client 1   │     │   Client 2   │     │   Client N   │   │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│         │                    │                    │           │
│         └────────────────────┼────────────────────┘           │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Next.js API Gateway                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                               │
│         ┌────────────────────┼────────────────────┐            │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   /api/      │     │   /api/      │     │   /api/      │   │
│  │  register    │     │  channels    │     │  publish     │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                     业务逻辑层                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                               │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │ PostgreSQL   │     │    Redis     │     │  Audit Logs  │   │
│  │  (主数据库)   │     │  (缓存/队列)  │     │  (存储)       │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. API Gateway

**技术栈**: Next.js 16 + TypeScript

**职责**:
- HTTP 请求路由
- 请求/响应处理
- 中间件集成 (CORS, Security Headers)
- 认证/授权

### 2. 加密服务

#### RSA 加密服务

```typescript
class RsaService {
  generateKey(keySize: number = 4096): KeyPair
  encrypt(plaintext: string, publicKey: string): string
  decrypt(ciphertext: string, privateKey: string): string
  sign(message: string, privateKey: string): string
  verify(signature: string, message: string, publicKey: string): boolean
}
```

**支持的算法**:
- RSA-2048 (默认)
- RSA-4096 (增强安全)
- ECC-SECP256K1 (椭圆曲线)

#### AES 加密服务

```typescript
class AesService {
  encrypt(plaintext: string, key?: Buffer): EncryptResult
  decrypt(ciphertext: string, iv: string, tag: string, key: Buffer): string
  generateKey(): Buffer
}
```

**规格**:
- 算法: AES-256-GCM
- 密钥长度: 32 字节
- IV 长度: 16 字节

### 3. 消息服务

**职责**:
- 消息发布
- 消息订阅 (SSE)
- 消息队列管理
- 优先级处理

**消息优先级**:
```typescript
enum MessagePriority {
  CRITICAL = 100,
  HIGH = 75,
  NORMAL = 50,
  LOW = 25,
  BULK = 0
}
```

### 4. 密钥管理服务

**职责**:
- 公钥注册/查询/撤销
- API 密钥管理
- 密钥缓存
- 两阶段撤销确认

### 5. 审计日志服务

**职责**:
- 操作记录
- 日志存储
- 日志查询
- 日志清理

---

## 数据流程

### 消息发布流程

```
Client
  │
  ▼
POST /api/publish
  │
  ▼
1. 请求验证 (Zod Schema)
  │
  ▼
2. 速率限制检查 (Redis Counter)
  │
  ▼
3. 认证检查 (X-API-Key)
  │
  ▼
4. 频道验证/创建
  │
  ▼
5. 消息加密 (如果 encrypted: true)
  │
  ▼
6. 消息存储
  │
  ▼
7. 审计日志记录
  │
  ▼
返回 201 Created
```

### 实时订阅流程

```
Client
  │
  ▼
GET /api/subscribe?channel=my-channel
  │
  ▼
1. 频道验证
  │
  ▼
2. 建立 SSE 连接
  │
  ▼
3. 发送连接确认
  │
  ▼
4. 订阅 Redis Pub/Sub
  │
  ▼
5. 消息循环
  │
  ├─ 等待新消息
  ├─ 发送 SSE 消息
  └─ Keepalive (每 30 秒)
```

---

## 安全性设计

### 加密体系

```
Layer 1: 传输加密
  • HTTPS/TLS 1.3
  • 证书验证

Layer 2: 应用层加密
  • 端到端加密 (E2EE)
  • 混合加密 (RSA + AES-256-GCM)

Layer 3: 数据存储加密
  • 敏感数据加密存储
  • 密钥哈希存储

Layer 4: 访问控制
  • API 密钥认证
  • 权限控制
```

### 速率限制

```typescript
class RateLimiter {
  async checkIpLimit(ip: string, limit: number, window: number): Promise<boolean>
  async checkUaLimit(uaHash: string, limit: number, window: number): Promise<boolean>
}
```

**双重限流策略**:
- IP 限制：严格控制
- User-Agent 限制：宽松控制

---

## 性能考虑

### 缓存策略

```typescript
// Cache-Aside 模式
class KeyCacheService {
  async get(publicKeyId: string): Promise<PublicKey | null> {
    // 1. 先查 Redis 缓存
    const cached = await redis.get(`key:${publicKeyId}`);
    if (cached) return cached;
    
    // 2. 缓存未命中，查数据库
    const key = await db.publicKeys.findById(publicKeyId);
    if (key) {
      // 3. 写入缓存 (TTL: 7 天)
      await redis.setex(`key:${publicKeyId}`, 604800, key);
    }
    return key;
  }
}
```

### 数据库优化

- 使用索引优化查询
- 连接池管理
- 批量操作优化

---

## 可扩展性

### 水平扩展

- 无状态 API 服务
- 共享 PostgreSQL 和 Redis
- 负载均衡器分发请求

### 垂直扩展

- 增加数据库连接池
- 优化 Redis 配置
- 增加服务器资源

---

<div align="center">

**[🏠 首页](../README.md)** • **[📖 用户指南](USER_GUIDE.md)** • **[📘 API 参考](API_REFERENCE.md)**

</div>