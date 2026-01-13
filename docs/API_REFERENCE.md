<div align="center">

# API 参考

### subno.ts API 完整文档

[🏠 首页](../README.md) • [📖 用户指南](USER_GUIDE.md) • [🏗️ 架构](ARCHITECTURE.md)

---

</div>

## 目录

- [概述](#概述)
- [认证](#认证)
- [公钥注册](#公钥注册)
- [频道管理](#频道管理)
- [消息推送](#消息推送)
- [实时订阅](#实时订阅)
- [密钥管理](#密钥管理)
- [定时任务](#定时任务)
- [错误处理](#错误处理)
- [速率限制](#速率限制)
- [测试指南](#测试指南)

---

## 概述

### 基础 URL

```
生产环境: https://your-domain.com/api
开发环境: http://localhost:3000/api
```

### 内容类型

所有请求和响应使用 JSON 格式：

```http
Content-Type: application/json
Accept: application/json
```

### 响应格式

所有 API 响应遵循统一的格式：

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
    details?: ValidationErrorDetail[];
    timestamp: string;
  };
}

// 分页响应
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

---

## 认证

### 认证方式

API 使用以下认证方式：

| 认证头 | 类型 | 用途 | 必需 |
|--------|------|------|------|
| `X-API-Key` | API 密钥 | 日常 API 调用，根据权限访问 | 视端点而定 |
| `X-Admin-Key` | Master Key | 管理员操作（创建密钥、管理权限） | 敏感操作必需 |
| `X-Cron-Secret` | Cron Secret | 定时任务触发 | Cron 端点必需 |

### 权限模型

API 密钥支持以下权限：

| 权限 | 能力 |
|------|------|
| `read` | 读取频道、消息、公钥信息 |
| `write` | 发布消息、创建频道 |
| `admin` | 管理 API 密钥、撤销密钥 |

### 认证示例

```bash
# 使用 API 密钥发布消息
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key-id>" \
  -d '{
    "channel": "my-channel",
    "message": "Hello, World!"
  }'

# 使用 Master Admin Key 创建 API 密钥
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-master-admin-key" \
  -d '{
    "userId": "user-123",
    "name": "My App API Key",
    "permissions": ["read", "write"]
  }'

# 使用 Cron Secret 触发清理任务
curl http://localhost:3000/api/cron/cleanup-channels \
  -H "X-Cron-Secret: your-cron-secret"
```

---

## 公钥注册

### POST /api/register

注册新的加密公钥，自动创建加密频道。

**认证**: 无需认证

**请求**:

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

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `publicKey` | string | 是 | - | PEM 格式公钥 (最大 4KB) |
| `algorithm` | string | 否 | RSA-2048 | 算法：RSA-2048, RSA-4096, ECC-SECP256K1 |
| `expiresIn` | number | 否 | 604800 | 有效期秒数 (最大 30 天) |
| `metadata` | object | 否 | {} | 元数据 (最大 2KB) |

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

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `channelId` | string | 加密频道 ID (格式: enc_[hash]) |
| `publicKeyId` | string | 公钥 UUID |
| `algorithm` | string | 使用的加密算法 |
| `expiresAt` | string | ISO 8601 格式过期时间 |
| `expiresIn` | number | 有效期秒数 |

---

### GET /api/register

查询已注册的公钥信息。

**认证**: 无需认证

**请求**:

```bash
# 按频道 ID 查询
curl "http://localhost:3000/api/register?channelId=enc_xxx"

# 按密钥 ID 查询
curl "http://localhost:3000/api/register?keyId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `channelId` | string | 是* | 加密频道 ID (enc_xxx) |
| `keyId` | string | 是* | 公钥 UUID |

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

创建新频道。

**认证**: 可选 (用于关联创建者)

**请求**:

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-channel",
    "name": "我的频道",
    "description": "频道描述",
    "type": "public",
    "creator": "user-123",
    "expiresIn": 86400,
    "metadata": {
      "tags": ["important"]
    }
  }'
```

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | 否 | 自动生成 | 频道 ID (1-64 字符，仅字母数字下划线连字符) |
| `name` | string | 否 | 频道 ID | 频道名称 (最大 255 字符) |
| `description` | string | 否 | - | 频道描述 (最大 1000 字符) |
| `type` | string | 否 | public | 类型：public, encrypted |
| `creator` | string | 否 | - | 创建者标识 |
| `expiresIn` | number | 否 | 86400 | 有效期秒数 (最大 604800) |
| `metadata` | object | 否 | {} | 元数据 (最大 4KB) |

**频道类型说明**:

| 类型 | ID 前缀 | 加密 | 说明 |
|------|---------|------|------|
| `public` | pub_ | ❌ | 公开频道，任何人都可订阅 |
| `encrypted` | enc_ | ✅ | 加密频道，需要公钥注册 |

**响应 (201)**:

```json
{
  "success": true,
  "data": {
    "id": "my-channel",
    "name": "我的频道",
    "description": "频道描述",
    "type": "public",
    "creator": "user-123",
    "createdAt": "2026-01-13T00:00:00.000Z",
    "expiresAt": "2026-01-14T00:00:00.000Z",
    "isActive": true,
    "metadata": {
      "tags": ["important"]
    }
  }
}
```

---

### GET /api/channels

查询频道列表或获取特定频道。

**认证**: 无需认证

**请求**:

```bash
# 查询单个频道
curl "http://localhost:3000/api/channels?id=my-channel"

# 列出所有频道 (分页)
curl "http://localhost:3000/api/channels?limit=10&offset=0"

# 按类型筛选
curl "http://localhost:3000/api/channels?type=public"
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | - | 频道 ID (精确匹配) |
| `type` | string | - | 筛选类型：public, encrypted |
| `limit` | number | 50 | 返回数量 (最大 100) |
| `offset` | number | 0 | 偏移量 |

**响应 (200)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "my-channel",
      "name": "我的频道",
      "type": "public",
      "creator": "user-123",
      "createdAt": "2026-01-13T00:00:00.000Z",
      "expiresAt": "2026-01-14T00:00:00.000Z",
      "isActive": true,
      "metadata": {
        "tags": ["important"]
      }
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

**认证**: 可选 (X-API-Key)

**速率限制**: 10 次/分钟

**请求**:

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

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `channel` | string | 是 | - | 频道 ID |
| `message` | string | 是 | - | 消息内容 (最大 4.5MB) |
| `priority` | string | 否 | normal | 优先级：critical, high, normal, low, bulk |
| `sender` | string | 否 | - | 发送者标识 |
| `cache` | boolean | 否 | true | 是否缓存消息 |
| `encrypted` | boolean | 否 | false | 是否加密消息 |
| `autoCreate` | boolean | 否 | true | 频道不存在时自动创建 |
| `signature` | string | 否 | - | 消息签名 |

**消息优先级**:

| 优先级 | 值 | 说明 | 使用场景 |
|--------|-----|------|----------|
| `critical` | 100 | 最高 | 紧急警报、系统故障 |
| `high` | 75 | 高 | 重要通知 |
| `normal` | 50 | 普通 | 默认级别 |
| `low` | 25 | 低 | 后台更新 |
| `bulk` | 0 | 最低 | 批量消息、新闻稿 |

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

获取频道消息队列状态。

**认证**: 无需认证

**请求**:

```bash
curl "http://localhost:3000/api/publish?channel=my-channel&count=10"
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `channel` | string | - | 频道 ID (必填) |
| `count` | number | 10 | 获取消息数量 (最大 100) |

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

通过 Server-Sent Events (SSE) 订阅频道实时消息。

**认证**: 无需认证

**速率限制**: 5 次/分钟

**请求**:

```bash
curl -N http://localhost:3000/api/subscribe?channel=my-channel
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `channel` | string | 是 | 频道 ID |
| `lastEventId` | string | 否 | 断线后恢复的 Event ID |

**响应格式 (Server-Sent Events)**:

```
# 连接确认 (作为注释发送)
: channel="my-channel" requestID="abc123"

# 连接事件
event: connected
data: {"channel":"my-channel","type":"channel","timestamp":1234567890,"message":"Connected","expiresAt":"2026-01-14T00:00:00.000Z"}

# 消息事件
event: message
id: msg_1234567890
data: {"id":"msg_1234567890","channel":"my-channel","message":"Hello!","sender":"User1","timestamp":1234567890}

# 系统消息
event: message
id: system_1234567890
data: {"id":"system_1234567890","channel":"my-channel","message":"Subscription active, waiting for messages...","timestamp":1234567890,"system":true}

# 错误事件
event: error
data: {"message":"Error description","error":"ERROR_CODE"}

# Keepalive (每 30 秒)
: keepalive
```

**SSE 事件类型**:

| 事件 | 说明 |
|------|------|
| `connected` | 连接成功确认 |
| `message` | 普通消息或系统消息 |
| `error` | 错误事件 |
| `: keepalive` | 心跳保活 (注释) |

**JavaScript 示例**:

```javascript
const eventSource = new EventSource('/api/subscribe?channel=my-channel');

eventSource.addEventListener('connected', (event) => {
  console.log('已连接:', JSON.parse(event.data));
});

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.system) {
    console.log('系统消息:', data.message);
  } else {
    console.log('收到消息:', data.message);
  }
});

eventSource.onerror = (error) => {
  console.log('连接断开，尝试重连...');
  // EventSource 会自动重连
};
```

---

## 密钥管理

### GET /api/keys/[id]

获取公钥信息。

**认证**: 无需认证

**请求**:

```bash
curl http://localhost:3000/api/keys/enc_channel_id
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
    "expiresAt": "2026-01-20T00:00:00.000Z",
    "lastUsedAt": "2026-01-14T12:00:00.000Z",
    "metadata": {
      "deviceName": "My Device"
    }
  }
}
```

---

## 密钥撤销 (两阶段确认流程)

### POST /api/keys/[id]/revoke

请求撤销公钥（需要认证，启动两阶段确认流程）。

**认证**: X-API-Key (必需，且必须包含 `admin` 权限)

**请求**:

```bash
curl -X POST http://localhost:3000/api/keys/enc_channel_id/revoke \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key-id>" \
  -d '{
    "reason": "Key rotation required",
    "confirmationHours": 24
  }'
```

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `reason` | string | 是 | - | 撤销原因 (最小 10 字符) |
| `confirmationHours` | number | 否 | 24 | 确认码有效期 (小时) |

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

> ⚠️ **重要提示**：确认码只在响应中返回一次，请立即保存！确认码过期后需要重新发起撤销请求。

**错误响应**:

| 错误码 | 说明 |
|--------|------|
| NOT_FOUND | 密钥不存在 |
| ALREADY_REVOKED | 密钥已被撤销 |
| INVALID_REASON | 原因太短 (最少 10 字符) |
| REVOCATION_PENDING | 已存在待确认的撤销请求 |

---

### DELETE /api/keys/[id]

**重要变更**: 此端点现在需要两阶段确认。

确认执行密钥撤销。

**认证**: X-API-Key (必需)

**请求**:

```bash
curl -X DELETE "http://localhost:3000/api/keys/enc_channel_id?confirmationCode=xxxxxx" \
  -H "X-API-Key: <api-key-id>"
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `confirmationCode` | string | 是 | 撤销确认码 |

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "deletedId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "enc_channel_id",
    "deletedAt": "2026-01-14T01:00:00.000Z",
    "deletedBy": "user-123"
  }
}
```

---

### POST /api/keys/[id]/revoke/cancel

取消待确认的撤销请求。

**认证**: X-API-Key (必需)

**请求**:

```bash
curl -X POST "http://localhost:3000/api/keys/enc_channel_id/revoke/cancel" \
  -H "X-API-Key: <api-key-id>"
```

**响应 (200)**:

```json
{
  "success": true,
  "message": "Revocation cancelled successfully"
}
```

---

### GET /api/keys/[id]/revoke/status

查询密钥撤销状态。

**认证**: 无需认证

**请求**:

```bash
# 按撤销 ID 查询
curl "http://localhost:3000/api/keys/enc_channel_id/revoke/status" \
  -H "X-API-Key: <api-key-id>"

# 或按密钥 ID 查询待确认的撤销
curl "http://localhost:3000/api/keys/enc_channel_id/revoke/status?keyId=enc_channel_id" \
  -H "X-API-Key: <api-key-id>"
```

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "status": "pending",
    "keyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "enc_channel_id",
    "expiresAt": "2026-01-15T01:00:00.000Z"
  }
}
```

**状态值**:

| 状态 | 说明 |
|------|------|
| `pending` | 等待确认 |
| `confirmed` | 已确认撤销 |
| `cancelled` | 已取消 |
| `expired` | 确认码已过期 |

---

### DELETE /api/keys/[id] (旧版 - 已废弃)

撤销公钥（需要认证）。

> ⚠️ **已废弃**: 请使用两阶段确认流程 (`POST /api/keys/[id]/revoke` → `DELETE /api/keys/[id]?confirmationCode=xxx`)

### POST /api/keys

创建 API 密钥（需要 Master Admin Key）。

**认证**: X-Admin-Key (必需)

**请求**:

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-master-admin-key" \
  -d '{
    "userId": "user-123",
    "name": "My App API Key",
    "permissions": ["read", "write"],
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }'
```

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `userId` | string | 是 | - | 用户 ID |
| `name` | string | 否 | API Key | 密钥名称 (最大 255 字符) |
| `permissions` | array | 否 | ["read", "write"] | 权限数组 |
| `expiresAt` | string | 否 | - | 过期时间 (ISO 8601 格式) |

**响应 (201)**:

```json
{
  "success": true,
  "data": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "userId": "user-123",
    "name": "My App API Key",
    "permissions": ["read", "write"],
    "apiKey": "<api-key-id>xxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2026-01-13T00:00:00.000Z",
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }
}
```

> ⚠️ **重要提示**：API 密钥只在创建时返回一次，请立即保存！

---

### GET /api/keys

列出用户的 API 密钥（需要 admin 权限）。

**认证**: X-Admin-Key 或具有 admin 权限的 X-API-Key

**请求**:

```bash
curl "http://localhost:3000/api/keys?userId=user-123" \
  -H "X-Admin-Key: your-master-admin-key"
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | 是 | 用户 ID |

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "userId": "user-123",
        "name": "My API Key",
        "permissions": ["read", "write"],
        "createdAt": "2026-01-13T00:00:00.000Z",
        "expiresAt": "2026-12-31T23:59:59.000Z",
        "isActive": true,
        "lastUsedAt": "2026-01-14T12:00:00.000Z"
      }
    ]
  }
}
```

---

## 定时任务

### GET /api/cron/cleanup-channels

清理过期频道（需要 cron secret 和 IP 白名单）。

**认证**: X-Cron-Secret (必需) + IP 白名单

**安全要求**:
- 请求 IP 必须在白名单中（默认：localhost）
- 需要正确的 `X-Cron-Secret`

**请求**:

```bash
curl "http://localhost:3000/api/cron/cleanup-channels?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

