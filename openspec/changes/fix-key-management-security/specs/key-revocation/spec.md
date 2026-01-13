# Key Revocation - 密钥撤销流程规范

## ADDED Requirements

### Requirement: 两阶段密钥撤销流程

系统 SHALL 实现两阶段撤销流程，防止误操作和未授权删除。

#### Scenario: 管理员请求撤销密钥

- **WHEN** 管理员调用 `POST /api/keys/{keyId}/revoke` 并提供有效的 `admin` 权限 API Key
- **AND** 请求包含 `reason` 参数（最小 10 字符）
- **THEN** 系统创建撤销确认记录
- **AND** 生成唯一确认码（有效期可配置，默认 24 小时）
- **AND** 返回确认信息包含 `revocationId` 和 `expiresAt`

#### Scenario: 确认执行撤销

- **WHEN** 管理员调用 `DELETE /api/keys/{keyId}?confirmationCode={code}`
- **AND** 确认码有效且未过期
- **AND** 密钥状态为 `pending_revoke`
- **THEN** 系统执行软删除（设置 `revokedAt`、`revokedBy`、`isDeleted`）
- **AND** 记录完整审计日志
- **AND** 通知频道订阅者

#### Scenario: 撤销请求被取消

- **WHEN** 管理员调用 `POST /api/keys/{keyId}/revoke/cancel` 并提供有效确认码
- **AND** 撤销请求处于 `pending_revoke` 状态
- **AND** 确认码匹配
- **THEN** 系统取消撤销请求
- **AND** 清除 `revokedAt`、`revokedBy` 标记
- **AND** 记录审计日志 `key_revoke_cancelled`

---

### Requirement: 软删除机制

系统 SHALL 实现软删除机制，支持数据恢复和审计追踪。

#### Scenario: 执行软删除

- **WHEN** 密钥撤销被确认
- **THEN** 系统设置 `isDeleted = true`
- **AND** 系统设置 `revokedAt = current_timestamp`
- **AND** 系统设置 `revokedBy = admin_user_id`
- **AND** 系统设置 `revocationReason = provided_reason`
- **AND** 系统保存删除前数据快照到审计日志

#### Scenario: 查询软删除的密钥

- **WHEN** 查询请求包含 `includeDeleted=true` 参数
- **AND** 请求者具有 `admin` 权限
- **THEN** 系统返回包含已删除密钥的结果
- **AND** 结果中包含 `isDeleted`、`revokedAt` 等元信息

#### Scenario: 正常查询不返回已删除密钥

- **WHEN** 查询请求不包含 `includeDeleted` 参数
- **THEN** 系统过滤掉 `isDeleted = true` 的密钥
- **AND** 返回的密钥均可正常使用

#### Scenario: 自动清理过期软删除数据

- **WHEN** Cron 任务 `cleanup-keys` 执行
- **AND** 配置了 `REVOKED_KEY_CLEANUP_DAYS`（默认 30 天）
- **THEN** 系统永久删除 `revokedAt` 超过 30 天的密钥记录
- **AND** 保留审计日志中的数据快照

---

### Requirement: 强制权限验证

系统 SHALL 强制验证撤销操作的权限要求。

#### Scenario: 无权限用户尝试撤销

- **WHEN** 用户调用撤销端点
- **AND** API Key 不包含 `admin` 权限
- **THEN** 系统返回 403 Forbidden
- **AND** 错误码为 `FORBIDDEN`
- **AND** 系统记录权限验证失败到审计日志

#### Scenario: 无认证请求

- **WHEN** 用户未提供 API Key
- **THEN** 系统返回 401 Unauthorized
- **AND** 错误码为 `AUTH_REQUIRED`

#### Scenario: 权限验证日志记录

- **WHEN** 权限验证失败
- **THEN** 系统记录 `auth_failure` 到审计日志
- **AND** 日志包含 `ip`、`userAgent`、`keyId`
- **AND** 日志包含 `attemptedAction`

---

### Requirement: 增强审计日志

系统 SHALL 记录完整的密钥撤销操作审计日志。

