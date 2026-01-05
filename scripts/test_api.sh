#!/bin/bash

# SecureNotify API 测试脚本（改进版）
# 减少外部依赖，使用Node.js处理JSON和加密

# 移除 set -e 以便在出错时继续运行所有测试

BASE_URL="https://subno-ts.vercel.app"
TEST_CHANNEL_ID="test-channel-$(date +%s)"
CRON_SECRET="securenotify-cron-secret-key"
ADMIN_MASTER_KEY="subno-admin-master-key-2024"

# 检查Node.js是否可用
if ! command -v node &> /dev/null; then
    echo "错误: 需要Node.js来运行此脚本"
    exit 1
fi

# JSON处理函数
extract_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | node -e "
        const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
        const keys = '$field'.split('.');
        let result = data;
        for (const key of keys) {
            result = result[key];
            if (result === undefined) process.exit(1);
        }
        console.log(result);
    "
}

# 格式化JSON输出
format_json() {
    node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0, 'utf-8')), null, 2))"
}

echo "========================================="
echo "SecureNotify API 测试（改进版）"
echo "========================================="

# 测试1: GET /api/register - 缺少参数
echo ""
echo "【测试1】GET /api/register - 缺少必需参数"
curl -s -X GET "$BASE_URL/api/register" | format_json

# 测试2: POST /api/channels - 创建频道
echo ""
echo "【测试2】POST /api/channels - 创建频道"
CHANNEL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$TEST_CHANNEL_ID\", \"name\": \"Test Channel\", \"description\": \"测试频道\", \"type\": \"public\"}")
echo "$CHANNEL_RESPONSE" | format_json
CHANNEL_ID=$(extract_json_field "$CHANNEL_RESPONSE" "data.id")
echo "创建频道ID: $CHANNEL_ID"

# 测试3: GET /api/channels - 获取特定频道
echo ""
echo "【测试3】GET /api/channels - 获取特定频道"
curl -s -X GET "$BASE_URL/api/channels?id=$CHANNEL_ID" | format_json

# 测试4: GET /api/channels - 列出所有频道
echo ""
echo "【测试4】GET /api/channels - 列出所有频道"
curl -s -X GET "$BASE_URL/api/channels" | format_json

# 测试5: POST /api/register - 注册公钥
echo ""
echo "【测试5】POST /api/register - 注册公钥"
# 使用Node.js生成测试公钥
TEST_PUBLIC_KEY=$(node -e "
    const crypto = require('crypto');
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        }
    });
    console.log(publicKey.replace(/\\n/g, ''));
")

REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$TEST_PUBLIC_KEY\",
    \"algorithm\": \"RSA-2048\",
    \"expiresIn\": 86400
  }")
echo "$REGISTER_RESPONSE" | format_json
KEY_ID=$(extract_json_field "$REGISTER_RESPONSE" "data.publicKeyId")
CHANNEL_KEY_ID=$(extract_json_field "$REGISTER_RESPONSE" "data.channelId")
echo "公钥ID: $KEY_ID, 频道ID: $CHANNEL_KEY_ID"

# 测试6: GET /api/register - 按channelId查询
echo ""
echo "【测试6】GET /api/register - 按channelId查询"
curl -s -X GET "$BASE_URL/api/register?channelId=$CHANNEL_KEY_ID" | format_json

# 测试7: GET /api/keys/[id] - 获取公钥
echo ""
echo "【测试7】GET /api/keys/$CHANNEL_KEY_ID - 获取公钥"
curl -s -X GET "$BASE_URL/api/keys/$CHANNEL_KEY_ID" | format_json

# 测试8: POST /api/publish - 发布消息到频道
echo ""
echo "【测试8】POST /api/publish - 发布消息到频道"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"message\": \"Hello, World!\",
    \"priority\": \"normal\"
  }" | format_json

# 测试9: POST /api/publish - 再次发布消息
echo ""
echo "【测试9】POST /api/publish - 发布第二条消息"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"message\": \"Second message\",
    \"priority\": \"high\"
  }" | format_json

