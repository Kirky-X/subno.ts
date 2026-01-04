#!/bin/bash

# SecureNotify API 测试脚本

BASE_URL="http://localhost:3000"
CRON_SECRET="securenotify-cron-secret-key"

echo "========================================="
echo "SecureNotify API 测试"
echo "========================================="

# 测试 1: GET /api/register - 缺少参数
echo ""
echo "【测试1】GET /api/register - 缺少必需参数"
curl -s -X GET "$BASE_URL/api/register" | jq .

# 测试 2: POST /api/channels - 创建频道
echo ""
echo "【测试2】POST /api/channels - 创建频道"
CHANNEL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-channel", "description": "测试频道", "type": "public"}')
echo "$CHANNEL_RESPONSE" | jq .
CHANNEL_ID=$(echo "$CHANNEL_RESPONSE" | jq -r '.data.id')
echo "创建频道ID: $CHANNEL_ID"

# 测试 3: GET /api/channels - 获取特定频道
echo ""
echo "【测试3】GET /api/channels - 获取特定频道"
curl -s -X GET "$BASE_URL/api/channels?id=$CHANNEL_ID" | jq .

# 测试 4: GET /api/channels - 列出所有频道
echo ""
echo "【测试4】GET /api/channels - 列出所有频道"
curl -s -X GET "$BASE_URL/api/channels" | jq .

# 测试 5: POST /api/register - 注册公钥
echo ""
echo "【测试5】POST /api/register - 注册公钥"
# 生成测试公钥
TEST_PUBLIC_KEY=$(openssl genrsa 2048 2>/dev/null | openssl rsa -pubout 2>/dev/null | head -20)
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$TEST_PUBLIC_KEY\",
    \"algorithm\": \"RSA-2048\",
    \"expiresIn\": 86400
  }")
echo "$REGISTER_RESPONSE" | jq .
KEY_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.publicKeyId')
CHANNEL_KEY_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.channelId')
echo "公钥ID: $KEY_ID, 频道ID: $CHANNEL_KEY_ID"

# 测试 6: GET /api/register - 按channelId查询
echo ""
echo "【测试6】GET /api/register - 按channelId查询"
curl -s -X GET "$BASE_URL/api/register?channelId=$CHANNEL_KEY_ID" | jq .

# 测试 7: GET /api/keys/[id] - 获取公钥
echo ""
echo "【测试7】GET /api/keys/$CHANNEL_KEY_ID - 获取公钥"
curl -s -X GET "$BASE_URL/api/keys/$CHANNEL_KEY_ID" | jq .

# 测试 8: POST /api/publish - 发布消息
echo ""
echo "【测试8】POST /api/publish - 发布消息到频道"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"message\": {\"text\": \"Hello, World!\", \"type\": \"test\"},
    \"priority\": \"normal\"
  }" | jq .

# 测试 9: POST /api/publish - 再次发布消息
echo ""
echo "【测试9】POST /api/publish - 发布第二条消息"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"message\": {\"text\": \"Second message\", \"timestamp\": $(date +%s)},
    \"priority\": \"high\"
  }" | jq .

# 测试 10: GET /api/publish - 获取频道消息
echo ""
echo "【测试10】GET /api/publish - 获取频道消息"
curl -s -X GET "$BASE_URL/api/publish?channel=$CHANNEL_ID&count=10" | jq .

# 测试 11: POST /api/keys - 创建API密钥
echo ""
echo "【测试11】POST /api/keys - 创建API密钥"
API_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "name": "Test API Key",
    "permissions": ["read", "write", "admin"]
  }')
echo "$API_KEY_RESPONSE" | jq .
API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.data.key')

# 测试 12: DELETE /api/keys/[id] - 撤销公钥 (需要认证)
echo ""
echo "【测试12】DELETE /api/keys/$CHANNEL_KEY_ID - 撤销公钥 (带API Key认证)"
curl -s -X DELETE "$BASE_URL/api/keys/$CHANNEL_KEY_ID" \
  -H "X-API-Key: $API_KEY" | jq .

# 测试 13: GET /api/cron/cleanup-channels - 清理频道
echo ""
echo "【测试13】GET /api/cron/cleanup-channels - 清理过期频道"
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .

# 测试 14: GET /api/cron/cleanup-keys - 清理过期密钥
echo ""
echo "【测试14】GET /api/cron/cleanup-keys - 清理过期密钥和数据"
curl -s -X GET "$BASE_URL/api/cron/cleanup-keys" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .

# 测试 15: GET /api/subscribe - 订阅频道 (SSE)
echo ""
echo "【测试15】GET /api/subscribe - 订阅频道 (测试连接)"
SUBSCRIBE_PID=$(curl -s -m 3 -N "$BASE_URL/api/subscribe?channel=$CHANNEL_ID" 2>&1 | head -3 &
PID=$!
sleep 2
kill $PID 2>/dev/null
echo "SSE连接测试完成 (预期超时)"

# 测试异常情况
echo ""
echo "========================================="
echo "异常场景测试"
echo "========================================="

# 测试 16: POST /api/channels - 重复创建频道
echo ""
echo "【测试16】POST /api/channels - 重复创建频道 (预期409冲突)"
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$CHANNEL_ID\", \"name\": \"duplicate-channel\"}" | jq .

# 测试 17: GET /api/channels - 获取不存在的频道
echo ""
echo "【测试17】GET /api/channels - 获取不存在的频道 (预期404)"
curl -s -X GET "$BASE_URL/api/channels?id=non-existent-channel" | jq .

# 测试 18: GET /api/keys - 获取不存在的公钥
echo ""
echo "【测试18】GET /api/keys/non-existent - 获取不存在的公钥 (预期404)"
curl -s -X GET "$BASE_URL/api/keys/non-existent" | jq .

# 测试 19: POST /api/publish - 发布到不存在的频道
echo ""
echo "【测试19】POST /api/publish - 发布到不存在的频道 (需要autoCreate)"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"temp-auto-created\",
    \"message\": \"Auto-created channel message\",
    \"autoCreate\": true
  }" | jq .

# 测试 20: 验证消息已发布到自动创建的频道
echo ""
echo "【测试20】验证自动创建的频道消息"
curl -s -X GET "$BASE_URL/api/publish?channel=temp-auto-created&count=5" | jq .

# 测试 21: POST /api/channels - 无效的频道ID格式
echo ""
echo "【测试21】POST /api/channels - 无效的频道ID格式 (预期400)"
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d '{"id": "invalid channel id!", "name": "bad-channel"}' | jq .

# 测试 22: POST /api/register - 无效的JSON
echo ""
echo "【测试22】POST /api/register - 无效的JSON (预期400)"
curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d 'not valid json' | jq .

# 测试 23: DELETE /api/keys/[id] - 未授权访问
echo ""
echo "【测试23】DELETE /api/keys/$CHANNEL_KEY_ID - 未授权访问 (预期401)"
curl -s -X DELETE "$BASE_URL/api/keys/$CHANNEL_KEY_ID" | jq .

# 测试 24: Cron endpoint - 错误的cron secret
echo ""
echo "【测试24】GET /api/cron/cleanup-channels - 错误的cron secret (预期401)"
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: wrong-secret" | jq .

echo ""
echo "========================================="
echo "所有测试完成!"
echo "========================================="