**查询参数**:

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `task` | all | 任务类型：persistent, temporary, all |

**任务类型说明**:

| 任务 | 说明 |
|------|------|
| `persistent` | 清理过期的持久化频道 (标记为 inactive) |
| `temporary` | 清理过期的临时频道 (完全删除) |
| `all` | 执行所有清理任务 |

**响应 (200)**:

```json
{
  "success": true,
  "data": {
    "task": "all",
    "persistentChannelsMarkedInactive": 10,
    "temporaryChannelsDeleted": 5,
    "errors": [],
    "duration": "150ms",
    "timestamp": "2026-01-13T00:00:00.000Z"
  }
}
```

---

### GET /api/cron/cleanup-keys

清理过期密钥和数据（需要 cron secret 和 IP 白名单）。

**认证**: X-Cron-Secret (必需) + IP 白名单

**请求**:

```bash
curl "http://localhost:3000/api/cron/cleanup-keys?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

**查询参数**:

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `task` | all | 任务类型：expired-keys, audit-logs, orphaned-keys, messages, all |

**任务类型说明**:

| 任务 | 说明 |
|------|------|
| `expired-keys` | 清理过期公钥 |
| `audit-logs` | 清理旧审计日志 (默认保留 90 天) |
| `orphaned-keys` | 清理孤立 Redis 密钥 |
| `messages` | 清理过期消息 |
| `all` | 执行所有清理任务 |

**响应 (200)**:

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
    "timestamp": "2026-01-13T00:00:00.000Z"
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
    "details": [
      {
        "origin": "string",
        "code": "invalid_format",
        "path": ["id"]
      }
    ],
    "timestamp": "2026-01-13T00:00:00.000Z"
  }
}
```