# 测试10: GET /api/publish - 获取频道消息
echo ""
echo "【测试10】GET /api/publish - 获取频道消息"
curl -s -X GET "$BASE_URL/api/publish?channel=$CHANNEL_ID&count=10" | format_json

# 测试11: POST /api/keys - 创建API密钥
echo ""
echo "【测试11】POST /api/keys - 创建API密钥"
API_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_MASTER_KEY" \
  -d '{
    "userId": "test-user",
    "name": "Test API Key",
    "permissions": ["read", "write", "admin"]
  }')
echo "$API_KEY_RESPONSE" | format_json
API_KEY=$(extract_json_field "$API_KEY_RESPONSE" "data.apiKey")

# 测试12: DELETE /api/keys/[id] - 撤销公钥 (需要认证)
echo ""
echo "【测试12】DELETE /api/keys/$CHANNEL_KEY_ID - 撤销公钥 (带API Key认证)"
curl -s -X DELETE "$BASE_URL/api/keys/$CHANNEL_KEY_ID" \
  -H "X-API-Key: $API_KEY" | format_json

# 测试13: GET /api/cron/cleanup-channels - 清理频道
echo ""
echo "【测试13】GET /api/cron/cleanup-channels - 清理过期频道"
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: $CRON_SECRET" | format_json

# 测试14: GET /api/cron/cleanup-keys - 清理过期密钥和数据
echo ""
echo "【测试14】GET /api/cron/cleanup-keys - 清理过期密钥和数据"
curl -s -X GET "$BASE_URL/api/cron/cleanup-keys" \
  -H "X-Cron-Secret: $CRON_SECRET" | format_json

# 测试异常情况
echo ""
echo "========================================="
echo "异常场景测试"
echo "========================================="

# 测试15: POST /api/channels - 重复创建频道
echo ""
echo "【测试15】POST /api/channels - 重复创建频道 (预期409冲突)"
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$TEST_CHANNEL_ID\", \"name\": \"duplicate-channel\"}" | format_json

# 测试16: GET /api/channels - 获取不存在的频道
echo ""
echo "【测试16】GET /api/channels - 获取不存在的频道 (预期404)"
curl -s -X GET "$BASE_URL/api/channels?id=non-existent-channel" | format_json

# 测试17: GET /api/keys - 获取不存在的公钥
echo ""
echo "【测试17】GET /api/keys/non-existent - 获取不存在的公钥 (预期404)"
curl -s -X GET "$BASE_URL/api/keys/non-existent" | format_json

# 测试18: POST /api/publish - 发布到不存在的频道
echo ""
echo "【测试18】POST /api/publish - 发布到不存在的频道 (需要autoCreate)"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"temp-auto-created\",
    \"message\": \"Auto-created channel message\",
    \"autoCreate\": true
  }" | format_json

# 测试19: 验证消息已发布到自动创建的频道
echo ""
echo "【测试19】验证自动创建的频道消息"
curl -s -X GET "$BASE_URL/api/publish?channel=temp-auto-created&count=5" | format_json

# 测试20: POST /api/channels - 无效的频道ID格式
echo ""
echo "【测试20】POST /api/channels - 无效的频道ID格式 (预期400)"
curl -s -X POST "$BASE_URL/api/channels" \
  -H "Content-Type: application/json" \
  -d '{"id": "invalid channel id!", "name": "bad-channel"}' | format_json

# 测试21: POST /api/register - 无效的JSON
echo ""
echo "【测试21】POST /api/register - 无效的JSON (预期400)"
curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d 'not valid json' | format_json

# 测试22: DELETE /api/keys/[id] - 未授权访问
echo ""
echo "【测试22】DELETE /api/keys/$CHANNEL_KEY_ID - 未授权访问 (预期401)"
curl -s -X DELETE "$BASE_URL/api/keys/$CHANNEL_KEY_ID" | format_json

# 测试23: Cron endpoint - 错误的cron secret
echo ""
echo "【测试23】GET /api/cron/cleanup-channels - 错误的cron secret (预期401)"
curl -s -X GET "$BASE_URL/api/cron/cleanup-channels" \
  -H "X-Cron-Secret: wrong-secret" | format_json

echo ""
echo "========================================="
echo "所有测试完成!"
echo "========================================="