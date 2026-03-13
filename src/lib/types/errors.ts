// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 统一错误类型定义
 * 
 * 注意：此文件保留用于向后兼容
 * 新代码应从 '@/src/lib/utils/error-handler' 导入
 */

// 从新的错误处理模块重新导出
export {
  // 错误码
  ErrorCode,
  HTTP_STATUS_MAP,
  
  // 错误类
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ResourceError,
  RateLimitError,
  ServerError,
  
  // 辅助函数
  isRetryableError,
  
  // 类型
  type ErrorSeverity,
} from '../utils/error-handler';

// 保留旧版兼容类型（已废弃）
export type { StandardErrorResponse, StandardSuccessResponse, ApiResponse } from '../utils/error-handler';
