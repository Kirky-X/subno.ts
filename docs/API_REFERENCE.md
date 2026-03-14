# API 参考

### SecureNotify API 完整文档

[🏠 首页](../README.md) • [📖 用户指南](USER_GUIDE.md) • [🏗️ 架构](ARCHITECTURE.md)

---

## 概述

### 基础 URL

```
生产环境: https://your-domain.com/api
开发环境: http://localhost:3000/api
```

### 响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
  };
}
```

---

## API 实现状态总览

| API 端点 | 方法 | 状态 | 说明 |
|----------|------|------|------|
| `/api/keys/[id]` | DELETE | ✅ 已实现 | 密钥删除（两阶段确认） |
| `/api/keys/[id]/revoke` | POST, GET | ✅ 已实现 | 请求/查询密钥撤销 |
| `/api/keys/[id]/revoke/cancel` | POST | ✅ 已实现 | 取消撤销请求 |
| `/api/register` | POST, GET | ✅ 已实现 | 公钥注册与查询 |
| `/api/channels` | POST, GET | ✅ 已实现 | 频道创建与查询 |
| `/api/publish` | POST, GET | ✅ 已实现 | 消息发布与队列状态 |
| `/api/subscribe` | GET (SSE) | ✅ 已实现 | 实时消息订阅 |
| `/api/cron/cleanup-channels` | GET | ✅ 已实现 | 频道清理 |
| `/api/cron/cleanup-keys` | GET | ✅ 已实现 | 密钥清理 |

---

## 公钥注册

### POST /api/register

注册新的加密公钥，自动创建加密频道。

**认证**: 无需认证

**请求**:

```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
  "algorithm": "RSA-4096",
  "expiresIn": 604800,
  "metadata": {
    "deviceName": "My Device"
  }
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| publicKey | string | 是 | PEM 格式公钥 |
| algorithm | string | 否 | 算法：RSA-2048, RSA-4096, ECC-SECP256K1 |
| expiresIn | number | 否 | 有效期秒数（最大 30 天） |
| metadata | object | 否 | 元数据 |

**响应 (201)**:

```json
{
  "success": true,
  "data": {
    "channelId": "enc_3b6bf5d599c844e3",
    "publicKeyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "algorithm": "RSA-4096",
    "expiresAt": "2026-01-20T00:00:00.000Z",
    "expiresIn": 604800
  }
}
```

---

### GET /api/register

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

查询已注册的公钥信息。

**请求**:

```
GET /api/register?channelId=enc_xxx
GET /api/register?keyId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "enc_xxx",
    "algorithm": "RSA-4096",
    "createdAt": "2026-01-13T00:00:00.000Z",
    "expiresAt": "2026-01-20T00:00:00.000Z",
    "lastUsedAt": "2026-01-14T12:00:00.000Z",
    "isExpired": false
  }
}
```

---

## 频道管理

### POST /api/channels

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

创建新频道。

**请求**:

