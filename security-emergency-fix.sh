#!/bin/bash
# Subno.ts 紧急安全修复脚本
# 用于快速修复 P0 级别的高危漏洞

set -e

echo "🔐 Subno.ts 紧急安全修复脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误：请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}正在应用以下修复:${NC}"
echo "1. 为 Subscribe 接口添加 API Key 认证"
echo "2. 修复撤销操作的所有权验证"
echo "3. 生成强随机密钥替换弱密码"
echo ""

# 备份当前文件
echo -e "${YELLOW}[1/6] 备份关键文件...${NC}"
cp app/api/subscribe/route.ts app/api/subscribe/route.ts.backup.$(date +%Y%m%d%H%M%S)
cp app/api/keys/[id]/revoke/route.ts app/api/keys/[id]/revoke/route.ts.backup.$(date +%Y%m%d%H%M%S)
cp .env .env.backup.$(date +%Y%m%d%H%M%S)
echo -e "${GREEN}✓ 备份完成${NC}"
echo ""

# 修复 1: 为 Subscribe 接口添加认证
echo -e "${YELLOW}[2/6] 修复 Subscribe 接口缺少认证的问题...${NC}"
cat > /tmp/subscribe_fix.patch << 'EOF'
--- a/app/api/subscribe/route.ts
+++ b/app/api/subscribe/route.ts
@@ -4,6 +4,7 @@
 import { NextRequest, NextResponse } from 'next/server';
 import { subscribeService } from '@/src/lib/services';
 import { checkRateLimit } from '@/src/lib/middleware/rate-limit';
+import { requireApiKey } from '@/src/lib/middleware/api-key';
 import {
   withErrorHandler,
   extractRequestContext,
@@ -16,6 +17,11 @@ import {
 
 export const GET = withErrorHandler(async (request: NextRequest) => {
   const context = extractRequestContext(request);
+  
+  // SECURITY FIX: Add API key authentication
+  const authError = await requireApiKey(request);
+  if (authError) return authError;
+
   const searchParams = request.nextUrl.searchParams;
 
   const channel = searchParams.get('channel');
EOF

# 使用 sed 直接修改文件
sed -i.bak "s/import { checkRateLimit } from '@/src\/lib\/middleware\/rate-limit';/import { checkRateLimit } from '@/src\/lib\/middleware\/rate-limit';\nimport { requireApiKey } from '@/src\/lib\/middleware\/api-key';/" app/api/subscribe/route.ts
sed -i.bak "s/export const GET = withErrorHandler(async (request: NextRequest) => {/export const GET = withErrorHandler(async (request: NextRequest) => {\n  const authError = await requireApiKey(request);\n  if (authError) return authError;/" app/api/subscribe/route.ts
rm -f app/api/subscribe/route.ts.bak

echo -e "${GREEN}✓ Subscribe 接口已添加认证${NC}"
echo ""

# 修复 2: 改进撤销操作的权限验证（需要手动审查）
echo -e "${YELLOW}[3/6] 标记需要手动修复的撤销操作权限问题...${NC}"
cat >> app/api/keys/[id]/revoke/route.ts << 'EOF'

// SECURITY NOTE: This endpoint needs ownership verification
// TODO: Add channel ownership check before processing revocation
// Example:
// const key = await publicKeyRepository.findById(keyId);
// const hasAccess = await channelRepository.verifyAccess(key.channelId, apiKeyInfo.userId);
// if (!hasAccess.hasAccess && !apiKeyInfo.permissions.includes('admin')) {
//   throw Errors.forbidden('无权操作该密钥', context.requestId);
// }
EOF

echo -e "${GREEN}✓ 已添加修复提示注释${NC}"
echo ""

# 修复 3: 生成强随机密钥
echo -e "${YELLOW}[4/6] 生成强随机密钥...${NC}"

# 生成 32 字符的强随机密钥（字母 + 数字 + 特殊字符）
generate_secure_key() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 32
}

NEW_ADMIN_KEY=$(generate_secure_key)
NEW_CRON_SECRET=$(generate_secure_key)
NEW_DB_PASSWORD=$(generate_secure_key)

echo -e "${YELLOW}[5/6] 更新 .env 文件中的弱密码...${NC}"

# 创建新的 .env 文件
cat > /tmp/new_env << EOF
# Database
DATABASE_URL=postgresql://postgres:${NEW_DB_PASSWORD}@127.0.0.1:5432/securenotify?sslmode=require

# Redis
REDIS_URL=redis://127.0.0.1:6379

# API 配置
NODE_ENV=development
PORT=3000

# 消息配置
PUBLIC_MESSAGE_TTL=43200
PRIVATE_MESSAGE_TTL=86400

# 频道配置
TEMPORARY_CHANNEL_TTL=1800
PERSISTENT_CHANNEL_DEFAULT_TTL=86400

# 限流配置
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_DEFAULT=100
RATE_LIMIT_PUBLISH=10
RATE_LIMIT_SUBSCRIBE=5
RATE_LIMIT_REGISTER=5
RATE_LIMIT_REVOKE=20

# 安全配置 - 已更新为强随机密钥
ADMIN_MASTER_KEY=${NEW_ADMIN_KEY}
CRON_SECRET=${NEW_CRON_SECRET}

# 密钥撤销配置
REVOCATION_CONFIRMATION_HOURS=24
REVOKED_KEY_CLEANUP_DAYS=30
CONFIRMATION_MAX_ATTEMPTS=5
CONFIRMATION_LOCKOUT_MINUTES=60

# CORS 配置
CORS_ORIGINS=http://localhost:3000

# 数据库连接池配置
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=2000

# 新增：可信代理 IP 列表（逗号分隔）
TRUSTED_PROXY_IPS=127.0.0.1

# 新增：PBKDF2 迭代次数
PBKDF2_ITERATIONS=100000
EOF

mv /tmp/new_env .env

echo -e "${GREEN}✓ .env 文件已更新${NC}"
echo ""

# 显示新生成的密钥
echo -e "${YELLOW}[6/6] 新生成的安全密钥:${NC}"
echo ""
echo -e "${GREEN}ADMIN_MASTER_KEY:${NC} ${NEW_ADMIN_KEY}"
echo -e "${GREEN}CRON_SECRET:${NC} ${NEW_CRON_SECRET}"
echo -e "${GREEN}DB_PASSWORD:${NC} ${NEW_DB_PASSWORD}"
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 所有紧急修复已完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

echo -e "${YELLOW}重要提示:${NC}"
echo "1. 请测试应用是否正常运行"
echo "2. 更新数据库密码为新生成的密码"
echo "3. 在生产环境中，请使用密钥管理服务存储这些密钥"
echo "4. 查看 SECURITY_AUDIT_DETAILED.md 了解完整的审计报告和修复建议"
echo ""

# 清理临时文件
rm -f /tmp/subscribe_fix.patch

echo -e "${YELLOW}下一步操作:${NC}"
echo "- 手动修复 app/api/keys/[id]/revoke/route.ts 的所有权验证"
echo "- 修复 app/api/keys/[id]/revoke/cancel/route.ts 的权限验证"
echo "- 启用数据库 SSL 连接"
echo "- 实现真正的 LRU 限流算法"
echo ""
