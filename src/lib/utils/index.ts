// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export {
  secureCompare,
  validateLength,
  containsInvalidCharacters,
  sanitizeErrorMessage,
  KEY_MANAGEMENT_CONFIG,
} from './secure-compare';

export { parseEnvInt, isValidUUID } from './env.utils';

// 统一错误处理 - 主要导出
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
  
  // 错误处理器
  ErrorHandler,
  errorHandler,
  
  // 请求上下文
  extractRequestContext,
  generateRequestId,
  type RequestContext,
  
  // 响应格式
  successResponse,
  errorResponse,
  type StandardErrorResponse,
  type StandardSuccessResponse,
  type ApiResponse,
  
  // API 路由包装器
  withErrorHandler,
  
  // 快捷错误创建
  Errors,
  
  // 辅助函数
  isRetryableError,
  isClientError,
  isServerError,
  
  // 类型
  type ErrorSeverity,
  type ErrorHandlerConfig,
} from './error-handler';

// 保留旧版兼容导出（已废弃，建议使用新模块）
export {
  generateErrorId,
  createError,
  createErrorResponse,
  handleError,
  withErrorHandling,
  ERROR_CODES,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  rateLimitError,
  internalError,
  type AppError as LegacyAppError,
  type ErrorResponse as LegacyErrorResponse,
  type ErrorSeverity as LegacyErrorSeverity,
} from './error.utils';

export * from './validation';

export {
  isSensitiveHeader,
  sanitizeHeaderValue,
  sanitizeHeaders,
  sanitizeHeadersForLog,
  sanitizeHeaderForLog,
  headersContainSensitiveInfo,
  SENSITIVE_HEADERS,
} from './header-sanitization';

export {
  mapServiceError,
  type ServiceResult,
} from './service-error-mapper';

export {
  validateRequestBody,
  validateRequiredString,
  validateOptionalString,
} from './request-validator';
