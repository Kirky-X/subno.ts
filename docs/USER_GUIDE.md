<div align="center">

# 用户指南

### SecureNotify 完整使用文档

[🏠 首页](../README.md) • [📖 API 参考](API_REFERENCE.md) • [🏗️ 架构设计](ARCHITECTURE.md)

---

</div>

## 目录

- [产品概述](#产品概述)
- [核心概念](#核心概念)
- [快速开始](#快速开始)
- [使用场景](#使用场景)
- [端到端示例](#端到端示例)
- [安全最佳实践](#安全最佳实践)
- [常见问题](#常见问题)

---

## 产品概述

### 什么是 SecureNotify？

**SecureNotify** (subno.ts) 是一个专注于**公钥存储**与**消息分发**的加密推送通知服务。它解决了传统消息推送服务中的安全痛点，提供端到端加密的实时通信能力。

### 核心价值

| 价值 | 说明 |
|------|------|
| **端到端加密** | 消息从发送者到接收者全程加密，即使服务提供商也无法解密 |
| **实时推送** | 基于 Server-Sent Events (SSE) 的即时消息推送 |
| **灵活的频道管理** | 支持公开、加密、临时三种频道类型 |
| **完善的密钥管理** | 自动化的公钥生命周期管理，支持多种加密算法 |
| **企业级安全** | API 密钥认证、请求限流、审计日志 |

### 适用场景

- 加密即时通讯应用
- 敏感信息推送系统
- 安全通知服务
- 端到端加密的 WebSocket 替代方案
- 需要审计追踪的消息系统

---

## 核心概念

### 1. 公钥 (Public Key)

公钥是加密通信的基础，用于加密发送给特定接收者的消息。

**支持的算法：**

| 算法 | 密钥长度 | 说明 |
|------|----------|------|
| **RSA-2048** | 2048 位 | 默认选项，平衡安全性和性能 |
| **RSA-4096** | 4096 位 | 更高安全性，适合敏感数据 |
| **ECC-SECP256K1** | 256 位 | 椭圆曲线加密，更短的密钥 |

**公钥属性：**

```typescript
{
  id: "uuid-string",           // 公钥唯一标识
  channelId: "enc_xxx",        // 关联的加密频道 ID
  publicKey: "-----BEGIN PUBLIC KEY-----...", // PEM 格式公钥
  algorithm: "RSA-4096",       // 加密算法
  createdAt: "2026-01-03T00:00:00.000Z", // 创建时间
  expiresAt: "2026-01-10T00:00:00.000Z", // 过期时间
  isExpired: false,            // 是否已过期
  metadata: { deviceName: "My Device" } // 可选元数据
}
```

### 2. 频道 (Channel)

频道是消息分发的逻辑容器，订阅同一频道的所有用户都能收到该频道的消息。

**频道类型：**

| 类型 | ID 前缀 | 加密 | 自动过期 | 使用场景 |
|------|---------|------|----------|----------|
| **公开频道** | `pub_` | ❌ | 可选 | 公告、广播、公共讨论 |
| **加密频道** | `enc_` | ✅ | 可选 | 私密消息、敏感通知 |
| **临时频道** | `tmp_` | ❌/✅ | 30分钟 | 临时会话、一次性通知 |

**频道属性：**

```typescript
{
  id: "pub_xxx",               // 频道 ID（唯一）
  name: "My Channel",          // 频道名称
  description: "Description",  // 频道描述
  type: "public",              // 类型：public/encrypted/temporary
  creator: "user-123",         // 创建者标识
  createdAt: "2026-01-03T00:00:00.000Z",
  expiresAt: "2026-01-04T00:00:00.000Z", // 过期时间
  isActive: true,              // 是否活跃
  metadata: { tags: ["important"] } // 元数据
}
```

### 3. 消息 (Message)

消息是通过频道分发的实际内容，支持优先级和加密。

**消息属性：**

```typescript
{
  id: "msg_xxx",               // 消息唯一标识
  channel: "pub_xxx",          // 所属频道
  message: "Hello, World!",    // 消息内容
  sender: "User1",             // 发送者标识
  priority: "normal",          // 优先级
  timestamp: 1234567890,       // Unix 时间戳
  encrypted: false,            // 是否加密
  system: false                // 是否系统消息
}
```

**消息优先级：**

| 优先级 | 值 | 说明 |
|--------|-----|------|
| **CRITICAL** | 100 | 最高优先级，立即处理和推送 |
| **HIGH** | 75 | 高优先级，优先于普通消息 |
| **NORMAL** | 50 | 默认优先级 |
| **LOW** | 25 | 低优先级，可以延迟处理 |
| **BULK** | 0 | 批量消息，最低优先级 |

### 4. 订阅 (Subscription)

订阅是客户端接收实时消息的机制，使用 Server-Sent Events (SSE) 协议。

**订阅特点：**

- 持久连接，自动重连
- 支持断线后恢复（使用 `Last-Event-ID`）
- 心跳保活（每 30 秒）
- 低延迟实时推送

### 5. API 密钥 (API Key)

API 密钥用于认证和授权 API 请求。

**权限模型：**

| 权限 | 说明 |
|------|------|
| **read** | 读取频道、消息、密钥 |
| **write** | 发布消息、创建频道 |
| **admin** | 管理 API 密钥、撤销密钥 |

**API 密钥属性：**

```typescript
{
  id: "uuid-string",           // 密钥 ID
  userId: "user-123",          // 关联用户
  name: "My API Key",          // 密钥名称
  permissions: ["read", "write"], // 权限列表
  createdAt: "2026-01-03T00:00:00.000Z",
  expiresAt: "2026-12-31T23:59:59.000Z",
  isActive: true,
  lastUsedAt: "2026-01-03T12:00:00.000Z"
}
```

> ⚠️ **重要提示**：API 密钥只在创建时返回一次，请立即保存！

---

## 快速开始

### 步骤 1：环境准备

```bash
# 确保已安装
node --version  # 应 >= 20.9.0
psql --version  # PostgreSQL 14+
redis-cli --version  # Redis 7+
```

### 步骤 2：配置项目

```bash
# 克隆并安装依赖
git clone https://github.com/your-org/subno.ts.git
cd subno.ts
npm install

# 创建环境配置文件
cp .env.example .env
```

编辑 `.env` 文件：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/securenotify
REDIS_URL=redis://localhost:6379
ADMIN_MASTER_KEY=your-secure-master-key
CRON_SECRET=your-cron-secret
```

### 步骤 3：初始化数据库

```bash
# 运行数据库迁移
npm run db:migrate

# 或在开发模式下推送 schema
npm run db:push
```

### 步骤 4：启动服务

```bash
# 开发模式
npm run dev

# 或构建生产版本
npm run build
npm start
```

服务将在 `http://localhost:3000` 启动。

### 步骤 5：验证安装

```bash
# 创建频道测试
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name": "test-channel", "type": "public"}'

# 预期响应
# {"success": true, "data": {"id": "pub_xxx", ...}}
```

---

## 使用场景

### 场景 1：公开通知频道

适合向所有订阅者发送公告或广播。

```bash
# 1. 创建公开频道
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "announcements",
    "description": "系统公告频道",
    "type": "public"
  }'

# 2. 发布通知
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "announcements",
    "message": "系统将于今晚 10 点进行维护",
    "priority": "high",
    "sender": "System"
  }'

# 3. 订阅实时通知
curl -N http://localhost:3000/api/subscribe?channel=announcements
```

### 场景 2：加密私密消息

适合发送需要端到端加密的私密消息。

```bash
# 1. 生成 RSA 密钥对
# (此处演示使用 openssl，实际应使用安全的密钥生成工具)
TEST_PUBLIC_KEY=$(openssl genrsa 2048 2>/dev/null | openssl rsa -pubout 2>/dev/null | tr -d '\n')
TEST_PRIVATE_KEY=$(openssl genrsa 2048 2>/dev/null)

# 2. 注册公钥（自动创建加密频道）
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$TEST_PUBLIC_KEY\",
    \"algorithm\": \"RSA-2048\",
    \"expiresIn\": 604800
  }"

# 3. 获取频道 ID 和接收者的公钥
# 假设 channelId = "enc_3b6bf5d5"

# 4. 加密消息（使用接收者的公钥）
# 这里需要使用混合加密（RSA + AES）

# 5. 发布加密消息
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "enc_3b6bf5d5",
    "message": "<加密后的消息>",
    "encrypted": true
  }'

# 6. 订阅并解密消息（使用私钥）
```

### 场景 3：临时会话

适合一次性或短时间内的安全通信。

```bash
# 创建临时频道（30 分钟后自动过期）
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "type": "temporary",
    "creator": "user-123"
  }'

# 收到频道 ID，例如：tmp_abc123

# 发送消息...
# 30 分钟后频道自动删除
```

### 场景 4：优先级消息处理

适合需要区分重要性的消息场景。

```bash
# 发送紧急通知（CRITICAL）
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "alerts",
    "message": "检测到异常登录行为！",
    "priority": "critical",
    "sender": "Security"
  }'

# 发送批量数据（BULK）
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "analytics",
    "message": "每日统计报告...",
    "priority": "bulk"
  }'
```

---

## 端到端示例

### 示例 1：完整的加密消息流程

```javascript
// 示例：发送端
const { generateKeyPairSync, publicEncrypt, randomBytes } = require('crypto');

// 生成密钥对
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// 注册公钥
async function registerPublicKey(publicKey) {
  const response = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      algorithm: 'RSA-2048',
      expiresIn: 604800,
      metadata: { deviceName: 'My App' }
    })
  });
  return response.json();
}

// 发送加密消息（简化示例，实际应使用混合加密）
async function sendEncryptedMessage(channelId, message) {
  const encrypted = publicEncrypt(publicKey, Buffer.from(message));
  
  const response = await fetch('http://localhost:3000/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: channelId,
      message: encrypted.toString('base64'),
      encrypted: true
    })
  });
  return response.json();
}

// 使用示例
async function main() {
  const { data: { channelId } } = await registerPublicKey(publicKey);
  await sendEncryptedMessage(channelId, '这是一条加密消息');
}

main();
```

```javascript
// 示例：接收端
const { privateDecrypt } = require('crypto');

// 订阅实时消息
function subscribe(channelId) {
  const eventSource = new EventSource(
    `http://localhost:3000/api/subscribe?channel=${channelId}`
  );

  eventSource.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    
    if (data.encrypted) {
      // 解密消息
      const decrypted = privateDecrypt(
        privateKey,
        Buffer.from(data.message, 'base64')
      );
      console.log('收到消息:', decrypted.toString());
    } else {
      console.log('收到消息:', data.message);
    }
  });

  eventSource.onerror = () => {
    console.log('连接断开，尝试重连...');
  };
}

// 使用示例
subscribe('enc_3b6bf5d5');
```

### 示例 2：使用 API 密钥进行认证

```bash
# 1. 创建 API 密钥（需要 Admin Key）
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-master-admin-key" \
  -d '{
    "userId": "app-user-123",
    "name": "My App Production Key",
    "permissions": ["read", "write"]
  }'

# 响应包含 apiKey（只返回一次！）
# {"data": {"apiKey": "<api-key-id>", ...}}

# 2. 使用 API 密钥发布消息
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key-id>" \
  -d '{
    "channel": "my-channel",
    "message": "Hello from authenticated app!"
  }'
```

### 示例 3：批量消息处理

```javascript
// 批量发布低优先级消息
async function publishBatch(channel, messages) {
  const results = [];
  
  for (const message of messages) {
    const response = await fetch('http://localhost:3000/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        message,
        priority: 'bulk'
      })
    });
    
    results.push(response.json());
  }
  
  return results;
}

