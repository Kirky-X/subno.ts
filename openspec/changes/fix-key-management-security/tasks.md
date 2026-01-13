# Tasks: 修复密钥管理安全问题

## 1. 数据库 Schema 变更
- [x] 1.1 为 `public_keys` 表添加 `revokedAt`、`revokedBy`、`revocationReason`、`isDeleted` 字段
- [x] 1.2 为 `api_keys` 表添加相同字段（支持 API Key 撤销）
- [x] 1.3 创建 `revocation_confirmations` 表存储撤销确认码
- [x] 1.4 创建数据库迁移脚本 (`scripts/migrate-revocation.js`)
- [x] 1.5 编写 Schema 变更测试

## 2. 数据访问层修改
- [x] 2.1 修改 `PublicKeyRepository` 支持软删除查询
- [x] 2.2 修改 `ApiKeyRepository` 支持软删除查询
- [x] 2.3 实现撤销确认码的 CRUD 操作
- [x] 2.4 实现数据快照保存功能 (通过 AuditService metadata)
- [x] 2.5 编写 Repository 层单元测试

## 3. 服务层实现
- [x] 3.1 实现 `KeyRevocationService` 处理撤销流程
- [x] 3.2 实现两阶段删除确认逻辑
- [x] 3.3 实现撤销请求取消逻辑
- [x] 3.4 实现权限验证中间件 (在 DELETE 端点中实现)
- [x] 3.5 实现密钥删除通知服务 (CleanupService)
- [x] 3.6 编写 Service 层单元测试

## 4. API 端点修改
- [x] 4.1 修改 `DELETE /api/keys/:id` 添加权限验证和确认机制
- [x] 4.2 新增 `POST /api/keys/:id/revoke` 触发撤销流程
- [x] 4.3 新增 `POST /api/keys/:id/revoke/cancel` 取消撤销
- [x] 4.4 新增 `GET /api/keys/:id/revoke/status` 查询撤销状态
- [x] 4.5 更新 API 文档和 swagger
- [x] 4.6 编写 API 端点集成测试

## 5. 审计日志增强
- [x] 5.1 修改 `AuditService` 支持新的审计动作类型
- [x] 5.2 实现删除前数据快照记录 (metadata 字段)
- [x] 5.3 添加撤销确认/取消的审计日志
- [x] 5.4 编写审计日志测试

## 6. 清理任务更新
- [x] 6.1 实现 `CleanupService` 支持软删除数据清理
- [x] 6.2 添加清理过期撤销确认码的任务
- [x] 6.3 更新清理任务文档
- [x] 6.4 编写清理任务测试

## 7. 配置和环境变量
- [x] 7.1 添加 `REVOCATION_CONFIRMATION_HOURS` 环境变量（默认 24）
- [x] 7.2 添加 `REVOKED_KEY_CLEANUP_DAYS` 环境变量（默认 30）
- [x] 7.3 更新 `.env.example` 文件
- [x] 7.4 更新配置文档

## 8. 文档更新
- [x] 8.1 更新 `docs/API_REFERENCE.md` 中的密钥管理章节
- [x] 8.2 更新 `docs/ARCHITECTURE.md` 中的密钥管理服务描述
- [x] 8.3 更新 API 文档页面 `app/api-docs/page.tsx`
- [x] 8.4 编写迁移指南文档 `docs/MIGRATION_KEY_REVOCATION.md`

## 已创建的文件清单

### 数据库层
- `src/db/schema.ts` - 数据库 Schema 定义 (软删除字段 + 新表)
- `src/db/index.ts` - 数据库连接管理

### Repository 层
- `src/lib/repositories/public-key.repository.ts` - 公钥 Repository (软删除)
- `src/lib/repositories/api-key.repository.ts` - API 密钥 Repository (软删除)
- `src/lib/repositories/revocation-confirmation.repository.ts` - 撤销确认码 Repository
- `src/lib/repositories/index.ts` - Repository 导出

### Service 层
- `src/lib/services/key-revocation.service.ts` - 密钥撤销服务
- `src/lib/services/audit.service.ts` - 审计日志服务
- `src/lib/services/cleanup.service.ts` - 清理服务
- `src/lib/services/index.ts` - Service 导出

### API 端点
- `app/api/keys/[id]/route.ts` - DELETE /api/keys/:id (两阶段确认)
- `app/api/keys/[id]/revoke/route.ts` - POST/GET /api/keys/:id/revoke
- `app/api/keys/[id]/revoke/cancel/route.ts` - POST /api/keys/:id/revoke/cancel

### 脚本和测试
- `scripts/migrate-revocation.js` - 数据库迁移脚本
- `__tests__/key-revocation.test.ts` - 单元测试 (13 tests, all passed)

### 配置和文档
- `.env.example` - 已添加撤销配置变量
- `docs/API_REFERENCE.md` - 已添加两阶段撤销流程文档
- `docs/ARCHITECTURE.md` - 已添加密钥撤销流程图和软删除机制
- `docs/MIGRATION_KEY_REVOCATION.md` - 迁移指南文档

## 验收标准

- [x] 核心 API 端点已实现
- [x] 测试文件已创建 (13 tests passed)
- [x] API 文档已更新
- [x] 环境变量已配置
- [x] 迁移脚本已创建
- [x] 迁移指南已编写

## 快速开始

```bash
# 运行迁移
npm run db:migrate:revocation

# 运行测试
npm test -- key-revocation.test.ts

# 启动开发服务器
npm run dev
```
