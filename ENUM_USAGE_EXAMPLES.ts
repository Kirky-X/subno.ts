// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 枚举类型使用示例
 * 
 * 本文件展示如何在代码中正确使用新的枚举类型
 */

import {
  ChannelType,
  ChannelStatus,
  ApiKeyPermission,
  PermissionGroup,
  PERMISSION_GROUPS,
  hasPermission,
  RateLimitEndpointType,
  ConfigKey,
  EncryptionAlgorithm,
  NodeEnv,
  isProduction,
  isDevelopment,
} from './lib/enums';

// ============================================================================
// 1. 频道类型使用示例
// ============================================================================

/**
 * 创建频道 - 使用枚举确保类型安全
 */
async function createChannelExample() {
  // ✅ 正确：使用枚举值
  const channel = {
    id: 'channel-123',
    name: '示例频道',
    type: ChannelType.PUBLIC, // 而不是 'public'
    status: ChannelStatus.ACTIVE,
  };
  
  // ❌ 错误：编译器会捕获无效值
  // const invalidChannel = {
  //   type: 'PRIVATE', // 编译错误！
  // };
  
  return channel;
}

/**
 * 频道类型验证
 */
function validateChannelType(input: string): ChannelType {
  // 使用验证函数
  if (input === ChannelType.PUBLIC) {
    return ChannelType.PUBLIC;
  }
  
  // 默认值
  return ChannelType.PUBLIC;
}

// ============================================================================
// 2. 权限管理使用示例
// ============================================================================

/**
 * 创建 API 密钥 - 使用预定义权限组
 */
function createApiKeyExample() {
  // 使用预定义的权限组
  const readOnlyPermissions = PERMISSION_GROUPS[PermissionGroup.READ_ONLY];
  const publisherPermissions = PERMISSION_GROUPS[PermissionGroup.PUBLISHER];
  const adminPermissions = PERMISSION_GROUPS[PermissionGroup.ADMIN];
  
  // 自定义权限组合
  const customPermissions = [
    ApiKeyPermission.READ,
    ApiKeyPermission.WRITE,
    ApiKeyPermission.PUBLISH,
  ];
  
  return {
    readOnly: readOnlyPermissions,
    publisher: publisherPermissions,
    admin: adminPermissions,
    custom: customPermissions,
  };
}

/**
 * 权限检查
 */
function checkPermissions(userPermissions: ApiKeyPermission[]) {
  // 检查单个权限
  const canPublish = hasPermission(userPermissions, ApiKeyPermission.PUBLISH);
  
  // 检查所有权限
  const hasAll = userPermissions.includes(ApiKeyPermission.READ) && 
                 userPermissions.includes(ApiKeyPermission.WRITE);
  
  // 使用工具函数检查所有权限
  const hasAllUsingHelper = userPermissions.every(perm => 
    [ApiKeyPermission.READ, ApiKeyPermission.WRITE].includes(perm)
  );
  
  return { canPublish, hasAll, hasAllUsingHelper };
}

/**
 * 权限中间件示例
 */
function authMiddleware(requiredPermission: ApiKeyPermission) {
  return async (userPermissions: ApiKeyPermission[]) => {
    if (!hasPermission(userPermissions, requiredPermission)) {
      throw new Error(`需要权限：${requiredPermission}`);
    }
    // 继续处理请求
  };
}

// ============================================================================
// 3. 速率限制使用示例
// ============================================================================

/**
 * 获取端点类型
 */
function getEndpointType(path: string): RateLimitEndpointType {
  if (path.includes('/publish')) {
    return RateLimitEndpointType.PUBLISH;
  }
  if (path.includes('/register')) {
    return RateLimitEndpointType.REGISTER;
  }
  if (path.includes('/subscribe')) {
    return RateLimitEndpointType.SUBSCRIBE;
  }
  if (path.includes('/revoke')) {
    return RateLimitEndpointType.REVOKE;
  }
  return RateLimitEndpointType.DEFAULT;
}

/**
 * 速率限制配置
 */
function getRateLimitConfig(type: RateLimitEndpointType) {
  const configs: Record<RateLimitEndpointType, { max: number; window: number }> = {
    [RateLimitEndpointType.DEFAULT]: { max: 100, window: 60 },
    [RateLimitEndpointType.PUBLISH]: { max: 10, window: 60 },
    [RateLimitEndpointType.REGISTER]: { max: 5, window: 60 },
    [RateLimitEndpointType.SUBSCRIBE]: { max: 5, window: 60 },
    [RateLimitEndpointType.REVOKE]: { max: 20, window: 60 },
  };
  
  return configs[type];
}

// ============================================================================
// 4. 配置访问使用示例
// ============================================================================

/**
 * 类型安全的配置访问
 */
