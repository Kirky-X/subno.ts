# Change: Fix Critical Security Vulnerabilities

## Why

代码审查发现多个安全漏洞需要立即修复：

1. **API Key 权限验证缺失** - 任意 API Key 都可以请求撤销任何公钥，无需验证权限
2. **Admin Key 时序攻击风险** - 使用 `!==` 比较敏感凭据，可能被攻击者利用
3. **Cleanup 服务的 N+1 查询** - 性能问题可能导致服务不稳定

这些问题直接影响系统的安全性，必须在下个发布周期内修复。

## What Changes

### Security Fixes
- **API Key 权限验证**: 在撤销请求前验证 API Key 是否具有 `key_revoke` 或 `admin` 权限
- **安全字符串比较**: 替换 `!==` 为 `timingSafeEqual` 防止时序攻击
- **输入验证增强**: 添加 reason 最大长度检查和特殊字符过滤
- **错误信息脱敏**: 防止错误堆栈泄露数据库结构信息

### Performance Fixes
- **批量数据库操作**: 将 N+1 查询模式改为批量更新
- **事务支持**: 使用单个事务处理多个数据库操作

### Quality Improvements
- **类型断言修复**: 移除 `as unknown as` 双重断言
- **导入路径统一**: 统一使用 `@/src/*` 路径别名
- **配置外部化**: 将 Magic Numbers 移至配置常量

## Impact

### Affected Capabilities
- **security.authentication** - API Key 权限验证
- **security.audit** - 审计日志增强
- **system.maintenance** - Cleanup 服务性能

### Affected Code Files
- `app/api/keys/[id]/revoke/route.ts` - 权限验证
- `app/api/keys/[id]/route.ts` - Admin Key 安全比较
- `src/lib/services/cleanup.service.ts` - 批量操作优化
- `src/lib/services/key-revocation.service.ts` - 输入验证
- `src/lib/repositories/api-key.repository.ts` - 类型修复

### Breaking Changes
无破坏性变更，所有更改向后兼容。

### Rollback Plan
- 所有变更可通过 git revert 快速回滚
- 数据库迁移: 无需迁移
- 配置变更: 环境变量新增 `SECURE_COMPARE_ENABLED=true` (可选)
