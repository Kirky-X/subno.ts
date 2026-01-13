# Design: 密钥管理安全改进技术设计

## Context

SecureNotify 的密钥管理流程当前存在多个安全漏洞，包括无防误删机制、无权限验证、无恢复机制等。本次改进旨在修复这些问题，同时保持系统的可用性和性能。

### 约束条件

- 必须保持向后兼容（现有 API 端点行为不变）
- 必须在数据库迁移中保持数据完整性
- 必须支持水平扩展
- 必须保持当前性能指标（<100ms 延迟）

## Goals / Non-Goals

### Goals
1. 实现两阶段删除确认流程
2. 实现软删除机制
3. 强制权限验证
4. 增强审计日志
5. 添加删除通知

### Non-Goals
1. 不实现多因素认证（MFA）
2. 不实现密钥自动轮换策略
3. 不修改消息加密流程
4. 不引入新的外部依赖

## Decisions

### 1. 两阶段删除确认流程

**决策**：采用请求-确认模式，而非单次确认或静默确认。

**选项评估**：
| 选项 | 优点 | 缺点 |
|------|------|------|
| 单次确认 | 简单 | 无法防止误操作 |
| 静默确认 | 无额外请求 | 安全性最低 |
| 请求-确认（选中） | 平衡安全性和可用性 | 需要两次请求 |
| 多次确认 | 最高安全性 | 用户体验差 |

**最终方案**：
- `POST /keys/:id/revoke` → 发送确认码（24h 有效）
- `DELETE /keys/:id?code=xxx` → 验证后删除
- `POST /keys/:id/revoke/cancel` → 取消请求

### 2. 软删除实现方式

**决策**：使用 `isDeleted` 标记 + 定期清理，而非物理删除或归档表。

**选项评估**：
| 选项 | 优点 | 缺点 |
|------|------|------|
| 物理删除 | 节省存储 | 不可恢复 |
| 归档表 | 分离数据 | 复杂查询 |
| 软删除标记（选中） | 可恢复、简单 | 长期占用存储 |

**最终方案**：
- 添加 `isDeleted`、`revokedAt`、`revokedBy`、`revocationReason` 字段
- 查询时默认过滤 `isDeleted=true` 的记录
- `includeDeleted=true` 参数可查询已删除记录
- 30 天后 Cron 任务永久清理

### 3. 权限验证策略

**决策**：在 API 层强制验证 admin 权限，不依赖中间件。

**选项评估**：
| 选项 | 优点 | 缺点 |
|------|------|------|
| 中间件验证 | 统一处理 | 可能跳过某些路由 |
| 装饰器模式 | 声明式 | 增加复杂度 |
| API 层验证（选中） | 明确可控 | 重复代码 |

**最终方案**：
- 在每个撤销相关端点开头验证权限
- 权限验证失败返回 403 + `FORBIDDEN` 错误码
- 记录所有权限验证尝试到审计日志

### 4. 确认码存储方式

**决策**：使用一次性哈希存储确认码，不存储原始值。

**选项评估**：
| 选项 | 优点 | 缺点 |
|------|------|------|
| 明文存储 | 简单 | 安全风险 |
| 可逆加密 | 可恢复 | 复杂、密钥管理 |
| 一次性哈希（选中） | 安全、不可逆 | 一次验证 |

**最终方案**：
- 使用 `crypto.randomBytes(32)` 生成
- 使用 `argon2` 或 `bcrypt` 哈希存储
- 验证时比较哈希
- 验证后立即失效

### 5. 通知机制设计

**决策**：异步发送通知，不阻塞撤销流程。

**选项评估**：
| 选项 | 优点 | 缺点 |
|------|------|------|
| 同步发送 | 确保送达 | 阻塞主流程 |
| 异步队列（选中） | 不阻塞 | 可能延迟 |
| 仅日志 | 简单 | 无通知效果 |

**最终方案**：
- 撤销确认后，发布消息到 Redis Pub/Sub
- 后台 worker 处理通知发送
- 发送失败记录日志，不影响主流程
- 支持多种通知方式（邮件、Webhook、SSE）

## Data Model

### 现有表变更

```sql
-- public_keys 表新增字段
ALTER TABLE public_keys
ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE,
ADD COLUMN revokedAt TIMESTAMP,
ADD COLUMN revokedBy VARCHAR(255),
ADD COLUMN revocationReason TEXT;
```

### 新建表

