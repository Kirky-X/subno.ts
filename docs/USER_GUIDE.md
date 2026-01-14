# 用户指南

### SecureNotify 完整使用文档

[🏠 首页](../README.md) • [📖 API 参考](API_REFERENCE.md) • [🏗️ 架构设计](ARCHITECTURE.md)

---

## 产品概述

### 什么是 SecureNotify？

**SecureNotify** (subno.ts) 是一个专注于**公钥存储**与**消息分发**的加密推送通知服务。它提供端到端加密的实时通信能力。

### 核心价值

| 价值 | 说明 |
|------|------|
| **端到端加密** | 消息全程加密，服务提供商无法解密 |
| **实时推送** | 基于 SSE 的即时消息推送 |
| **灵活的频道管理** | 支持公开、加密、临时三种频道类型 |
| **完善的密钥管理** | 自动化的公钥生命周期管理 |
| **企业级安全** | API 密钥认证、请求限流、审计日志 |

### 适用场景

- 加密即时通讯应用
- 敏感信息推送系统
- 安全通知服务
- 端到端加密的 WebSocket 替代方案

---

## 核心概念

### 1. 公钥 (Public Key)

公钥是加密通信的基础，用于加密发送给特定接收者的消息。

**支持的算法**：

| 算法 | 密钥长度 | 说明 |
|------|----------|------|
| **RSA-2048** | 2048 位 | 默认选项 |
| **RSA-4096** | 4096 位 | 更高安全性 |
| **ECC-SECP256K1** | 256 位 | 椭圆曲线加密 |

### 2. 频道 (Channel)

频道是消息分发的逻辑容器。

**频道类型**：

| 类型 | ID 前缀 | 加密 | 使用场景 |
|------|---------|------|----------|
| **公开频道** | `pub_` | ❌ | 公告、广播 |
| **加密频道** | `enc_` | ✅ | 私密消息 |
| **临时频道** | `tmp_` | ❌/✅ | 临时会话 |

### 3. 消息 (Message)

消息是通过频道分发的实际内容。

**消息优先级**：

| 优先级 | 值 | 说明 |
|--------|-----|------|
| **CRITICAL** | 100 | 最高优先级 |
| **HIGH** | 75 | 高优先级 |
| **NORMAL** | 50 | 默认优先级 |
| **LOW** | 25 | 低优先级 |
| **BULK** | 0 | 批量消息 |

### 4. API 密钥 (API Key)

API 密钥用于认证和授权 API 请求。

**权限模型**：

| 权限 | 说明 |
|------|------|
| **read** | 读取频道、消息、密钥 |
| **write** | 发布消息、创建频道 |
| **admin** | 管理 API 密钥、撤销密钥 |

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

### 步骤 3：启动服务

```bash
# 开发模式
npm run dev

# 或构建生产版本
npm run build
npm start
```

服务将在 `http://localhost:3000` 启动。

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
    "priority": "high"
  }'

# 3. 订阅实时通知
curl -N http://localhost:3000/api/subscribe?channel=announcements
```

### 场景 2：加密私密消息

适合发送需要端到端加密的私密消息。

```bash
# 1. 生成测试公钥
TEST_PUBLIC_KEY=$(openssl genrsa 2048 2>/dev/null | openssl rsa -pubout 2>/dev/null | tr -d '\n')

# 2. 注册公钥（自动创建加密频道）
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$TEST_PUBLIC_KEY\",
    \"algorithm\": \"RSA-2048\",
    \"expiresIn\": 604800
  }"

# 3. 发布加密消息
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "enc_xxx",
    "message": "<加密后的消息>",
    "encrypted": true
  }'
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
```

---

## 端到端示例

### 示例 1：完整的加密消息流程

```javascript
// 发送端
const { generateKeyPairSync, publicEncrypt } = require('crypto');

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
      expiresIn: 604800
    })
  });
  return response.json();
}

// 发送加密消息
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
```

```javascript
// 接收端
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
    }
  });
}
```

---

## 安全最佳实践

### 1. 密钥管理

```bash
# 定期轮换 API 密钥
# 创建新密钥 -> 迁移应用 -> 撤销旧密钥

# 设置合理的密钥过期时间
# 不要使用永不过期的密钥

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
  financialAlerts: { type: 'encrypted' }
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

---

## 常见问题

### Q1：如何选择加密算法？

| 场景 | 推荐算法 | 说明 |
|------|----------|------|
| 通用场景 | RSA-2048 | 默认选择 |
| 高安全性需求 | RSA-4096 | 更高安全级别 |
| 资源受限环境 | ECC-SECP256K1 | 密钥短，计算效率高 |

### Q2：消息能发送多大？

| 类型 | 最大大小 |
|------|----------|
| 单条消息 | 4.5 MB |
| 公钥 | 4 KB |
| 频道元数据 | 2 KB |

### Q3：如何清理过期数据？

```bash
# 手动触发清理任务
curl "http://localhost:3000/api/cron/cleanup-channels?task=all" \
  -H "X-Cron-Secret: your-cron-secret"

curl "http://localhost:3000/api/cron/cleanup-keys?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

---

## 相关资源

| 资源 | 链接 |
|------|------|
| API 参考 | [docs/API_REFERENCE.md](API_REFERENCE.md) |
| 架构设计 | [docs/ARCHITECTURE.md](ARCHITECTURE.md) |
| 项目仓库 | https://github.com/your-org/subno.ts |

---

<div align="center">

**[🏠 首页](../README.md)** • **[📖 API 参考](API_REFERENCE.md)** • **[🏗️ 架构设计](ARCHITECTURE.md)**

</div>