### 错误码参考

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 400 | INVALID_JSON | JSON 解析失败 |
| 400 | INVALID_CHANNEL_FORMAT | 频道 ID 格式无效 (必须匹配 `^[a-zA-Z0-9_-]+$`) |
| 400 | INVALID_TYPE | 频道类型无效 |
| 400 | METADATA_TOO_LARGE | 元数据太大 (最大 4KB) |
| 400 | MISSING_CHANNEL | 缺少频道参数 |
| 400 | MISSING_PARAMETER | 缺少必需参数 |
| 401 | AUTH_REQUIRED | API 密钥必需但未提供 |
| 401 | AUTH_FAILED | API 密钥无效 |
| 401 | FORBIDDEN | 权限不足 |
| 401 | UNAUTHORIZED | Cron secret 无效 |
| 403 | IP_NOT_ALLOWED | IP 不在白名单中 |
| 404 | NOT_FOUND | 资源不存在 |
| 404 | CHANNEL_NOT_FOUND | 频道不存在 |
| 409 | CHANNEL_EXISTS | 频道已存在 |
| 409 | DUPLICATE_KEY | 密钥已存在 |
| 410 | KEY_EXPIRED | 密钥已过期 |
| 413 | KEY_TOO_LARGE | 公钥太大 (最大 4KB) |
| 413 | MESSAGE_TOO_LARGE | 消息太大 (最大 4.5MB) |
| 429 | RATE_LIMIT_EXCEEDED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

