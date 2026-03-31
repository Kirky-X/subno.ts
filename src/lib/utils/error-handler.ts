// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ============================================================================
// 错误码定义
// ============================================================================

/**
 * 统一错误码枚举
 * 按类别分组，便于管理和扩展
 */
export enum ErrorCode {
  // 认证错误 (401)
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INACTIVE_API_KEY = 'INACTIVE_API_KEY',
  REVOKED_API_KEY = 'REVOKED_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_ADMIN_KEY = 'INVALID_ADMIN_KEY',

  // 授权错误 (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // 验证错误 (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_REASON = 'INVALID_REASON',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_CODE = 'INVALID_CODE',

  // 资源错误 (404/409)
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  ALREADY_REVOKED = 'ALREADY_REVOKED',
  REVOCATION_PENDING = 'REVOCATION_PENDING',
  KEY_EXPIRED = 'KEY_EXPIRED',

  // 状态错误 (400)
  INVALID_STATE = 'INVALID_STATE',
  LOCKED = 'LOCKED',

  // 速率限制 (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 服务器错误 (50x)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DELETE_FAILED = 'DELETE_FAILED',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // 未知错误
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// HTTP 状态码映射
// ============================================================================

/**
 * 错误码到 HTTP 状态码的映射
 */
export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  // 401 - 认证错误
  [ErrorCode.MISSING_API_KEY]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.INACTIVE_API_KEY]: 401,
  [ErrorCode.REVOKED_API_KEY]: 401,
  [ErrorCode.EXPIRED_API_KEY]: 401,
  [ErrorCode.AUTH_FAILED]: 401,
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.INVALID_ADMIN_KEY]: 401,

  // 403 - 授权错误
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 400 - 验证错误
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.MISSING_PARAMETER]: 400,
  [ErrorCode.INVALID_REASON]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.INVALID_CODE]: 400,

  // 404/409 - 资源错误
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.ALREADY_REVOKED]: 409,
  [ErrorCode.REVOCATION_PENDING]: 409,
  [ErrorCode.KEY_EXPIRED]: 410,

  // 400 - 状态错误
  [ErrorCode.INVALID_STATE]: 400,
  [ErrorCode.LOCKED]: 423,

  // 429 - 速率限制
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  // 50x - 服务器错误
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_GATEWAY]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.DELETE_FAILED]: 500,
  [ErrorCode.ENCRYPTION_ERROR]: 500,
  [ErrorCode.DECRYPTION_ERROR]: 500,
  [ErrorCode.NETWORK_ERROR]: 500,
  [ErrorCode.TIMEOUT_ERROR]: 500,

  [ErrorCode.UNKNOWN]: 500,
};

// ============================================================================
// 用户友好的错误消息
// ============================================================================

/**
 * 用户友好的错误消息映射
 * 这些消息是安全的，不会泄露系统内部信息
 */
const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.MISSING_API_KEY]: 'API 密钥是必需的',
  [ErrorCode.INVALID_API_KEY]: '无效的 API 密钥',
  [ErrorCode.INACTIVE_API_KEY]: 'API 密钥已停用',
  [ErrorCode.REVOKED_API_KEY]: 'API 密钥已被撤销',
  [ErrorCode.EXPIRED_API_KEY]: 'API 密钥已过期',
  [ErrorCode.AUTH_FAILED]: '认证失败',
  [ErrorCode.AUTH_REQUIRED]: '需要认证',
  [ErrorCode.INVALID_ADMIN_KEY]: '无效的管理员密钥',

  [ErrorCode.FORBIDDEN]: '访问被拒绝',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',

  [ErrorCode.VALIDATION_ERROR]: '请求验证失败',
  [ErrorCode.INVALID_REQUEST]: '无效的请求',
  [ErrorCode.INVALID_PARAMETER]: '无效的参数',
  [ErrorCode.MISSING_PARAMETER]: '缺少必需的参数',
  [ErrorCode.INVALID_REASON]: '无效的原因说明',
  [ErrorCode.INVALID_INPUT]: '无效的输入',
  [ErrorCode.INVALID_CODE]: '无效的确认码',

  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.ALREADY_EXISTS]: '资源已存在',
  [ErrorCode.ALREADY_REVOKED]: '密钥已被撤销',
  [ErrorCode.REVOCATION_PENDING]: '撤销请求正在处理中',
  [ErrorCode.KEY_EXPIRED]: '密钥已过期',

  [ErrorCode.INVALID_STATE]: '无效的操作状态',
  [ErrorCode.LOCKED]: '资源已锁定，请稍后重试',

  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后重试',

  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.BAD_GATEWAY]: '网关错误',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [ErrorCode.GATEWAY_TIMEOUT]: '网关超时',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
  [ErrorCode.DELETE_FAILED]: '删除操作失败',
  [ErrorCode.ENCRYPTION_ERROR]: '加密操作失败',
  [ErrorCode.DECRYPTION_ERROR]: '解密操作失败',
  [ErrorCode.NETWORK_ERROR]: '网络错误',
  [ErrorCode.TIMEOUT_ERROR]: '操作超时',

  [ErrorCode.UNKNOWN]: '未知错误',
};

