# Change: 修复密钥管理安全问题

## Why

当前密钥管理流程存在多个安全漏洞：

1. **无防误删机制**：`DELETE /api/keys/[id]` 直接执行硬删除，无二次确认
2. **权限验证缺失**：删除操作未验证 API Key 是否包含 `admin` 权限
3. **无恢复机制**：误删后无法恢复，密钥数据永久丢失
4. **审计不完整**：删除操作日志缺少必要上下文信息
5. **无通知机制**：密钥删除后，依赖方无感知，可能继续使用已删除密钥

这些问题可能导致：
- 管理员误操作删除关键密钥
- 恶意用户利用低权限 Key 删除他人密钥
- 密钥删除后服务中断，用户无感知
- 安全事故后无法追溯和恢复

## What Changes

本次变更将实现以下安全改进：

### 1. 添加两阶段删除确认机制
- 首次请求 `POST /api/keys/:id/revoke` 触发撤销流程
- 生成确认码，有效期可配置（默认 24 小时）
- 二次请求 `DELETE /api/keys/:id?confirmationCode=xxx` 执行删除
- 支持 `POST /api/keys/:id/revoke/cancel` 撤销撤销请求

### 2. 实现软删除机制
- 数据库添加 `revokedAt`、`revokedBy`、`revocationReason`、`isDeleted` 字段
- 删除操作改为更新标记，而非物理删除
- 保留数据快照用于审计和恢复
- 定期清理已软删除超过 30 天的数据

### 3. 强制权限验证
- 删除操作强制要求 API Key 包含 `admin` 权限
- 添加权限验证中间件
- 记录权限验证失败尝试

### 4. 增强审计日志
- 区分 `key_revoke_request`、`key_revoke_confirmed`、`key_revoke_cancelled`
- 记录删除前数据快照
- 记录撤销原因和操作者身份

### 5. 添加密钥删除通知
- 删除确认后通知频道所有订阅者
- 通知包含新密钥注册指引
- 保留通知历史记录

## Impact

###  Affected Specs
- `key-revocation` (新建) - 密钥撤销流程规范

### Affected Code
- `app/api/keys/` - 密钥管理 API 端点
- `src/lib/services/` - 服务层逻辑
- `src/lib/repositories/` - 数据访问层
- 数据库 Schema - 表结构变更

### Breaking Changes
**是** - 但仅影响删除操作的 API 响应格式

| 变更 | 影响 |
|------|------|
| `DELETE /api/keys/:id` 响应 | 新增 `requiresConfirmation` 字段 |
| API 响应格式 | 保持向后兼容，新增字段可选 |

### Rollback Plan
1. 数据库迁移可逆（添加的列可删除）
2. API 变更向后兼容（新增可选字段）
3. 代码变更可通过 git revert 回滚

## Non-Goals

- 不实现 MFA（多因素认证）
- 不实现密钥自动轮换策略
- 不修改消息加密流程
- 不变更其他 API 端点行为