```json
{
  "id": "my-channel",
  "name": "我的频道",
  "description": "频道描述",
  "type": "public",
  "creator": "user-123",
  "expiresIn": 86400,
  "metadata": {
    "tags": ["important"]
  }
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 否 | 频道 ID |
| name | string | 否 | 频道名称 |
| type | string | 否 | 类型：public, encrypted |
| expiresIn | number | 否 | 有效期秒数 |

**响应 (201)**:

```json
{
  "success": true,
  "data": {
    "id": "my-channel",
    "name": "我的频道",
    "type": "public",
    "createdAt": "2026-01-13T00:00:00.000Z",
    "expiresAt": "2026-01-14T00:00:00.000Z",
    "isActive": true
  }
}
```

---

### GET /api/channels

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

查询频道列表或获取特定频道。

**请求**:

```
GET /api/channels?id=my-channel
GET /api/channels?limit=10&offset=0
GET /api/channels?type=public
```

**响应 (200)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "my-channel",
      "name": "我的频道",
      "type": "public",
      "createdAt": "2026-01-13T00:00:00.000Z",
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

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

发布消息到频道。

**认证**: 可选 (X-API-Key)

**请求**:

```json
{
  "channel": "my-channel",
  "message": "Hello, World!",
  "priority": "normal",
  "sender": "Server",
  "cache": true,
  "encrypted": false,
  "autoCreate": true
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | string | 是 | 频道 ID |
| message | string | 是 | 消息内容 |
| priority | string | 否 | 优先级：critical, high, normal, low, bulk |
| encrypted | boolean | 否 | 是否加密 |
| autoCreate | boolean | 否 | 自动创建频道 |

**响应 (201)**:

```json
{
  "success": true,
  "data": {
    "messageId": "msg_1767521101483_xxxxxxxxxx",
    "channel": "my-channel",
    "publishedAt": "2026-01-13T00:00:00.000Z",
    "autoCreated": false
  }
}
```

---

### GET /api/publish

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

获取频道消息队列状态。

**请求**:

```
GET /api/publish?channel=my-channel&count=10
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "channel": "my-channel",
    "messages": [
      {
        "id": "msg_xxx",
        "message": "Hello!",
        "sender": "User1",
        "timestamp": 1234567890,
        "priority": "normal"
      }
    ],
    "queueLength": 5
  }
}
```

---

## 实时订阅

### GET /api/subscribe

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

通过 Server-Sent Events (SSE) 订阅频道实时消息。

**请求**:

```
GET /api/subscribe?channel=my-channel
```

**响应格式**:

```
event: connected
data: {"channel":"my-channel","type":"channel","timestamp":1234567890}

event: message
id: msg_1234567890
data: {"id":"msg_1234567890","channel":"my-channel","message":"Hello!"}
```

**JavaScript 示例**:

```javascript
const eventSource = new EventSource('/api/subscribe?channel=my-channel');

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data.message);
});

eventSource.onerror = (error) => {
  console.log('连接断开，尝试重连...');
};
```

---

## 密钥管理 ✅ 已实现

### GET /api/keys/[id]

获取公钥信息。

**请求**:

```
GET /api/keys/enc_channel_id
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "enc_channel_id",
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
    "algorithm": "RSA-4096",
    "createdAt": "2026-01-13T00:00:00.000Z",
    "expiresAt": "2026-01-20T00:00:00.000Z"
  }
}
```

---

### POST /api/keys/[id]/revoke

请求撤销公钥（需要认证，启动两阶段确认流程）。

**认证**: X-API-Key (必需)

**请求**:

```json
{
  "reason": "Key rotation required",
  "confirmationHours": 24
}
```

**响应 (201)**:

```json
{
  "success": true,
  "data": {
    "revocationId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "keyId": "enc_channel_id",
    "status": "pending",
    "expiresAt": "2026-01-15T01:00:00.000Z",
    "confirmationCodeSent": true
  }
}
```

---

### DELETE /api/keys/[id]

确认执行密钥撤销。

**请求**:

```
DELETE /api/keys/enc_channel_id?confirmationCode=xxxxxx
X-API-Key: <api-key-id>
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "deletedId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "enc_channel_id",
    "deletedAt": "2026-01-14T01:00:00.000Z"
  }
}
```

---

### POST /api/keys/[id]/revoke/cancel

取消待确认的撤销请求。

**请求**:

```
POST /api/keys/enc_channel_id/revoke/cancel
X-API-Key: <api-key-id>
```

**响应 (200)**:

```json
{
  "success": true,
  "message": "Revocation cancelled successfully"
}
```

---

## 定时任务

### GET /api/cron/cleanup-channels

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

清理过期频道（需要 cron secret）。

**认证**: X-Cron-Secret (必需)

**请求**:

```
GET /api/cron/cleanup-channels?task=all
X-Cron-Secret: your-cron-secret
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "task": "all",
    "persistentChannelsMarkedInactive": 10,
    "temporaryChannelsDeleted": 5,
    "duration": "150ms"
  }
}
```

---

### GET /api/cron/cleanup-keys

> ⚠️ **注意**：此 API 端点正在开发中，暂不可用。

清理过期密钥和数据（需要 cron secret）。

**请求**:

```
GET /api/cron/cleanup-keys?task=all
X-Cron-Secret: your-cron-secret
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "task": "all",
    "results": {
      "expiredKeys": { "deleted": 15 },
      "auditLogs": { "deleted": 100 }
    }
  }
}
```

---

## 错误处理

### 错误码参考

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 401 | AUTH_REQUIRED | API 密钥必需但未提供 |
| 401 | AUTH_FAILED | API 密钥无效 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CHANNEL_EXISTS | 频道已存在 |
| 410 | KEY_EXPIRED | 密钥已过期 |
| 413 | MESSAGE_TOO_LARGE | 消息太大 |
| 429 | RATE_LIMIT_EXCEEDED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 速率限制

| 端点 | 限制 | 时间窗口 |
|------|------|----------|
| POST /api/publish | 10 次 | 60 秒 |
| POST /api/register | 5 次 | 60 秒 |
| GET /api/subscribe | 5 次 | 60 秒 |

---

<div align="center">

**[🏠 首页](../README.md)** • **[📖 用户指南](USER_GUIDE.md)** • **[🏗️ 架构设计](ARCHITECTURE.md)**

</div>