# 迁移指南：密钥管理安全改进

## 概述

本文档描述如何将现有 SecureNotify 部署迁移到支持两阶段撤销确认流程的版本。

## 变更内容

### 新增数据库字段

| 表名 | 新增字段 | 类型 | 说明 |
|------|----------|------|------|
| `public_keys` | `is_deleted` | BOOLEAN | 软删除标记 |
| `public_keys` | `revoked_at` | TIMESTAMP | 撤销时间 |
| `public_keys` | `revoked_by` | VARCHAR(255) | 撤销操作者 |
| `public_keys` | `revocation_reason` | TEXT | 撤销原因 |
| `api_keys` | `is_deleted` | BOOLEAN | 软删除标记 |
| `api_keys` | `revoked_at` | TIMESTAMP | 撤销时间 |
| `api_keys` | `revoked_by` | VARCHAR(255) | 撤销操作者 |
| `api_keys` | `revocation_reason` | TEXT | 撤销原因 |

### 新增表

| 表名 | 说明 |
|------|------|
| `revocation_confirmations` | 存储撤销确认码和状态 |
| `notification_history` | 存储通知发送历史 |

### 新增环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `REVOCATION_CONFIRMATION_HOURS` | 24 | 撤销确认码有效期（小时） |
| `REVOKED_KEY_CLEANUP_DAYS` | 30 | 已撤销密钥清理时间（天） |
| `CONFIRMATION_MAX_ATTEMPTS` | 5 | 确认码最大尝试次数 |
| `CONFIRMATION_LOCKOUT_MINUTES` | 60 | 尝试过多后锁定时间（分钟） |

## 迁移步骤

### 步骤 1：备份数据库

```bash
# 备份 PostgreSQL 数据库
pg_dump -h localhost -U securenotify -d securenotify > backup-$(date +%Y%m%d).sql
```

### 步骤 2：运行迁移脚本

```bash
# 安装依赖
npm install

# 运行迁移
npm run db:migrate:revocation
```

### 步骤 3：验证迁移

```bash
# 检查新列是否存在
psql -d securenotify -c "\d public_keys"
psql -d securenotify -c "\d revocation_confirmations"

# 确认索引已创建
psql -d securenotify -c "\di"
```

### 步骤 4：更新环境变量

在 `.env` 文件中添加：

```env
# 密钥撤销配置
REVOCATION_CONFIRMATION_HOURS=24
REVOKED_KEY_CLEANUP_DAYS=30
CONFIRMATION_MAX_ATTEMPTS=5
CONFIRMATION_LOCKOUT_MINUTES=60
```

### 步骤 5：重新部署应用

```bash
# 开发环境
npm run dev

# 生产环境
npm run build
npm start
```

## API 变更说明

### 旧版 API（已废弃但仍可用）

```bash
# 直接删除密钥（需要 ADMIN_MASTER_KEY）
curl -X DELETE http://localhost:3000/api/keys/enc_channel_id \
  -H "X-Admin-Key: your-admin-master-key"
```

### 新版 API（推荐）

```bash
# 1. 请求撤销（返回确认码）
curl -X POST http://localhost:3000/api/keys/enc_channel_id/revoke \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key-id>" \
  -d '{"reason": "Key rotation required"}'

# 响应包含 confirmationCode，请立即保存！
# {"data": {"confirmationCode": "xxx", "expiresAt": "..."}}

# 2. 确认执行撤销
curl -X DELETE "http://localhost:3000/api/keys/enc_channel_id?confirmationCode=xxx" \
  -H "X-API-Key: <api-key-id>"

# 3. 或取消撤销请求
curl -X POST http://localhost:3000/api/keys/enc_channel_id/revoke/cancel \
  -H "X-API-Key: <api-key-id>"
```

## 回滚说明

如果需要回滚迁移：

```bash
# 回滚数据库变更
npm run db:migrate:revocation:rollback

# 注意：此命令会删除新表，但不会删除已添加的列
# 如需删除列，请手动执行：
psql -d securenotify -c "ALTER TABLE public_keys DROP COLUMN IF EXISTS is_deleted, DROP COLUMN IF EXISTS revoked_at, DROP COLUMN IF EXISTS revoked_by, DROP COLUMN IF EXISTS revocation_reason;"
psql -d securenotify -c "ALTER TABLE api_keys DROP COLUMN IF EXISTS is_deleted, DROP COLUMN IF EXISTS revoked_at, DROP COLUMN IF EXISTS revoked_by, DROP COLUMN IF EXISTS revocation_reason;"
```

## 常见问题

### Q1: 现有的密钥会被标记为已删除吗？

不会。现有的密钥保持 `is_deleted = false`，不受迁移影响。

### Q2: 迁移会影响现有 API 调用吗？

不会。现有 API 端点保持兼容，新增了更安全的撤销流程。

### Q3: 确认码过期后怎么办？

重新发起撤销请求，系统会生成新的确认码。

### Q4: 紧急情况下如何快速删除密钥？

使用 `X-Admin-Key` 头直接删除（需要提供 reason）：

```bash
curl -X DELETE http://localhost:3000/api/keys/enc_channel_id \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-master-key" \
  -d '{"reason": "Emergency key revocation - security incident"}'
```

## 测试验证

运行测试确保迁移正确：

```bash
# 运行所有测试
npm test

# 运行迁移相关测试
npm test -- key-revocation
```

## 联系支持

如果在迁移过程中遇到问题，请：
1. 检查应用日志：`npm run dev` 或查看生产环境日志
2. 验证数据库连接和权限
3. 联系技术支持团队