#### Scenario: 记录撤销请求

- **WHEN** 管理员请求撤销密钥
- **THEN** 系统创建审计日志
- **AND** `action = "key_revoke_request"`
- **AND** 记录 `keyId`、`userId`、`ip`、`userAgent`
- **AND** 记录 `reason`（脱敏后）
- **AND** 记录 `confirmationExpiresAt`

#### Scenario: 记录撤销确认

- **WHEN** 撤销操作被执行
- **THEN** 系统创建审计日志
- **AND** `action = "key_revoke_confirmed"`
- **AND** 记录 `keySnapshot`（删除前完整数据）
- **AND** 记录 `revokedBy`、`revocationReason`
- **AND** 记录 `duration`（从请求到确认的时间）

#### Scenario: 记录撤销取消

- **WHEN** 撤销请求被取消
- **THEN** 系统创建审计日志
- **AND** `action = "key_revoke_cancelled"`
- **AND** 记录 `keyId`、`userId`
- **AND** 记录 `cancelledBy`

---

### Requirement: 密钥删除通知

系统 SHALL 在密钥删除后通知相关方。

#### Scenario: 通知频道订阅者

- **WHEN** 密钥撤销被确认
- **AND** 密钥关联加密频道（`enc_*`）
- **THEN** 系统向频道所有订阅者发送通知
- **AND** 通知类型为 `key_revoked`
- **AND** 通知包含 `channelId`、`revokedAt`、`newKeyRegistrationUrl`

#### Scenario: 记录通知发送历史

- **WHEN** 通知被发送
- **THEN** 系统记录通知历史
- **AND** 包含 `notificationId`、`keyId`、`channelId`、`sentAt`
- **AND** 包含 `recipientCount`、`deliveryStatus`

#### Scenario: 通知失败处理

- **WHEN** 通知发送失败
- **THEN** 系统记录通知失败日志
- **AND** 错误信息包含 `failedRecipients`
- **AND** 系统继续执行撤销操作（通知失败不影响核心流程）

---

### Requirement: 撤销确认码管理

系统 SHALL 安全地管理撤销确认码的生命周期。

#### Scenario: 生成安全的确认码

- **WHEN** 撤销请求被创建
- **THEN** 系统生成加密安全的随机确认码
- **AND** 确认码长度至少 32 字符
- **AND** 确认码使用一次性哈希存储（不存储原始值）

#### Scenario: 确认码过期处理

- **WHEN** 使用过期确认码
- **THEN** 系统返回 410 Gone
- **AND** 错误码为 `CONFIRMATION_CODE_EXPIRED`
- **AND** 撤销请求状态变为 `expired`

#### Scenario: 确认码验证限制

- **WHEN** 确认码验证失败
- **THEN** 系统记录失败尝试
- **AND** 5 次失败后锁定撤销请求 1 小时
- **AND** 锁定期间无法确认或取消

---

### Requirement: 环境配置

系统 SHALL 支持可配置的撤销流程参数。

#### Scenario: 默认配置

- **WHEN** 环境变量未设置
- **THEN** 系统使用默认值
- **AND** `REVOCATION_CONFIRMATION_HOURS = 24`
- **AND** `REVOKED_KEY_CLEANUP_DAYS = 30`
- **AND** `CONFIRMATION_MAX_ATTEMPTS = 5`
- **AND** `CONFIRMATION_LOCKOUT_MINUTES = 60`

#### Scenario: 自定义配置

- **WHEN** 环境变量 `REVOCATION_CONFIRMATION_HOURS` 设置
- **THEN** 系统使用自定义值作为确认码有效期
- **AND** 支持范围：1-168 小时（1 小时到 7 天）

#### Scenario: 配置验证

- **WHEN** 环境变量值无效
- **THEN** 系统在启动时记录警告
- **AND** 回退到默认值
- **AND** 不阻止服务启动

---

## Cross-Reference

- 相关规范：`audit-logs`（审计日志规范）
- 相关规范：`api-authentication`（认证规范）
- 相关规范：`cron-tasks`（定时任务规范）