### 错误处理示例

```javascript
async function handleApiCall(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  
  if (!result.success) {
    const error = result.error;
    console.error(`错误 [${error.code}]: ${error.message}`);
    
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // 处理限流：等待后重试
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    
    if (error.code === 'VALIDATION_ERROR') {
      // 处理验证错误：显示详细信息
      console.error('验证详情:', error.details);
    }
    
    throw new Error(error.message);
  }
  
  return result.data;
}
```

---

## 速率限制

### 端点限流

| 端点 | 限制 | 时间窗口 | 建议 |
|------|------|----------|------|
| POST /api/publish | 10 次 | 60 秒 | 控制消息发送频率 |
| POST /api/register | 5 次 | 60 秒 | 防止密钥滥用 |
| GET /api/subscribe | 5 次 | 60 秒 | 防止连接耗尽 |
| POST /api/channels | 20 次 | 60 秒 | 防止频道滥用 |

### 超出限制

当超出速率限制时，返回 429 状态码：

```json
{
  "success": false,
  "error": {
    "message": "Rate limit exceeded. Please try again in 45 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "timestamp": "2026-01-13T00:00:00.000Z"
  }
}
```

### 优化建议

```javascript
// 实现客户端速率限制
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  async acquire() {
    const now = Date.now();
    // 清理过期请求记录
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldest = this.requests[0];
      const waitTime = this.windowMs - (now - oldest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

// 使用
const rateLimiter = new RateLimiter(10, 60000); // 10次/分钟

async function publishMessage(channel, message) {
  await rateLimiter.acquire();
  
  return fetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, message })
  });
}
```