// ============================================================================
// 错误严重级别
// ============================================================================

/**
 * 错误严重级别
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误码到严重级别的默认映射
 */
const DEFAULT_SEVERITY_MAP: Record<ErrorCode, ErrorSeverity> = {
  // 低严重性 - 客户端错误
  [ErrorCode.MISSING_API_KEY]: 'low',
  [ErrorCode.INVALID_API_KEY]: 'low',
  [ErrorCode.INACTIVE_API_KEY]: 'low',
  [ErrorCode.REVOKED_API_KEY]: 'low',
  [ErrorCode.EXPIRED_API_KEY]: 'low',
  [ErrorCode.AUTH_FAILED]: 'medium',
  [ErrorCode.AUTH_REQUIRED]: 'low',
  [ErrorCode.INVALID_ADMIN_KEY]: 'high', // 可能是攻击

  [ErrorCode.FORBIDDEN]: 'medium',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'medium',

  [ErrorCode.VALIDATION_ERROR]: 'low',
  [ErrorCode.INVALID_REQUEST]: 'low',
  [ErrorCode.INVALID_PARAMETER]: 'low',
  [ErrorCode.MISSING_PARAMETER]: 'low',
  [ErrorCode.INVALID_REASON]: 'low',
  [ErrorCode.INVALID_INPUT]: 'low',
  [ErrorCode.INVALID_CODE]: 'medium',

  [ErrorCode.NOT_FOUND]: 'low',
  [ErrorCode.CONFLICT]: 'low',
  [ErrorCode.ALREADY_EXISTS]: 'low',
  [ErrorCode.ALREADY_REVOKED]: 'low',
  [ErrorCode.REVOCATION_PENDING]: 'low',
  [ErrorCode.KEY_EXPIRED]: 'low',

  [ErrorCode.INVALID_STATE]: 'medium',
  [ErrorCode.LOCKED]: 'medium',

  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'medium',

  // 高严重性 - 服务器错误
  [ErrorCode.INTERNAL_ERROR]: 'high',
  [ErrorCode.BAD_GATEWAY]: 'high',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'high',
  [ErrorCode.GATEWAY_TIMEOUT]: 'high',
  [ErrorCode.DATABASE_ERROR]: 'high',
  [ErrorCode.DELETE_FAILED]: 'high',
  [ErrorCode.ENCRYPTION_ERROR]: 'critical',
  [ErrorCode.DECRYPTION_ERROR]: 'critical',
  [ErrorCode.NETWORK_ERROR]: 'medium',
  [ErrorCode.TIMEOUT_ERROR]: 'medium',

  [ErrorCode.UNKNOWN]: 'high',
};

// ============================================================================
// 请求上下文
// ============================================================================

/**
 * 请求上下文信息
 * 用于错误追踪和日志记录
 */
export interface RequestContext {
  /** 请求唯一标识符 */
  requestId: string;
  /** 请求路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** 客户端 IP */
  clientIP?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 用户 ID（如果已认证） */
  userId?: string;
  /** API 密钥 ID（如果使用 API 密钥认证） */
  apiKeyId?: string;
}

/**
 * 从 NextRequest 提取请求上下文
 */
export function extractRequestContext(request: NextRequest): RequestContext {
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    generateRequestId();

  const path = new URL(request.url).pathname;
  const method = request.method;
  const clientIP =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return {
    requestId,
    path,
    method,
    clientIP,
    userAgent,
  };
}

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID().substring(0, 8);
}

// ============================================================================
// 标准错误响应格式
// ============================================================================

