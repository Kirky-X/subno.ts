# 使用 Node.js 20 Alpine（FunctionGraph 支持的运行时版本）
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 禁用 telemetry 和安装时的任何交互
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=1

# 允许构建时使用占位符 DATABASE_URL（生产环境会覆盖）
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-postgres://user:pass@localhost:5432/db}

RUN npm run build

# 生产阶段 - 使用 standalone 输出
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户（安全要求）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制 locales
COPY --from=builder /app/public/locales ./public/locales

# 设置文件所有权
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置启动命令
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