---

## 测试指南

本章节提供了使用 `curl` 和 `jq` 测试所有 API 接口的命令。

### 环境配置

```bash
# 基础 URL
BASE_URL="http://localhost:3000"

# Cron Secret (用于定时任务测试)
CRON_SECRET="your-cron-secret"

# Admin Master Key (用于创建 API 密钥)
ADMIN_KEY="your-admin-master-key"
```

### 1. 频道管理 API

#### 创建频道

```bash
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-channel", "description": "测试频道", "type": "public"}' | jq .
```

**预期响应**:

```json
{
  "success": true,
  "data": {
    "id": "pub_xxxxxxxxxxxx",
    "name": "test-channel",
    "description": "测试频道",
    "type": "public",
    "createdAt": "2026-01-13T10:00:00.000Z",
    "expiresAt": "2026-01-14T10:00:00.000Z",
    "isActive": true
  }
}
```

#### 获取频道

```bash
CHANNEL_ID="pub_46bc630d636b"
curl -s -X GET "$BASE_URL/api/channels?id=$CHANNEL_ID" | jq .
```

#### 列出所有频道

```bash
curl -s -X GET "$BASE_URL/api/channels?limit=10" | jq .
```

---

### 2. 公钥注册 API

#### 生成测试公钥

```bash
TEST_PUBLIC_KEY=$(openssl genrsa 2048 2>/dev/null | openssl rsa -pubout 2>/dev/null | tr -d '\n')
echo "$TEST_PUBLIC_KEY"
```

