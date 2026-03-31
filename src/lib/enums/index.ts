// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 统一枚举导出文件
 * 提供所有枚举类型的集中访问点
 */

// Channel enums
export {
  ChannelType,
  ChannelStatus,
  isValidChannelType,
  isValidChannelStatus,
  getChannelTypeLabel,
  getChannelStatusLabel,
} from './channel.enums';

// Permission enums
export {
  ApiKeyPermission,
  PermissionGroup,
  PERMISSION_GROUPS,
  isValidApiKeyPermission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionLabel,
} from './permission.enums';

// Rate limit enums
export { RateLimitEndpointType, getRateLimitEndpointLabel } from './ratelimit.enums';

// Config enums
export { ConfigKey, ConfigCategory, CONFIG_CATEGORIES } from './config.enums';

// Algorithm enums
export {
  EncryptionAlgorithm,
  AlgorithmStrength,
  ALGORITHM_STRENGTH,
  isValidEncryptionAlgorithm,
  getAlgorithmRecommendation,
} from './algorithm.enums';

// Environment enums
export {
  NodeEnv,
  LogLevel,
  isProduction,
  isDevelopment,
  isTest,
  shouldLog,
  getLogLevelValue,
} from './environment.enums';

// Re-export existing enums from other modules
export {
  RevocationStatus,
  DeliveryStatus,
  isValidRevocationStatus,
  isValidDeliveryStatus,
  getRevocationStatusLabel,
  getDeliveryStatusLabel,
} from '../types/revocation.types';

export { ErrorCode, HTTP_STATUS_MAP } from '../utils/error-handler';
