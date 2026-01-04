<div align="center">

# 📖 subno.ts 用户指南

### 加密推送通知服务使用指南

[🏠 首页](../README.md) • [📚 文档](README.md) • [🔌 API 参考](API_REFERENCE.md) • [❓ FAQ](FAQ.md)

---

</div>

## 📋 目录

- [简介](#简介)
- [快速开始](#快速开始)
  - [环境准备](#环境准备)
  - [启动服务](#启动服务)
- [核心概念](#核心概念)
- [API 使用](#api-使用)
  - [公钥注册](#公钥注册)
  - [频道管理](#频道管理)
  - [消息推送](#消息推送)
  - [实时订阅](#实时订阅)
- [常见模式](#常见模式)
- [故障排除](#故障排除)

---

## 简介

subno.ts 是一个加密推送通知服务，提供：

- **公钥存储与分发** - 注册和获取加密公钥
- **消息路由** - 发布和订阅实时消息
- **频道管理** - 创建和管理推送频道

### 典型工作流程

```
1. 客户端 A 生成密钥对
2. 客户端 A 注册公钥到服务端
3. 客户端 B 获取客户端 A 的公钥
4. 客户端 A 发送消息（用客户端 B 的公钥加密）
5. 客户端 B 订阅频道接收消息
```

---

## 快速开始

### 环境准备

```bash
# 检查 Node.js 版本
node -v  # 需要 18+

# 检查 PostgreSQL
psql --version

# 检查 Redis
redis-cli --version
```

### 启动服务

**使用 Docker Compose：**

```bash
# 启动数据库和 Redis
docker-compose up -d postgres redis

# 安装依赖
npm install

# 运行迁移
npm run db:migrate

# 启动开发服务器
npm run dev
```

**验证服务：**

```bash
# 测试 API
curl http://localhost:3000/api/channels
```

---

## 核心概念

### 频道 (Channel)

频道是消息推送的逻辑分组：

- **公共频道** - 任何人都可以发布和订阅
- **加密频道** - 需要注册公钥才能发布

### 公钥 (Public Key)

用于端到端加密的公钥：

- 格式：PEM 格式
- 存储：服务端只存储，不解密
- 算法：由客户端指定（RSA、EC 等）

### 消息 (Message)

推送到频道的消息：

- 支持优先级（critical、high、normal、low、bulk）
- 自动创建临时频道
- 支持 SSE 实时推送

---

## API 使用

### 公钥注册

**注册公钥获取频道 ID：**

```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
    "algorithm": "RSA-4096",
    "expiresIn": 604800
  }'
```

**响应：**

```json
{
  "success": true,
  "data": {
    "channelId": "enc_3b6bf5d599c844e3",
    "publicKeyId": "uuid",
    "algorithm": "RSA-4096",
    "expiresAt": "2026-01-10T00:00:00.000Z",
    "expiresIn": 604800
  }
}
```

**获取已注册的公钥：**

```bash
curl "http://localhost:3000/api/register?channelId=enc_xxx"
```

### 频道管理

**创建频道：**

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-channel",
    "name": "我的频道",
    "type": "public",
    "expiresIn": 86400
  }'
```

**查询频道列表：**

```bash
curl "http://localhost:3000/api/channels?limit=10&offset=0"
```

### 消息推送

**发布消息：**

```bash
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "my-channel",
    "message": "Hello, World!",
    "priority": "normal",
    "sender": "Server"
  }'
```

**批量发布：**

```bash
# 发布多条消息
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/publish \
    -H "Content-Type: application/json" \
    -d "{\"channel\": \"my-channel\", \"message\": \"Message $i\"}"
done
```

### 实时订阅

**SSE 订阅：**

```bash
curl -N http://localhost:3000/api/subscribe?channel=my-channel
```

**响应格式（Server-Sent Events）：**

```
event: connected
data: {"channel": "my-channel", "timestamp": 1234567890}

event: message
data: {"id": "msg-1", "channel": "my-channel", "message": "Hello!"}
```

---

## 常见模式

### 模式一：端到端加密通信

```javascript
// 1. Alice 生成密钥对
const { publicKey, privateKey } = generateKeyPair('RSA-4096');

// 2. Alice 注册公钥
const response = await fetch('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: publicKey,
    algorithm: 'RSA-4096'
  })
});
const { channelId } = await response.json();

// 3. Alice 告知 Bob 她的 channelId
// Bob 获取 Alice 的公钥
const keyResponse = await fetch(`/api/keys/${channelId}`);
const { publicKey: alicePublicKey } = await keyResponse.json();

// 4. Bob 用 Alice 的公钥加密消息
const encryptedMessage = encrypt(message, alicePublicKey);

// 5. Bob 发布加密消息
await fetch('/api/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: channelId,
    message: encryptedMessage
  })
});

// 6. Alice 订阅频道接收消息
const eventSource = new EventSource(`/api/subscribe?channel=${channelId}`);
eventSource.onmessage = (event) => {
  const decrypted = decrypt(event.data, privateKey);
  console.log(decrypted);
};
```

### 模式二：实时通知系统

```javascript
// 服务端推送通知
async function sendNotification(userId, notification) {
  await fetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: `user-${userId}`,
      message: JSON.stringify(notification),
      priority: 'high'
    })
  });
}

// 客户端接收通知
const eventSource = new EventSource(`/api/subscribe?channel=user-${userId}`);
eventSource.addEventListener('message', (event) => {
  const notification = JSON.parse(event.data);
  showNotification(notification);
});
```

### 模式三：API 密钥认证

```bash
# 创建 API 密钥
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "name": "My App"}'

# 使用 API 密钥
curl -X DELETE http://localhost:3000/api/keys/channel-123 \
  -H "X-API-Key: sk_live_xxx..."
```

---

## 故障排除

### 问题：连接被拒绝

**检查服务是否运行：**

```bash
curl http://localhost:3000
```

**检查 Docker 服务：**

```bash
docker-compose ps
docker-compose logs postgres
```

### 问题：数据库连接失败

**检查数据库连接字符串：**

```bash
# 测试 PostgreSQL 连接
psql postgresql://securenotify:securenotify@localhost:5432/securenotify

# 检查环境变量
cat .env | grep DATABASE
```

### 问题：Redis 连接失败

```bash
# 测试 Redis 连接
redis-cli ping
```

### 问题：API 返回 429（限流）

**减少请求频率，或配置更高的限流值：**

```env
RATE_LIMIT_PUBLISH=200
RATE_LIMIT_SUBSCRIBE=100
```

---

<div align="center">

**[📖 API 参考](API_REFERENCE.md)** • **[❓ FAQ](FAQ.md)** • **[🏠 首页](../README.md)**

</div>