function getConfigExample() {
  // 使用 ConfigKey 枚举访问配置
  const configKeys = [
    ConfigKey.DATABASE_URL,
    ConfigKey.REDIS_URL,
    ConfigKey.PORT,
  ];
  
  // 在代码中使用
  console.log('Database URL key:', ConfigKey.DATABASE_URL);
  console.log('Port key:', ConfigKey.PORT);
  
  return configKeys;
}

// ============================================================================
// 5. 算法选择使用示例
// ============================================================================

/**
 * 生成密钥对 - 使用枚举指定算法
 */
function generateKeyPair(algorithm: EncryptionAlgorithm) {
  switch (algorithm) {
    case EncryptionAlgorithm.RSA_2048:
      console.log('生成 RSA-2048 密钥对');
      break;
    case EncryptionAlgorithm.RSA_4096:
      console.log('生成 RSA-4096 密钥对');
      break;
    case EncryptionAlgorithm.ECDSA_P256:
      console.log('生成 ECDSA-P256 密钥对');
      break;
    case EncryptionAlgorithm.ED25519:
      console.log('生成 Ed25519 密钥对');
      break;
    default:
      throw new Error('不支持的算法');
  }
}

/**
 * 根据安全要求推荐算法
 */
function recommendAlgorithm(securityLevel: 'low' | 'medium' | 'high') {
  if (securityLevel === 'high') {
    return EncryptionAlgorithm.ED25519;
  }
  if (securityLevel === 'medium') {
    return EncryptionAlgorithm.RSA_4096;
  }
  return EncryptionAlgorithm.RSA_2048;
}

// ============================================================================
// 6. 环境检查使用示例
// ============================================================================

/**
 * 环境特定的逻辑
 */
function environmentSpecificLogic() {
  // 使用辅助函数
  if (isProduction()) {
    console.log('生产环境：启用严格模式');
    // 生产环境特定逻辑
  }
  
  if (isDevelopment()) {
    console.log('开发环境：启用调试模式');
    // 开发环境特定逻辑
  }
  
  // 直接使用枚举比较
  // const currentEnv = env.NODE_ENV;
  // if (currentEnv === NodeEnv.PRODUCTION) { ... }
}

/**
 * 条件日志记录
 */
function conditionalLogging() {
  // 只在非生产环境记录调试日志
  if (!isProduction()) {
    console.log('调试信息...');
  }
  
  // 根据日志级别决定是否记录
  // if (shouldLog(LogLevel.DEBUG)) { ... }
}

// ============================================================================
// 7. 数据库 Schema 集成示例
// ============================================================================

/**
 * Drizzle ORM Schema 集成
 */
const schemaExample = `
import { ChannelType } from './lib/enums';
import { pgTable, varchar } from 'drizzle-orm/pg-core';

export const channels = pgTable('channels', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // 使用枚举作为默认值
  type: varchar('type', { length: 20 })
    .notNull()
    .$default(() => ChannelType.PUBLIC),
});
`;

// ============================================================================
// 8. API 响应示例
// ============================================================================

/**
 * API 响应中包含枚举值
 */
interface ChannelResponse {
  success: true;
  data: {
    id: string;
    name: string;
    type: ChannelType; // 枚举类型
    status: ChannelStatus;
  };
}

function getChannelResponse(): ChannelResponse {
  return {
    success: true,
    data: {
      id: 'channel-123',
      name: '示例频道',
      type: ChannelType.PUBLIC,
      status: ChannelStatus.ACTIVE,
    },
  };
}

// ============================================================================
// 9. 类型守卫示例
// ============================================================================

/**
 * 运行时类型检查
 */
function processChannelData(data: unknown) {
  // 类型守卫确保数据安全
  if (data && typeof data === 'object' && 'type' in data) {
    const channelData = data as { type: string };
    
    // 验证类型
    if (Object.values(ChannelType).includes(channelData.type as ChannelType)) {
      console.log('有效的频道类型');
    } else {
      console.error('无效的频道类型');
    }
  }
}

// ============================================================================
// 10. 最佳实践建议
// ============================================================================

/**
 * 最佳实践：
 * 
 * 1. ✅ 始终使用枚举值而非字符串字面量
 *    - 好的：ChannelType.PUBLIC
 *    - 坏的：'public'
 * 
 * 2. ✅ 使用验证函数处理外部输入
 *    - isValidChannelType(input)
 * 
 * 3. ✅ 在函数签名中使用枚举类型
 *    - function foo(type: ChannelType)
 * 
 * 4. ✅ 使用预定义的权限组
 *    - PERMISSION_GROUPS[PermissionGroup.PUBLISHER]
 * 
 * 5. ✅ 利用 IDE 的自动补全
 *    - 输入 ChannelType. 会自动显示所有选项
 * 
 * 6. ✅ 在文档中说明枚举的含义
 *    - 使用 JSDoc 注释
 */

// 导出示例函数
export {
  createChannelExample,
  createApiKeyExample,
  checkPermissions,
  getEndpointType,
  generateKeyPair,
  environmentSpecificLogic,
};