#### 注册公钥

```bash
TEST_PUBLIC_KEY=$(openssl genrsa 2048 2>/dev/null | openssl rsa -pubout 2>/dev/null | tr -d '\n')

curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$TEST_PUBLIC_KEY\",
    \"algorithm\": \"RSA-2048\",
    \"expiresIn\": 86400
  }" | jq .
```

**预期响应**:

```json
{
  "success": true,
  "data": {
    "channelId": "enc_xxxxxxxxxxxx",
    "publicKeyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "algorithm": "RSA-2048",
    "expiresAt": "2026-01-14T10:00:00.000Z",
    "expiresIn": 86400
  }
}
```

#### 查询公钥

```bash
CHANNEL_ID="enc_948662cd3e294ffc"
curl -s -X GET "$BASE_URL/api/register?channelId=$CHANNEL_ID" | jq .
```

---

### 3. 消息发布 API

#### 发布消息

```bash
CHANNEL_ID="pub_46bc630d636b"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"message\": \"Hello, World!\",
    \"priority\": \"normal\"
  }" | jq .
```

**预期响应**:

```json
{
  "success": true,
  "data": {
    "messageId": "msg_1767521101483_xxxxxxxxxx",
    "channel": "$CHANNEL_ID",
    "publishedAt": 1767521101483
  }
}
```

#### 发布优先级消息

```bash
# 发送紧急消息
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "alerts",
    "message": "系统告警！",
    "priority": "critical"
  }' | jq .
```

#### 获取频道消息

```bash
CHANNEL_ID="pub_46bc630d636b"
curl -s -X GET "$BASE_URL/api/publish?channel=$CHANNEL_ID&count=10" | jq .
```

---

### 4. API 密钥管理

#### 创建 API 密钥

```bash
curl -s -X POST "$BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "userId": "test-user",
    "name": "Test API Key",
    "permissions": ["read", "write", "admin"]
  }' | jq .
```

**预期响应**:

```json
{
  "success": true,
  "data": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "userId": "test-user",
    "name": "Test API Key",
    "permissions": ["read", "write", "admin"],
    "apiKey": "<api-key-id>xxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2026-01-13T10:00:00.000Z",
    "expiresAt": null
  }
}
```

> ⚠️ **重要**：API 密钥只返回一次，请立即保存！

