# Design: Security Vulnerabilities Fix

## Context

代码审查发现 3 个 Critical 和 3 个 High 优先级的安全问题。这些问题涉及：
- API 认证授权层
- 密钥管理服务
- 数据库操作性能

修复需要确保：
1. 不引入新的安全风险
2. 保持向后兼容性
3. 不破坏现有功能

## Goals / Non-Goals

### Goals
- 修复 API Key 权限验证漏洞
- 消除时序攻击风险
- 优化批量数据库操作
- 增强输入验证
- 统一代码质量标准

### Non-Goals
- 不重新设计整体架构
- 不添加新的功能特性
- 不修改数据库 schema
- 不改变 API 响应格式

## Decisions

### 1. API Key 权限验证架构

**Decision**: 在服务层验证权限，而非依赖外部中间件

**Rationale**:
- 中间件可能配置不完整
- 服务层验证更可靠、可测试
- 符合纵深防御原则

**Implementation**:
```typescript
// key-revocation.service.ts
async validateApiKeyPermission(apiKeyId: string): Promise<boolean> {
  const key = await apiKeyRepository.findByKeyHash(apiKeyId);
  if (!key || !key.isActive || key.isDeleted) return false;
  return key.permissions.includes('admin') ||
         key.permissions.includes('key_revoke');
}
```

### 2. 安全字符串比较

**Decision**: 使用 Node.js crypto.timingSafeEqual 实现常量时间比较

**Alternatives Considered**:
- 使用第三方库 `scmp` - 增加依赖
- 实现双延迟 - 不够可靠
- 编译器屏障 - 不可移植

**Implementation**:
```typescript
// src/lib/utils/secure-compare.ts
import crypto from 'crypto';

export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // 使用常量时间比较长度
    crypto.timingSafeEqual(
      Buffer.alloc(1, 0),
      Buffer.from([bufA.length === bufB.length ? 1 : 0])
    );
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
```

### 3. 批量数据库操作

**Decision**: 使用 Drizzle ORM 的 `inArray` 进行批量更新

**Rationale**:
- 减少数据库往返次数
- 支持事务操作
- 保持现有 ORM 使用模式

**Implementation**:
```typescript
// cleanup.service.ts
import { inArray } from 'drizzle-orm';

async cleanupExpiredRevocations() {
  const ids = expiredConfirmations.map(c => c.id);
  await db
    .update(revocationConfirmations)
    .set({ status: 'expired' })
    .where(inArray(revocationConfirmations.id, ids));
}
```

## Risks / Trade-offs

### Risk: 权限验证可能影响现有用户
- **Mitigation**: 添加详细的错误日志和监控
- **Mitigation**: 提供 7 天宽限期记录权限问题

### Risk: 批量操作可能锁定表
- **Mitigation**: 分批处理（每批 500 条）
- **Mitigation**: 使用事务而非锁定表

### Trade-off: 安全 vs 性能
- 安全比较增加少量 CPU 开销（可忽略）
- 批量操作显著提升性能（减少 N 次往返）

## Migration Plan

### Phase 1: 安全基础设施
1. 创建 `secure-compare.ts` 工具模块
2. 修复类型断言问题
3. 统一导入路径

### Phase 2: 核心安全修复
1. 添加 API Key 权限验证
2. 替换 Admin Key 比较
3. 增强输入验证

### Phase 3: 性能优化
1. 重构 Cleanup 批量操作
2. 添加数据库索引
3. 验证无回归

### Rollback Procedure
```bash
git revert --no-commit <commit-hash>
git commit -m "Revert: Rollback security fixes"
```

## Open Questions

1. **Q: 是否需要添加权限缓存？**
   A: 建议添加 5 分钟 Redis 缓存，减少数据库查询

2. **Q: Admin Key 过期机制？**
   A: 当前无过期，建议添加可选的过期时间配置

3. **Q: 是否需要通知管理员权限变更？**
   A: 建议通过审计日志记录，无需额外通知
