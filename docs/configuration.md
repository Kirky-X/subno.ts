# subno.ts 配置参考

本文档列出了 subno.ts 的所有可配置项，通过环境变量或 `.env.local` 文件设置。

## 快速配置示例

```bash
# 复制此文件为 .env.local 并修改值
cp .env.example .env.local
```

## 环境变量列表

### 数据库配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `DATABASE_URL` | 是 | - | PostgreSQL 连接字符串，格式：`postgresql://user:pass@host:port/database` |
| `REDIS_URL` | 是 | - | Redis 连接字符串，格式：`redis://host:port` |

### 消息配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `PUBLIC_MESSAGE_TTL` | 否 | 43200 (12小时) | 公开频道消息的存活时间（秒） |
| `PRIVATE_MESSAGE_TTL` | 否 | 86400 (24小时) | 私有/加密频道消息的存活时间（秒） |
| `PUBLIC_MESSAGE_MAX_COUNT` | 否 | 1000 | 公开频道消息队列最大消息数 |
| `PRIVATE_MESSAGE_MAX_COUNT` | 否 | 100 | 私有频道消息队列最大消息数 |

### Channel 配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `TEMPORARY_CHANNEL_TTL` | 否 | 1800 (30分钟) | 通过 `publish` 自动创建的临时频道存活时间（秒） |
| `PERSISTENT_CHANNEL_DEFAULT_TTL` | 否 | 86400 (24小时) | 手动创建的持久频道默认存活时间（秒） |
| `PERSISTENT_CHANNEL_MAX_TTL` | 否 | 604800 (7天) | 手动创建的持久频道最大存活时间（秒） |
| `CHANNEL_CLEANUP_INTERVAL` | 否 | 300 (5分钟) | 频道清理 Cron 任务的执行间隔（秒） |
| `AUTO_CREATE_CHANNELS_ENABLED` | 否 | true | 是否允许通过 `publish` 自动创建临时频道 |
| `MAX_CHANNEL_METADATA_SIZE` | 否 | 2048 (2KB) | 频道元数据的最大大小（字节） |

### 安全配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `MAX_MESSAGE_SIZE` | 否 | 4718592 (4.5MB) | 单条消息的最大大小（字节） |
| `RATE_LIMIT_PUBLISH` | 否 | 10 | 发布操作限流：每分钟最大请求数 |
| `RATE_LIMIT_REGISTER` | 否 | 5 | 注册公钥操作限流：每分钟最大请求数 |
| `RATE_LIMIT_SUBSCRIBE` | 否 | 5 | 订阅操作限流：每分钟最大请求数 |
| `MAX_PUBLIC_KEY_SIZE` | 否 | 4096 (4KB) | RSA 公钥的最大大小（字节） |

### 密钥配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `KEY_EXPIRY_DEFAULT` | 否 | 604800 (7天) | 注册公钥的默认过期时间（秒） |
| `KEY_EXPIRY_MAX` | 否 | 2592000 (30天) | 注册公钥的最大过期时间（秒） |

### 清理配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `CLEANUP_BATCH_SIZE` | 否 | 1000 | 清理操作的批处理大小 |
| `AUDIT_LOG_RETENTION_DAYS` | 否 | 90 | 审计日志保留天数 |
| `MESSAGE_CLEANUP_MAX_AGE_HOURS` | 否 | 12 | 消息清理的最大保留时间（小时） |

### 监控配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `LOG_LEVEL` | 否 | info | 日志级别：`debug`, `info`, `warn`, `error` |
| `ENABLE_AUDIT_LOG` | 否 | true | 是否启用审计日志记录 |

### CORS 配置

| 环境变量 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `CORS_ORIGINS` | 否 | 空 | 允许的跨域来源，多个用逗号分隔，如：`http://localhost:3000,http://localhost:5173` |

## 示例 .env.local

```bash
# Database Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/securenotify
REDIS_URL=redis://localhost:6379

# Message Configuration
PUBLIC_MESSAGE_TTL=43200
PRIVATE_MESSAGE_TTL=86400
PUBLIC_MESSAGE_MAX_COUNT=1000
PRIVATE_MESSAGE_MAX_COUNT=100

# Channel Configuration
TEMPORARY_CHANNEL_TTL=1800
PERSISTENT_CHANNEL_DEFAULT_TTL=86400
PERSISTENT_CHANNEL_MAX_TTL=604800
CHANNEL_CLEANUP_INTERVAL=300
AUTO_CREATE_CHANNELS_ENABLED=true
MAX_CHANNEL_METADATA_SIZE=2048

# Security Configuration
MAX_MESSAGE_SIZE=4718592
RATE_LIMIT_PUBLISH=10
RATE_LIMIT_REGISTER=5
RATE_LIMIT_SUBSCRIBE=5
MAX_PUBLIC_KEY_SIZE=4096

# Key Configuration
KEY_EXPIRY_DEFAULT=604800
KEY_EXPIRY_MAX=2592000

# Cleanup Configuration
CLEANUP_BATCH_SIZE=1000
AUDIT_LOG_RETENTION_DAYS=90
MESSAGE_CLEANUP_MAX_AGE_HOURS=12

# Monitoring Configuration
LOG_LEVEL=info
ENABLE_AUDIT_LOG=true

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## 生产环境配置

生产环境建议修改以下敏感配置：

```bash
# 使用强密码
DATABASE_URL=postgresql://secure_user:Str0ng_P@ssw0rd@prod-db.example.com:5432/securenotify
REDIS_URL=redis://:Redis_P@ssw0rd@redis.example.com:6379

# 启用更长的消息保留
PUBLIC_MESSAGE_TTL=86400
PRIVATE_MESSAGE_TTL=172800

# 严格限流
RATE_LIMIT_PUBLISH=5
RATE_LIMIT_REGISTER=2
RATE_LIMIT_SUBSCRIBE=3

# 限制 CORS
CORS_ORIGINS=https://yourdomain.com
```

## 配置验证

配置在应用启动时自动验证。如果配置无效，应用将拒绝启动并显示错误信息。

使用以下命令检查当前配置：

```bash
# 开发环境启动
npm run dev

# 生产构建
npm run build
npm start
```