#### 列出用户密钥

```bash
curl -s -X GET "$BASE_URL/api/keys?userId=test-user" \
  -H "X-Admin-Key: $ADMIN_KEY" | jq .
```

#### 撤销公钥

```bash
CHANNEL_KEY_ID="enc_948662cd3e294ffc"
API_KEY="<api-key-id>xxxxxxxxxxxxxxxxxxxxxxxx"

curl -s -X DELETE "$BASE_URL/api/keys/$CHANNEL_KEY_ID" \
  -H "X-API-Key: $API_KEY" | jq .
```

---

### 5. 定时任务 API

#### 清理过期频道

```bash
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .
```

**预期响应**:

```json
{
  "success": true,
  "data": {
    "task": "all",
    "persistentChannelsMarkedInactive": 0,
    "temporaryChannelsDeleted": 0,
    "errors": [],
    "duration": "5ms",
    "timestamp": "2026-01-13T10:00:00.000Z"
  }
}
```

#### 清理过期密钥

```bash
curl -s -X GET "$BASE_URL/api/cron/cleanup-keys" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .
```

---

### 6. 异常情况测试

#### 测试 404 - 频道不存在

```bash
curl -s -X GET "$BASE_URL/api/channels?id=non-existent-channel" | jq .
```

**预期响应**:

```json
{
  "success": false,
  "error": {
    "message": "Channel 'non-existent-channel' not found",
    "code": "NOT_FOUND",
    "timestamp": "2026-01-13T10:00:00.000Z"
  }
}
```

#### 测试 409 - 重复创建频道

```bash
EXISTING_CHANNEL_ID="pub_46bc630d636b"
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$EXISTING_CHANNEL_ID\", \"name\": \"duplicate-channel\"}" | jq .
```

**预期响应**:

```json
{
  "success": false,
  "error": {
    "message": "Channel '$EXISTING_CHANNEL_ID' already exists",
    "code": "CHANNEL_EXISTS"
  }
}
```

#### 测试 401 - 未授权访问

```bash
curl -s -X DELETE "$BASE_URL/api/keys/enc_948662cd3e294ffc" | jq .
```

**预期响应**:

```json
{
  "success": false,
  "error": {
    "message": "API key required in X-API-Key header",
    "code": "AUTH_REQUIRED"
  }
}
```

#### 测试 401 - 错误的 Cron Secret

```bash
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: wrong-secret" | jq .
```

**预期响应**:

```json
{
  "success": false,
  "error": {
    "message": "Invalid or missing cron secret",
    "code": "UNAUTHORIZED"
  }
}
```

#### 测试 400 - 无效的频道 ID 格式

```bash
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d '{"id": "invalid channel id!", "name": "bad-channel"}' | jq .
```