/**
 * 标准错误响应格式
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    /** 错误码 */
    code: ErrorCode;
    /** 用户友好的错误消息 */
    message: string;
    /** 请求 ID，用于追踪 */
    requestId: string;
    /** 时间戳 */
    timestamp: string;
    /** 详细信息（可选，仅在开发环境或特定情况下返回） */
    details?: Record<string, unknown>;
  };
}

/**
 * 成功响应格式
 */
export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * API 响应类型
 */
export type ApiResponse<T = unknown> = StandardSuccessResponse<T> | StandardErrorResponse;

// ============================================================================
// 自定义错误类
// ============================================================================

/**
 * 基础应用错误类
 * 所有自定义错误的基类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly severity: ErrorSeverity;
  public readonly details?: Record<string, unknown>;
  public readonly originalError?: Error;
  public readonly requestId?: string;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      originalError?: Error;
      severity?: ErrorSeverity;
      requestId?: string;
    },
  ) {
    super(message || USER_FRIENDLY_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = HTTP_STATUS_MAP[code] || 500;
    this.severity = options?.severity || DEFAULT_SEVERITY_MAP[code];
    this.details = options?.details;
    this.originalError = options?.originalError;
    this.requestId = options?.requestId;
    this.timestamp = new Date();

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * 获取用户友好的消息
   */
  getUserMessage(): string {
    return USER_FRIENDLY_MESSAGES[this.code] || this.message;
  }

  /**
   * 转换为标准错误响应格式
   */
  toErrorResponse(requestId?: string): StandardErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.getUserMessage(),
        requestId: requestId || this.requestId || generateRequestId(),
        timestamp: this.timestamp.toISOString(),
        // 仅在非生产环境或特定错误码返回详细信息
        ...(this.shouldIncludeDetails() && this.details ? { details: this.details } : {}),
      },
    };
  }

  /**
   * 转换为 NextResponse
   */
  toNextResponse(requestId?: string): NextResponse {
    return NextResponse.json(this.toErrorResponse(requestId), { status: this.status });
  }

  /**
   * 判断是否应该包含详细信息
   */
  private shouldIncludeDetails(): boolean {
    // 生产环境不返回详细信息
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    // 特定错误码可以返回详细信息
    const safeDetailCodes = [
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.INVALID_PARAMETER,
      ErrorCode.MISSING_PARAMETER,
      ErrorCode.INVALID_INPUT,
    ];
    return safeDetailCodes.includes(this.code);
  }

  /**
   * 转换为日志格式
   */
  toLogFormat(context?: Partial<RequestContext>): Record<string, unknown> {
    return {
      errorCode: this.code,
      errorMessage: this.message,
      errorStatus: this.status,
      severity: this.severity,
      requestId: context?.requestId || this.requestId,
      path: context?.path,
      method: context?.method,
      clientIP: context?.clientIP,
      userId: context?.userId,
      apiKeyId: context?.apiKeyId,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends AppError {
  constructor(
    message?: string,
    options?: {
      code?: ErrorCode;
      details?: Record<string, unknown>;
      originalError?: Error;
      requestId?: string;
      severity?: ErrorSeverity;
    },
  ) {
    super(options?.code || ErrorCode.AUTH_FAILED, message, {
      ...options,
      severity: options?.severity || 'medium',
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends AppError {
  constructor(
    message?: string,
    options?: {
      code?: ErrorCode;
      details?: Record<string, unknown>;
      originalError?: Error;
      requestId?: string;
      severity?: ErrorSeverity;
    },
  ) {
    super(options?.code || ErrorCode.FORBIDDEN, message, {
      ...options,
      severity: options?.severity || 'medium',
    });
    this.name = 'AuthorizationError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(
    message?: string,
    options?: {
      code?: ErrorCode;
      details?: Record<string, unknown>;
      originalError?: Error;
      requestId?: string;
      severity?: ErrorSeverity;
    },
  ) {
    super(options?.code || ErrorCode.VALIDATION_ERROR, message, {
      ...options,
      severity: options?.severity || 'low',
    });
    this.name = 'ValidationError';
  }
}

/**
 * 资源错误（未找到、冲突等）
 */
export class ResourceError extends AppError {
  constructor(
    message?: string,
    options?: {
      code?: ErrorCode;
      details?: Record<string, unknown>;
      originalError?: Error;
      requestId?: string;
      severity?: ErrorSeverity;
    },
  ) {
    super(options?.code || ErrorCode.NOT_FOUND, message, {
      ...options,
      severity: options?.severity || 'low',
    });
    this.name = 'ResourceError';
  }
}

/**
 * 速率限制错误
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    retryAfter: number = 60,
    options?: {
      message?: string;
      details?: Record<string, unknown>;
      requestId?: string;
    },
  ) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, options?.message, {
      details: { retryAfter, ...options?.details },
      severity: 'medium',
      requestId: options?.requestId,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }

  /**
   * 转换为 NextResponse，包含 Retry-After 头
   */
  override toNextResponse(requestId?: string): NextResponse {
    const response = super.toNextResponse(requestId);
    response.headers.set('Retry-After', this.retryAfter.toString());
    response.headers.set(
      'X-RateLimit-Reset',
      Math.ceil(Date.now() / 1000 + this.retryAfter).toString(),
    );
    return response;
  }
}

/**
 * 服务器错误
 */
export class ServerError extends AppError {
  constructor(
    message?: string,
    options?: {
      code?: ErrorCode;
      details?: Record<string, unknown>;
      originalError?: Error;
      severity?: ErrorSeverity;
      requestId?: string;
    },
  ) {
    super(options?.code || ErrorCode.INTERNAL_ERROR, message, {
      ...options,
      severity: options?.severity || 'high',
    });
    this.name = 'ServerError';
  }
}

// ============================================================================
// 错误处理工具函数
// ============================================================================

/**
 * 错误处理配置
 */
export interface ErrorHandlerConfig {
  /** 是否记录错误日志 */
  logErrors?: boolean;
  /** 是否在生产环境隐藏详细错误消息 */
  hideDetailsInProduction?: boolean;
  /** 自定义日志函数 */
  logger?: (error: AppError, context?: Partial<RequestContext>) => void;
}

const defaultConfig: ErrorHandlerConfig = {
  logErrors: true,
  hideDetailsInProduction: true,
};

/**
 * 全局错误处理器
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 处理错误并返回标准响应
   */
  handle(error: unknown, context?: Partial<RequestContext>): NextResponse {
    const appError = this.normalizeError(error, context);

    // 记录错误日志
    if (this.config.logErrors) {
      this.logError(appError, context);
    }

    return appError.toNextResponse(context?.requestId);
  }

  /**
   * 将任意错误转换为 AppError
   */
  normalizeError(error: unknown, context?: Partial<RequestContext>): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      // 检查是否是数据库错误
      if (this.isDatabaseError(error)) {
        return new ServerError('数据库操作失败', {
          code: ErrorCode.DATABASE_ERROR,
          originalError: error,
          requestId: context?.requestId,
        });
      }

      // 检查是否是超时错误
      if (this.isTimeoutError(error)) {
        return new ServerError('操作超时', {
          code: ErrorCode.TIMEOUT_ERROR,
          originalError: error,
          requestId: context?.requestId,
        });
      }

      // 其他错误作为内部错误处理
      return new ServerError('服务器内部错误', {
        originalError: error,
        requestId: context?.requestId,
      });
    }

    // 未知错误类型
    return new AppError(ErrorCode.UNKNOWN, '未知错误', {
      requestId: context?.requestId,
    });
  }

  /**
   * 记录错误日志
   */
  private logError(error: AppError, context?: Partial<RequestContext>): void {
    if (this.config.logger) {
      this.config.logger(error, context);
      return;
    }

    const logData = error.toLogFormat(context);
    const logPrefix = `[${error.severity.toUpperCase()}]`;

    if (error.severity === 'critical' || error.severity === 'high') {
      console.error(logPrefix, JSON.stringify(logData, null, 2));
    } else {
      console.warn(logPrefix, JSON.stringify(logData));
    }
  }

  /**
   * 检查是否是数据库错误
   */
  private isDatabaseError(error: Error): boolean {
    const dbErrorPatterns = [
      'database',
      'connection',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'duplicate key',
      'foreign key',
      'relation',
      'column',
      'syntax error at or near',
    ];
    return dbErrorPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  /**
   * 检查是否是超时错误
   */
  private isTimeoutError(error: Error): boolean {
    const timeoutPatterns = ['ETIMEDOUT', 'timeout', 'timed out'];
    return timeoutPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }
}

// 创建全局错误处理器实例
export const errorHandler = new ErrorHandler();

// ============================================================================
// API 路由包装器
// ============================================================================

/**
 * API 路由处理器类型
 */
type ApiRouteHandler<T = unknown, P = Record<string, string>> = (
  request: NextRequest,
  context: { params: Promise<P> },
) => Promise<NextResponse<T>>;

/**
 * 包装 API 路由处理器，添加统一错误处理
 */
export function withErrorHandler<T = unknown, P = Record<string, string>>(
  handler: ApiRouteHandler<T, P>,
): ApiRouteHandler<T, P> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      const requestContext = extractRequestContext(request);
      return errorHandler.handle(error, requestContext) as NextResponse<T>;
    }
  };
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建成功响应
 */
export function successResponse<T>(
  data: T,
  message?: string,
  _requestId?: string,
): StandardSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

/**
 * 创建错误响应
 */
export function errorResponse(
  code: ErrorCode,
  message?: string,
  options?: {
    details?: Record<string, unknown>;
    requestId?: string;
  },
): StandardErrorResponse {
  const requestId = options?.requestId || generateRequestId();
  return {
    success: false,
    error: {
      code,
      message: message || USER_FRIENDLY_MESSAGES[code],
      requestId,
      timestamp: new Date().toISOString(),
      ...(options?.details && { details: options.details }),
    },
  };
}

/**
 * 快捷创建常见错误
 */
export const Errors = {
  missingApiKey: (requestId?: string) =>
    new AuthenticationError('API 密钥是必需的', {
      code: ErrorCode.MISSING_API_KEY,
      requestId,
    }),

  invalidApiKey: (requestId?: string) =>
    new AuthenticationError('无效的 API 密钥', {
      code: ErrorCode.INVALID_API_KEY,
      requestId,
    }),

  inactiveApiKey: (requestId?: string) =>
    new AuthenticationError('API 密钥已停用', {
      code: ErrorCode.INACTIVE_API_KEY,
      requestId,
    }),

  revokedApiKey: (requestId?: string) =>
    new AuthenticationError('API 密钥已被撤销', {
      code: ErrorCode.REVOKED_API_KEY,
      requestId,
    }),

  expiredApiKey: (requestId?: string) =>
    new AuthenticationError('API 密钥已过期', {
      code: ErrorCode.EXPIRED_API_KEY,
      requestId,
    }),

  forbidden: (message?: string, requestId?: string) =>
    new AuthorizationError(message, { requestId }),

  insufficientPermissions: (required?: string[], requestId?: string) =>
    new AuthorizationError('权限不足', {
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      details: required ? { required } : undefined,
      requestId,
    }),

  notFound: (resource?: string, requestId?: string) =>
    new ResourceError(resource ? `${resource} 不存在` : '请求的资源不存在', { requestId }),

  validationError: (message: string, details?: Record<string, unknown>, requestId?: string) =>
    new ValidationError(message, { details, requestId }),

  invalidParameter: (param: string, reason?: string, requestId?: string) =>
    new ValidationError(`无效的参数: ${param}`, {
      code: ErrorCode.INVALID_PARAMETER,
      details: { parameter: param, reason },
      requestId,
    }),

  missingParameter: (param: string, requestId?: string) =>
    new ValidationError(`缺少必需的参数: ${param}`, {
      code: ErrorCode.MISSING_PARAMETER,
      details: { parameter: param },
      requestId,
    }),

  conflict: (message: string, requestId?: string) =>
    new ResourceError(message, {
      code: ErrorCode.CONFLICT,
      requestId,
    }),

  rateLimited: (retryAfter: number = 60, requestId?: string) =>
    new RateLimitError(retryAfter, { requestId }),

  internal: (originalError?: Error, requestId?: string) =>
    new ServerError('服务器内部错误', {
      originalError,
      requestId,
    }),

  databaseError: (originalError?: Error, requestId?: string) =>
    new ServerError('数据库操作失败', {
      code: ErrorCode.DATABASE_ERROR,
      originalError,
      requestId,
    }),
};

/**
 * 检查错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return (
      error.status >= 500 ||
      error.code === ErrorCode.RATE_LIMIT_EXCEEDED ||
      error.code === ErrorCode.TIMEOUT_ERROR ||
      error.code === ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return true;
}

/**
 * 判断是否是客户端错误（4xx）
 */
export function isClientError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.status >= 400 && error.status < 500;
  }
  return false;
}

/**
 * 判断是否是服务器错误（5xx）
 */
export function isServerError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.status >= 500;
  }
  return false;
}