// 使用
publishBatch('analytics', ['data1', 'data2', 'data3']);
```

---

## 安全最佳实践

### 1. 密钥管理

```bash
# 定期轮换 API 密钥
# 创建新密钥 -> 迁移应用 -> 撤销旧密钥

# 设置合理的密钥过期时间
# 不要使用永不过期的密钥（生产环境）

# 监控密钥使用情况
# 检查最后使用时间，及时发现异常
```

### 2. 频道安全

```typescript
// 根据敏感程度选择频道类型
const channelConfig = {
  // 公开信息
  announcements: { type: 'public' },
  
  // 敏感但需要分享
  teamUpdates: { type: 'encrypted' },
  
  // 高度敏感
  financialAlerts: { type: 'encrypted' },
  
  // 临时会话
  tempSession: { type: 'temporary' }
};
```

### 3. 访问控制

```typescript
// 使用 API 密钥权限限制访问
const keyPermissions = {
  // 只读服务
  reader: ['read'],
  
  // 消息发送服务
  publisher: ['read', 'write'],
  
  // 完整管理权限
  admin: ['read', 'write', 'admin']
};
```

### 4. 监控和审计

```bash
# 定期检查审计日志
curl "http://localhost:3000/api/cron/cleanup-keys?task=audit-logs" \
  -H "X-Cron-Secret: your-cron-secret"