```sql
-- 撤销确认码表
CREATE TABLE revocation_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyId UUID NOT NULL REFERENCES public_keys(id),
  confirmationCodeHash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled, expired
  reason TEXT NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  attemptCount INTEGER DEFAULT 0,
  lockedUntil TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  confirmedAt TIMESTAMP,
  confirmedBy VARCHAR(255)
);

-- 通知历史表
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyId UUID NOT NULL REFERENCES public_keys(id),
  channelId VARCHAR(64),
  notificationType VARCHAR(50) NOT NULL,
  recipientCount INTEGER DEFAULT 0,
  deliveryStatus VARCHAR(20), -- sent, failed, partial
  errorDetails JSONB,
  sentAt TIMESTAMP DEFAULT NOW()
);
```

## API 变更

### 新增端点

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/keys/:id/revoke` | 请求撤销密钥 |
| POST | `/api/keys/:id/revoke/cancel` | 取消撤销请求 |
| GET | `/api/keys/:id/revoke/status` | 查询撤销状态 |

### 修改端点

| 方法 | 路径 | 变更 |
|------|------|------|
| DELETE | `/api/keys/:id` | 添加权限验证和确认码参数 |

### 响应格式变更

```typescript
// POST /api/keys/:id/revoke 响应
interface RevokeRequestResponse {
  success: true;
  data: {
    revocationId: string;
    keyId: string;
    status: 'pending';
    expiresAt: string; // ISO 8601
    confirmationCodeSent: boolean;
  };
}

// DELETE /api/keys/:id 响应（修改后）
interface KeyDeleteResponse {
  success: true;
  data: {
    deletedId: string;
    channelId: string;
    deletedAt: string;
    deletedBy: string;
  };
}
```

## 性能考虑

### 缓存策略

- 撤销确认码信息缓存 5 分钟
- 已删除密钥信息缓存 1 小时（供审计查询）
- 使用 Redis 缓存减少数据库查询

### 索引优化

```sql
-- 加速状态查询
CREATE INDEX idx_revocations_status ON revocation_confirmations(status);
CREATE INDEX idx_revocations_expires ON revocation_confirmations(expiresAt);

-- 加速清理查询
CREATE INDEX idx_keys_deleted ON public_keys(isDeleted, revokedAt);

-- 加速审计查询
CREATE INDEX idx_audit_action ON audit_logs(action, createdAt);
```

### 批量操作

- Cron 清理任务分批处理（每批 1000 条）
- 通知发送支持批量聚合

## Security Considerations

### 确认码安全

- 使用 `crypto.randomBytes(32)` 生成
- Argon2id 哈希（内存密集型抗暴力破解）
- 5 次失败后锁定 1 小时
- 24 小时自动过期

### 权限验证

- 所有撤销操作必须提供有效 API Key
- API Key 必须包含 `admin` 权限
- 记录所有验证失败尝试

### 审计日志

- 不可篡改（写入后不可修改）
- 保留至少 90 天
- 包含完整上下文信息

## Migration Plan

### 阶段 1: 数据库迁移

```typescript
// 1. 添加新字段（无锁）
await db.schema.alterTable('public_keys').addColumns([
  column('isDeleted', 'boolean').default(false),
  column('revokedAt', 'timestamp'),
  column('revokedBy', 'varchar(255)'),
  column('revocationReason', 'text'),
]);

// 2. 创建新表
await db.schema.createTable('revocation_confirmations')...;
await db.schema.createTable('notification_history')...;

// 3. 添加索引
await db.schema.alterTable('public_keys').addIndex('idx_keys_deleted');
```

### 阶段 2: 代码部署

1. 部署新的 API 端点
2. 部署新的 Service 层代码
3. 部署 Cron 任务更新

### 阶段 3: 验证

1. 运行集成测试
2. 执行安全扫描
3. 性能测试验证

### 回滚计划

1. 数据库：删除新增列和表（可逆）
2. 代码：git revert
3. 配置：环境变量回退

## Open Questions

1. **确认码发送方式**：是否需要通过邮件发送确认码？还是仅在响应中返回？
   - 当前设计：仅在响应中返回，依赖管理员保管
   - 待确认：是否需要集成邮件服务？

2. **通知渠道**：除了站内通知，是否需要支持邮件通知？
   - 当前设计：仅站内通知（通过频道消息）
   - 待确认：邮件通知优先级？

3. **清理策略**：30 天清理是否合理？
   - 当前设计：30 天后永久删除
   - 待确认：是否符合合规要求？
