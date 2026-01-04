# SecureNotify API 测试指南

本文档提供了使用 `curl` 和 `jq` 测试 SecureNotify API 接口的命令。

## 环境配置

- **Base URL**: `http://localhost:3000`
- **Cron Secret**: `securenotify-cron-secret-key`

## 测试命令

### 1. 频道管理 API

#### 创建频道

```bash
curl -s -X POST http://localhost:3000/api/channels \
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
    "createdAt": "2026-01-04T10:00:00.000Z",
    "expiresAt": "2026-01-05T10:00:00.000Z",
    "isActive": true
  }
}
```

#### 获取特定频道

```bash
# 替换 CHANNEL_ID 为实际的频道ID
curl -s -X GET "http://localhost:3000/api/channels?id=pub_46bc630d636b" | jq .
```

#### 列出所有频道

```bash
curl -s -X GET http://localhost:3000/api/channels | jq .
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

curl -s -X POST http://localhost:3000/api/register \
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
    "expiresAt": "2026-01-05T10:00:00.000Z",
    "expiresIn": 86400
  }
}
```

#### 查询公钥

```bash
# 替换 CHANNEL_ID 为实际的频道ID
curl -s -X GET "http://localhost:3000/api/register?channelId=enc_948662cd3e294ffc" | jq .
```

#### 获取公钥详情

```bash
# 替换 CHANNEL_ID 为实际的频道ID
curl -s -X GET "http://localhost:3000/api/keys/enc_948662cd3e294ffc" | jq .
```

---

### 3. 消息发布 API

#### 发布消息

```bash
# 替换 CHANNEL_ID 为实际的频道ID
curl -s -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"pub_46bc630d636b\",
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
    "timestamp": 1767521101483,
    "channel": "pub_46bc630d636b",
    "autoCreated": false
  }
}
```

#### 获取频道消息

```bash
# 替换 CHANNEL_ID 为实际的频道ID
curl -s -X GET "http://localhost:3000/api/publish?channel=pub_46bc630d636b&count=10" | jq .
```

---

### 4. API密钥管理

#### 创建API密钥

```bash
curl -s -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
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
    "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2026-01-04T10:00:00.000Z",
    "expiresAt": null
  }
}
```

**保存API密钥**:
```bash
# 保存API密钥到变量
API_KEY=$(curl -s -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "name": "Test API Key",
    "permissions": ["read", "write", "admin"]
  }' | jq -r '.data.apiKey')

echo "API Key: $API_KEY"
```

#### 撤销公钥（需要认证）

```bash
# 替换 CHANNEL_ID 和 API_KEY
curl -s -X DELETE "http://localhost:3000/api/keys/enc_948662cd3e294ffc" \
  -H "X-API-Key: YOUR_API_KEY" | jq .
```

---

### 5. 清理任务 API

#### 清理过期频道

```bash
curl -s -X GET http://localhost:3000/api/cron/cleanup-channels \
  -H "X-Cron-Secret: securenotify-cron-secret-key" | jq .
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
    "timestamp": "2026-01-04T10:00:00.000Z"
  }
}
```

#### 清理过期密钥

```bash
curl -s -X GET http://localhost:3000/api/cron/cleanup-keys \
  -H "X-Cron-Secret: securenotify-cron-secret-key" | jq .
```

---

### 6. 异常情况测试

#### 测试 404 - 获取不存在的频道

```bash
curl -s -X GET "http://localhost:3000/api/channels?id=non-existent-channel" | jq .
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "message": "Channel 'non-existent-channel' not found",
    "code": "NOT_FOUND",
    "timestamp": "2026-01-04T10:00:00.000Z"
  }
}
```

#### 测试 409 - 重复创建频道

```bash
curl -s -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{"id": "pub_46bc630d636b", "name": "duplicate-channel"}' | jq .
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "message": "Channel 'pub_46bc630d636b' already exists",
    "code": "CHANNEL_EXISTS"
  }
}
```

#### 测试 401 - 未授权访问

```bash
curl -s -X DELETE "http://localhost:3000/api/keys/enc_948662cd3e294ffc" | jq .
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "message": "API key required in X-API-Key header",
    "code": "AUTH_REQUIRED",
    "timestamp": "2026-01-04T10:00:00.000Z"
  }
}
```

#### 测试 401 - 错误的cron secret

```bash
curl -s -X GET http://localhost:3000/api/cron/cleanup-channels \
  -H "X-Cron-Secret: wrong-secret" | jq .
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "message": "Invalid or missing cron secret",
    "code": "UNAUTHORIZED",
    "timestamp": "2026-01-04T10:00:00.000Z"
  }
}
```

#### 测试 400 - 无效的频道ID格式

```bash
curl -s -X POST http://localhost:3000/api/channels \
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
        "format": "regex",
        "pattern": "/^[a-zA-Z0-9_-]+$/",
        "path": ["id"],
        "message": "Invalid channel ID format"
      }
    ]
  }
}
```

---

## 完整测试流程

### 一键测试脚本

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
CRON_SECRET="securenotify-cron-secret-key"

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
CHANNEL_KEY_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.channelId')
echo "加密频道ID: $CHANNEL_KEY_ID"

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
echo "【测试7】撤销公钥"
curl -s -X DELETE "$BASE_URL/api/keys/$CHANNEL_KEY_ID" \
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

## 提示

### 提取字段

```bash
# 提取频道ID
curl -s -X GET "http://localhost:3000/api/channels?id=pub_46bc630d636b" | jq -r '.data.id'

# 提取所有频道ID
curl -s -X GET http://localhost:3000/api/channels | jq -r '.data[].id'

# 提取API密钥
curl -s -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "name": "Test Key", "permissions": ["read"]}' | jq -r '.data.apiKey'
```

### 检查响应状态

```bash
# 检查是否成功
curl -s -X GET "http://localhost:3000/api/channels?id=pub_46bc630d636b" | jq '.success'

# 获取错误代码
curl -s -X GET "http://localhost:3000/api/channels?id=non-existent" | jq '.error.code'
```

### 批量测试

```bash
# 批量创建频道
for i in {1..5}; do
  curl -s -X POST http://localhost:3000/api/channels \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"test-channel-$i\", \"type\": \"public\"}" | jq -r '.data.id'
done
```

---

## 状态码说明

- **200** - 成功
- **201** - 创建成功
- **400** - 请求参数错误
- **401** - 未授权
- **404** - 资源不存在
- **409** - 资源冲突
- **410** - 资源已过期
- **413** - 请求体过大
- **429** - 请求频率超限
- **500** - 服务器内部错误

---

## 注意事项

1. **替换占位符**: 将 `CHANNEL_ID`、`API_KEY` 等占位符替换为实际值
2. **保存API密钥**: API密钥只在创建时返回一次，请妥善保存
3. **频道ID格式**: 频道ID只能包含字母、数字、下划线和连字符
4. **消息大小限制**: 单条消息最大 4.5MB
5. **公钥大小限制**: 公钥最大 4KB
6. **速率限制**: 发布消息、注册公钥等操作有速率限制

---

## 相关文档

- [API Reference](./docs/API_REFERENCE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [User Guide](./docs/USER_GUIDE.md)