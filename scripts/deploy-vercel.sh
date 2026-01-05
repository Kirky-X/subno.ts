#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

# subno.ts Vercel 部署脚本
# 用法:
#   ./deploy-vercel.sh          # 预览部署
#   ./deploy-vercel.sh --prod   # 生产部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印横幅
echo ""
echo "🚀 subno.ts Vercel 部署脚本"
echo "============================"

# 检查参数
DEPLOY_MODE="preview"
if [ "${1:-}" = "--prod" ]; then
    DEPLOY_MODE="production"
    log_info "部署模式: 生产环境"
else
    log_info "部署模式: 预览环境"
fi

# 检查 Node.js 版本
log_info "检查 Node.js 版本..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ]; then
    log_error "未检测到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js 18+ 必需，当前版本: $(node -v)"
    exit 1
fi
log_info "✅ Node.js 版本检查通过: $(node -v)"

# 检查 Vercel CLI
log_info "检查 Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    log_warn "未检测到 Vercel CLI，正在安装..."
    npm i -g vercel
fi
log_info "✅ Vercel CLI 版本: $(vercel --version)"

# 检查 package.json
if [ ! -f "package.json" ]; then
    log_error "package.json 不存在，请确保在项目根目录运行此脚本"
    exit 1
fi

# 安装依赖
log_info "安装依赖..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile
elif [ -f "yarn.lock" ]; then
    yarn install --frozen-lockfile
elif [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi
log_info "✅ 依赖安装完成"

# 构建项目
log_info "构建项目..."
npm run build
if [ $? -ne 0 ]; then
    log_error "构建失败，请检查错误信息"
    exit 1
fi
log_info "✅ 构建完成"

# 部署到 Vercel
log_info "部署到 Vercel..."
if [ "$DEPLOY_MODE" = "production" ]; then
    vercel --prod --yes
else
    vercel --yes
fi

if [ $? -eq 0 ]; then
    log_info "✅ 部署成功！"
    echo ""
    echo "📝 后续步骤:"
    echo "1. 访问 Vercel 控制台检查部署状态: https://vercel.com/dashboard"
    echo "2. 在项目 Settings > Environment Variables 中配置环境变量（参考 .env.server）"
    echo "3. 如果是首次部署，运行数据库迁移: npx drizzle-kit migrate"
    echo "4. 重新部署以应用环境变量"
else
    log_error "部署失败，请检查 Vercel 控制台获取详细信息"
    exit 1
fi

echo ""
echo "🎉 部署完成！"