# 设置审计日志保留期限（默认 90 天）
AUDIT_LOG_RETENTION_DAYS=90
```

### 5. 速率限制

| 端点 | 限制 | 建议 |
|------|------|------|
| `/api/publish` | 10 次/分钟 | 控制消息发送频率 |
| `/api/register` | 5 次/分钟 | 防止密钥滥用 |
| `/api/subscribe` | 5 次/分钟 | 防止连接耗尽 |

---

## 常见问题

### Q1：如何选择加密算法？

| 场景 | 推荐算法 | 说明 |
|------|----------|------|
| 通用场景 | RSA-2048 | 默认选择，平衡安全性与性能 |
| 高安全性需求 | RSA-4096 | 更高安全级别，适合敏感数据 |
| 资源受限环境 | ECC-SECP256K1 | 密钥短，计算效率高 |

### Q2：公钥过期后怎么办？

```bash
# 1. 在过期前生成新密钥对
# 2. 注册新公钥
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "expiresIn": 604800
  }'

# 3. 更新订阅者使用新公钥
# 4. 旧的过期公钥会自动被清理
```

### Q3：如何处理连接断开？

```javascript
// SSE 自动重连机制
const eventSource = new EventSource('/api/subscribe?channel=my-channel');

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

eventSource.onerror = () => {
  reconnectAttempts++;
  
  if (reconnectAttempts <= maxReconnectAttempts) {
    // 使用 Last-Event-ID 恢复丢失的消息
    const lastEventId = eventSource.lastEventId;
    console.log(`尝试重连 (${reconnectAttempts}/${maxReconnectAttempts})...`);
  } else {
    console.log('重连次数过多，停止重连');
  }
};
```

### Q4：消息能发送多大？

| 类型 | 最大大小 |
|------|----------|
| 单条消息 | 4.5 MB (4,718,592 字节) |
| 公钥 | 4 KB (4,096 字节) |
| 频道元数据 | 2 KB (2,048 字节) |

### Q5：如何清理过期数据？

```bash
# 手动触发清理任务
# 清理过期频道
curl "http://localhost:3000/api/cron/cleanup-channels?task=all" \
  -H "X-Cron-Secret: your-cron-secret"