**预期响应**:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "origin": "string",
        "code": "invalid_format",
        "path": ["id"]
      }
    ]
  }
}
```

---

### 7. 完整测试流程

#### 一键测试脚本

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
CRON_SECRET="your-cron-secret"
ADMIN_KEY="your-admin-master-key"

echo "========================================="
echo "SecureNotify API 测试"
echo "========================================="

# 测试1: 创建频道
echo ""
echo "【测试1】创建频道"
CHANNEL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-channel", "description": "测试频道", "type": "public"}')
echo "$CHANNEL_RESPONSE" | jq .
CHANNEL_ID=$(echo "$CHANNEL_RESPONSE" | jq -r '.data.id')
echo "频道ID: $CHANNEL_ID"

# 测试2: 获取频道
echo ""
echo "【测试2】获取频道"
curl -s -X GET "$BASE_URL/api/channels?id=$CHANNEL_ID" | jq .

# 测试3: 注册公钥
echo ""
echo "【测试3】注册公钥"
TEST_PUBLIC_KEY=$(openssl genrsa 2048 2>/dev/null | openssl rsa -pubout 2>/dev/null | tr -d '\n')
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$TEST_PUBLIC_KEY\",
    \"algorithm\": \"RSA-2048\",
    \"expiresIn\": 86400
  }")
echo "$REGISTER_RESPONSE" | jq .
ENCRYPTED_CHANNEL_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.channelId')
echo "加密频道ID: $ENCRYPTED_CHANNEL_ID"

# 测试4: 发布消息
echo ""
echo "【测试4】发布消息"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"message\": \"Hello, World!\",
    \"priority\": \"normal\"
  }" | jq .

# 测试5: 获取消息
echo ""
echo "【测试5】获取消息"
curl -s -X GET "$BASE_URL/api/publish?channel=$CHANNEL_ID&count=10" | jq .

# 测试6: 创建API密钥
echo ""
echo "【测试6】创建API密钥"
API_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "userId": "test-user",
    "name": "Test API Key",
    "permissions": ["read", "write", "admin"]
  }')
echo "$API_KEY_RESPONSE" | jq .
API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.data.apiKey')
echo "API密钥: $API_KEY"

# 测试7: 撤销公钥
echo ""
echo "【测试7】撤销公钥'
curl -s -X DELETE "$BASE_URL/api/keys/$ENCRYPTED_CHANNEL_ID" \
  -H "X-API-Key: $API_KEY" | jq .

# 测试8: 清理频道
echo ""
echo "【测试8】清理过期频道"
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .

echo ""
echo "========================================="
echo "测试完成!"
echo "========================================="
```

---

### 8. 实用技巧

#### 提取字段

```bash
# 提取频道ID
curl -s -X GET "$BASE_URL/api/channels?id=pub_46bc630d636b" | jq -r '.data.id'

# 提取所有频道ID
curl -s -X GET "$BASE_URL/api/channels" | jq -r '.data[].id'

# 提取API密钥
API_KEY=$(curl -s -X POST "$BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"userId": "test-user", "name": "Test Key", "permissions": ["read"]}' | jq -r '.data.apiKey')
```

#### 检查响应状态

```bash
# 检查是否成功
curl -s -X GET "$BASE_URL/api/channels?id=pub_46bc630d636b" | jq '.success'

# 获取错误代码
curl -s -X GET "$BASE_URL/api/channels?id=non-existent" | jq '.error.code'
```

#### 批量测试

```bash
# 批量创建频道
for i in {1..5}; do
  curl -s -X POST "$BASE_URL/api/channels" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"test-channel-$i\", \"type\": \"public\"}" | jq -r '.data.id'
done
```

---

### 9. HTTP 状态码参考

| 状态码 | 说明 |
|--------|------|
| **200** | 成功 |
| **201** | 创建成功 |
| **400** | 请求参数错误 |
| **401** | 未授权 |
| **403** | 无权限访问 |
| **404** | 资源不存在 |
| **409** | 资源冲突 |
| **410** | 资源已过期 |
| **413** | 请求体过大 |
| **429** | 请求频率超限 |
| **500** | 服务器内部错误 |

---

### 10. 注意事项

1. **替换占位符**：将 `CHANNEL_ID`、`API_KEY` 等占位符替换为实际值
2. **保存 API 密钥**：API 密钥只在创建时返回一次，请妥善保存
3. **频道 ID 格式**：频道 ID 只能包含字母、数字、下划线和连字符，长度 1-64
4. **消息大小限制**：单条消息最大 4.5MB (4,718,592 字节)
5. **公钥大小限制**：公钥最大 4KB (4,096 字节)
6. **频道元数据限制**：最大 4KB
7. **速率限制**：
   - 发布消息：10 次/分钟
   - 注册公钥：5 次/分钟
   - 订阅频道：5 次/分钟
8. **Cron 端点安全**：需要 IP 白名单和正确的 `X-Cron-Secret`
9. **API 密钥认证**：使用 `X-API-Key` 或 `X-Admin-Key` 头

---

<div align="center">

**[📖 用户指南](USER_GUIDE.md)** • **[🏗️ 架构设计](ARCHITECTURE.md)** • **[🏠 首页](../README.md)**

</div>
