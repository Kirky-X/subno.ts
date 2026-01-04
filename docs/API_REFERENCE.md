<div align="center">

# 📘 API 参考

### subno.ts API 完整文档

[🏠 首页](../README.md) • [📖 用户指南](USER_GUIDE.md) • [🏗️ 架构](ARCHITECTURE.md)

---

</div>

## 📋 目录

- [概述](#概述)
- [公钥注册](#公钥注册)
- [频道管理](#频道管理)
- [消息推送](#消息推送)
- [实时订阅](#实时订阅)
- [密钥管理](#密钥管理)
- [定时任务](#定时任务)
- [错误处理](#错误处理)

---

## 概述

### 基础 URL

```
http://localhost:3000/api
```

### 内容类型

所有请求和响应使用 JSON 格式：

```
Content-Type: application/json
```

### 认证方式

- **公开端点**：无需认证
- **敏感操作**：需要 `X-API-Key` 请求头

---

## 公钥注册

### POST /api/register

注册新的加密公钥，自动创建加密频道。

**请求：**

```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
    "algorithm": "RSA-4096",
    "expiresIn": 604800,
    "metadata": {
      "deviceName": "My Device",
      "appVersion": "1.0.0"
    }
  }'
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `publicKey` | string | 是 | PEM 格式公钥 |
| `algorithm` | string | 否 | 算法标识符（默认：RSA-2048） |
| `expiresIn` | number | 否 | 有效期秒数（默认：604800=7天） |
| `metadata` | object | 否 | 元数据（deviceName、appVersion） |

**响应（201）：**

```json
{
  "success": true,
  "data": {
    "channelId": "enc_3b6bf5d599c844e3",
    "publicKeyId": "uuid-string",
    "algorithm": "RSA-4096",
    "expiresAt": "2026-01-10T00:00:00.000Z",
    "expiresIn": 604800
  }
}
```

---

### GET /api/register

查询已注册的公钥信息。

**请求：**

```bash
# 按频道 ID 查询
curl "http://localhost:3000/api/register?channelId=enc_xxx"

# 按密钥 ID 查询
curl "http://localhost:3000/api/register?keyId=uuid-string"
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `channelId` | string | 否* | 频道 ID |
| `keyId` | string | 否* | 密钥 ID |

**响应（200）：**

```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "channelId": "enc_xxx",
    "algorithm": "RSA-4096",
    "createdAt": "2026-01-03T00:00:00.000Z",
    "expiresAt": "2026-01-10T00:00:00.000Z",
    "isExpired": false
  }
}
```

---

## 频道管理

### POST /api/channels

创建新频道。

**请求：**

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-channel",
    "name": "我的频道",
    "description": "频道描述",
    "type": "public",
    "expiresIn": 86400
  }'
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 否 | 频道 ID（自动生成） |
| `name` | string | 否 | 频道名称 |
| `description` | string | 否 | 频道描述 |
| `type` | string | 否 | 类型：public/encrypted（默认：public） |
| `expiresIn` | number | 否 | 有效期秒数 |

**响应（201）：**

```json
{
  "success": true,
  "data": {
    "id": "my-channel",
    "name": "我的频道",
    "description": "频道描述",
    "type": "public",
    "creator": null,
    "createdAt": "2026-01-03T00:00:00.000Z",
    "expiresAt": "2026-01-04T00:00:00.000Z",
    "isActive": true,
    "metadata": null
  }
}
```

---

### GET /api/channels

查询频道列表或获取特定频道。

**请求：**

```bash
# 查询单个频道
curl "http://localhost:3000/api/channels?id=my-channel"

# 列出所有频道
curl "http://localhost:3000/api/channels?limit=10&offset=0"

# 按类型筛选
curl "http://localhost:3000/api/channels?type=public"
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 频道 ID |
| `type` | string | 筛选类型：public/private/encrypted |
| `limit` | number | 返回数量（默认：50，最大：100） |
| `offset` | number | 偏移量（默认：0） |

**响应（200）：**

```json
{
  "success": true,
  "data": [
    {
      "id": "my-channel",
      "name": "我的频道",
      "type": "public",
      "creator": null,
      "createdAt": "2026-01-03T00:00:00.000Z",
      "expiresAt": "2026-01-04T00:00:00.000Z",
      "isActive": true
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## 消息推送

### POST /api/publish

发布消息到频道。

**请求：**

```bash
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "my-channel",
    "message": "Hello, World!",
    "priority": "normal",
    "sender": "Server",
    "cache": true,
    "encrypted": false,
    "autoCreate": true
  }'
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `channel` | string | 是 | 频道 ID |
| `message` | string | 是 | 消息内容 |
| `priority` | string | 否 | 优先级：critical/high/normal/low/bulk |
| `sender` | string | 否 | 发送者名称 |
| `cache` | boolean | 否 | 是否缓存消息（默认：true） |
| `encrypted` | boolean | 否 | 是否加密消息（默认：false） |
| `autoCreate` | boolean | 否 | 自动创建临时频道（默认：true） |

**响应（201）：**

```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "channel": "my-channel",
    "publishedAt": "2026-01-03T00:00:00.000Z"
  }
}
```

---

### GET /api/publish

获取频道消息队列状态。

**请求：**

```bash
curl "http://localhost:3000/api/publish?channel=my-channel&count=10"
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `channel` | string | 频道 ID（必填） |
| `count` | number | 获取消息数量（默认：10，最大：100） |

**响应（200）：**

```json
{
  "success": true,
  "data": {
    "channel": "my-channel",
    "messages": [
      {
        "id": "uuid",
        "message": "Hello!",
        "sender": "User1",
        "timestamp": 1234567890
      }
    ],
    "queueLength": 5
  }
}
```

---

## 实时订阅

### GET /api/subscribe

通过 Server-Sent Events (SSE) 订阅频道实时消息。

**请求：**

```bash
curl -N http://localhost:3000/api/subscribe?channel=my-channel
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `channel` | string | 是 | 频道 ID |
| `lastEventId` | string | 否 | 断线后恢复的 Event ID |

**响应格式（Server-Sent Events）：**

```
# 连接确认
event: connected
data: {"channel":"my-channel","type":"channel","timestamp":1234567890,"message":"Connected"}

# 消息事件
event: message
id: event-123
data: {"id":"msg-uuid","channel":"my-channel","message":"Hello!","sender":"User1","timestamp":1234567890}

# Keepalive（每 30 秒）
: keepalive
```

**JavaScript 示例：**

```javascript
const eventSource = new EventSource('/api/subscribe?channel=my-channel');

eventSource.addEventListener('connected', (event) => {
  console.log('已连接:', JSON.parse(event.data));
});

eventSource.addEventListener('message', (event) => {
  console.log('收到消息:', JSON.parse(event.data));
});

eventSource.onerror = (error) => {
  console.log('连接断开，尝试重连...');
};
```

---

## 密钥管理

### GET /api/keys/[id]

获取公钥信息。

**请求：**

```bash
curl http://localhost:3000/api/keys/enc_channel_id
```

**响应（200）：**

```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "channelId": "enc_channel_id",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
    "algorithm": "RSA-4096",
    "createdAt": "2026-01-03T00:00:00.000Z",
    "expiresAt": "2026-01-10T00:00:00.000Z",
    "lastUsedAt": "2026-01-03T12:00:00.000Z",
    "metadata": {"deviceName": "My Device"}
  }
}
```

---

### DELETE /api/keys/[id]

撤销公钥（需要认证）。

**请求：**

```bash
curl -X DELETE http://localhost:3000/api/keys/enc_channel_id \
  -H "X-API-Key: sk_live_xxx..."
```

**响应（200）：**

```json
{
  "success": true,
  "message": "Public key revoked successfully",
  "data": {
    "deletedId": "uuid-string",
    "channelId": "enc_channel_id"
  }
}
```

---

### POST /api/keys

创建 API 密钥。

**请求：**

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "name": "My App API Key",
    "permissions": ["read", "write"],
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }'
```

**响应（201）：**

```json
{
  "success": true,
  "message": "API key created successfully. Store this key securely - it cannot be retrieved again.",
  "data": {
    "key": "***REMOVED***xxxxxxxx",
    "info": {
      "id": "uuid",
      "keyPrefix": "sk_live",
      "userId": "user-123",
      "name": "My App API Key",
      "permissions": ["read", "write"],
      "isActive": true,
      "createdAt": "2026-01-03T00:00:00.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z"
    }
  }
}
```

---

## 定时任务

### GET /api/cron/cleanup-channels

清理过期频道（需要 cron secret）。

**请求：**

```bash
curl "http://localhost:3000/api/cron/cleanup-channels?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

**任务类型：**

| task | 说明 |
|------|------|
| `persistent` | 清理过期的持久化频道 |
| `temporary` | 清理过期的临时频道 |
| `all`（默认） | 执行所有清理任务 |

**响应（200）：**

```json
{
  "success": true,
  "data": {
    "task": "all",
    "persistentChannelsMarkedInactive": 10,
    "temporaryChannelsDeleted": 5,
    "errors": [],
    "duration": "150ms",
    "timestamp": "2026-01-03T00:00:00.000Z"
  }
}
```

---

### GET /api/cron/cleanup-keys

清理过期密钥和数据（需要 cron secret）。

**请求：**

```bash
curl "http://localhost:3000/api/cron/cleanup-keys?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

**任务类型：**

| task | 说明 |
|------|------|
| `expired-keys` | 清理过期公钥 |
| `audit-logs` | 清理旧审计日志 |
| `orphaned-keys` | 清理孤立 Redis 密钥 |
| `messages` | 清理旧消息 |
| `all`（默认） | 执行所有清理任务 |

**响应（200）：**

```json
{
  "success": true,
  "data": {
    "task": "all",
    "results": {
      "expiredKeys": { "deleted": 15, "errors": [] },
      "auditLogs": { "deleted": 100, "errors": [] },
      "orphanedKeys": { "deleted": 8, "errors": [] },
      "oldMessages": { "deleted": 50, "errors": [] }
    },
    "timestamp": "2026-01-03T00:00:00.000Z"
  }
}
```

---

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "message": "错误描述",
    "code": "ERROR_CODE",
    "details": [] // 可选的详细错误信息
  }
}
```

### 常见错误码

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 400 | INVALID_JSON | JSON 解析失败 |
| 400 | INVALID_CHANNEL_FORMAT | 频道 ID 格式无效 |
| 401 | AUTH_REQUIRED | 需要认证 |
| 401 | AUTH_FAILED | 认证失败 |
| 401 | UNAUTHORIZED | Cron secret 无效 |
| 404 | NOT_FOUND | 资源不存在 |
| 404 | CHANNEL_NOT_FOUND | 频道不存在 |
| 409 | CHANNEL_EXISTS | 频道已存在 |
| 409 | DUPLICATE_KEY | 密钥已存在 |
| 410 | KEY_EXPIRED | 密钥已过期 |
| 413 | KEY_TOO_LARGE | 公钥太大 |
| 413 | METADATA_TOO_LARGE | 元数据太大 |
| 413 | MESSAGE_TOO_LARGE | 消息太大 |
| 429 | RATE_LIMIT_EXCEEDED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

<div align="center">

**[📖 用户指南](USER_GUIDE.md)** • **[🏗️ 架构设计](ARCHITECTURE.md)** • **[🏠 首页](../README.md)**

</div>