# 清理过期密钥和日志
curl "http://localhost:3000/api/cron/cleanup-keys?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

### Q6：频道和密钥有什么关系？

```
一个加密频道 (enc_xxx)
  ↓
关联一个公钥 (public key)
  ↓
只有持有对应私钥的接收者才能解密该频道的消息
```

**公开频道**不需要公钥，任何人都可以订阅。

### Q7：如何在生产环境部署？

```bash
# 1. 设置生产环境变量
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export ADMIN_MASTER_KEY="your-production-key"
export CRON_SECRET="your-cron-secret"

# 2. 构建应用
npm run build

# 3. 使用 process manager 运行
pm2 start npm --name "securenotify" -- run start

# 4. 配置反向代理（可选）
# Nginx/Traefik 配置 HTTPS 和负载均衡
```

### Q8：如何扩展处理能力？

| 扩展方向 | 方案 |
|----------|------|
| 水平扩展 | 运行多个 Next.js 实例，共享 PostgreSQL 和 Redis |
| 消息队列 | 使用 Redis Streams 处理高吞吐量 |
| CDN 加速 | 静态资源通过 CDN 分发 |
| 数据库读写分离 | 主库写入，从库读取 |

---

## 相关资源

| 资源 | 链接 |
|------|------|
| API 参考 | [docs/API_REFERENCE.md](API_REFERENCE.md) |
| 架构设计 | [docs/ARCHITECTURE.md](ARCHITECTURE.md) |
| 项目仓库 | https://github.com/your-org/subno.ts |
| 问题反馈 | https://github.com/your-org/subno.ts/issues |

---

<div align="center">

**[🏠 首页](../README.md)** • **[📖 API 参考](API_REFERENCE.md)** • **[🏗️ 架构设计](ARCHITECTURE.md)**

</div>
