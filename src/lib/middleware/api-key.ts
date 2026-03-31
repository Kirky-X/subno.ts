// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { apiKeyRepository } from '../repositories';
import { createHash } from 'crypto';
import {
  ErrorCode,
  AuthenticationError,
  AuthorizationError,
  extractRequestContext,
} from '../utils/error-handler';
import { apiKeyCache } from '../utils/cache';
import {
  ApiKeyPermission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../enums/permission.enums';

/**
 * API Key validation configuration constants
 */
export const API_KEY_CONFIG = {
  /** Minimum API key length (increased to 32 for better security) */
  MIN_LENGTH: 32,
  /** Maximum API key length to prevent DoS attacks */
  MAX_LENGTH: 128,
  /** Regex pattern for valid API key characters (alphanumeric and hyphens) */
  VALID_PATTERN: /^[a-zA-Z0-9-]+$/,
} as const;

/**
 * Extended request type with API key info
 */
interface RequestWithApiKey extends NextRequest {
  apiKey?: {
    id: string;
    userId: string;
    permissions: string[];
  };
}

/**
 * API Key validation result
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  keyId?: string;
  userId?: string;
  permissions?: string[];
  error?: string;
  code?: ErrorCode;
}

/**
 * Validate API key format
 * SECURITY: Ensures API key meets minimum security requirements
 */
function validateApiKeyFormat(apiKey: string): {
  valid: boolean;
  error?: string;
  code?: ErrorCode;
} {
  // Check minimum length
  if (apiKey.length < API_KEY_CONFIG.MIN_LENGTH) {
    return {
      valid: false,
      error: `API key must be at least ${API_KEY_CONFIG.MIN_LENGTH} characters`,
      code: ErrorCode.INVALID_API_KEY,
    };
  }

  // Check maximum length to prevent DoS attacks
  if (apiKey.length > API_KEY_CONFIG.MAX_LENGTH) {
    return {
      valid: false,
      error: 'API key is too long',
      code: ErrorCode.INVALID_API_KEY,
    };
  }

  // Validate character set (alphanumeric and hyphens only)
  if (!API_KEY_CONFIG.VALID_PATTERN.test(apiKey)) {
    return {
      valid: false,
      error: 'API key contains invalid characters',
      code: ErrorCode.INVALID_API_KEY,
    };
  }

  return { valid: true };
}

/**
 * Hash API key using SHA-256 for secure storage and lookup.
 * This prevents plaintext API keys from being logged or exposed.
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate API key from request headers
 * SECURITY: Uses hashed key lookup to prevent plaintext exposure
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyValidationResult> {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) {
    return {
      valid: false,
      error: 'API key is required',
      code: ErrorCode.MISSING_API_KEY,
    };
  }

  // Validate API key format (length and character set)
  const formatValidation = validateApiKeyFormat(apiKey);
  if (!formatValidation.valid) {
    return {
      valid: false,
      error: formatValidation.error,
      code: formatValidation.code,
    };
  }

  try {
    // Hash the provided API key for lookup
    // This ensures plaintext keys are never logged or stored
    const keyHash = hashApiKey(apiKey);

    // Check cache first for better performance
    const cached = apiKeyCache.get(keyHash);
    if (cached) {
      if (!cached.isValid) {
        return {
          valid: false,
          error: 'Invalid or expired API key',
          code: ErrorCode.INVALID_API_KEY,
        };
      }
      return {
        valid: true,
        keyId: cached.userId.split(':')[0], // Extract keyId from cache format
        userId: cached.userId,
        permissions: cached.permissions,
      };
    }

    // Cache miss - query database
    const key = await apiKeyRepository.findByKeyHash(keyHash);

    if (!key) {
      // Cache negative result for 1 minute to prevent brute force
      apiKeyCache.set(keyHash, { userId: '', permissions: [], isValid: false }, 60 * 1000);
      return {
        valid: false,
        error: 'Invalid API key',
        code: ErrorCode.INVALID_API_KEY,
      };
    }

    // Verify key is active
    if (!key.isActive) {
      apiKeyCache.set(keyHash, { userId: '', permissions: [], isValid: false }, 60 * 1000);
      return {
        valid: false,
        error: 'API key is inactive',
        code: ErrorCode.INACTIVE_API_KEY,
      };
    }

    // Verify key has not been revoked
    if (key.isDeleted) {
      apiKeyCache.set(keyHash, { userId: '', permissions: [], isValid: false }, 60 * 1000);
      return {
        valid: false,
        error: 'API key has been revoked',
        code: ErrorCode.REVOKED_API_KEY,
      };
    }

    // Verify key has not expired
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      apiKeyCache.set(keyHash, { userId: '', permissions: [], isValid: false }, 60 * 1000);
      return {
        valid: false,
        error: 'API key has expired',
        code: ErrorCode.EXPIRED_API_KEY,
      };
    }

    // Cache positive result for 5 minutes
    const cacheData = {
      userId: key.userId,
      permissions: key.permissions as string[],
      isValid: true,
    };
    apiKeyCache.set(keyHash, cacheData, 5 * 60 * 1000);

    return {
      valid: true,
      keyId: key.id,
      userId: key.userId,
      permissions: key.permissions as string[],
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate API key',
      code: ErrorCode.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a middleware-compatible API key validator
 */
export function createApiKeyValidator(requiredPermissions?: string[]) {
  return async function validate(request: NextRequest): Promise<NextResponse | null> {
    const context = extractRequestContext(request);
    const result = await validateApiKey(request);

    if (!result.valid) {
      const error = new AuthenticationError(result.error || '认证失败', {
        code: result.code || ErrorCode.AUTH_FAILED,
        requestId: context.requestId,
      });
      return error.toNextResponse(context.requestId);
    }

    // Check required permissions using enum-based validation
    if (requiredPermissions && requiredPermissions.length > 0) {
      const keyPermissions = result.permissions || [];

      // Convert string permissions to enum and check
      const hasPermissionCheck = hasAllPermissions(
        keyPermissions as ApiKeyPermission[],
        requiredPermissions as ApiKeyPermission[],
      );

      if (!hasPermissionCheck) {
        const error = new AuthorizationError('权限不足', {
          code: ErrorCode.INSUFFICIENT_PERMISSIONS,
          details: { required: requiredPermissions },
          requestId: context.requestId,
        });
        return error.toNextResponse(context.requestId);
      }
    }

    // Attach validated key info to request for downstream use
    const reqWithKey = request as RequestWithApiKey;
    reqWithKey.apiKey = {
      id: result.keyId!,
      userId: result.userId!,
      permissions: result.permissions || [],
    };

    return null;
  };
}

/**
 * Require API key middleware
 * Use this to protect API routes that require authentication
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authError = await requireApiKey(request);
 *   if (authError) return authError;
 *   // ... your handler code
 * }
 * ```
 */
export async function requireApiKey(request: NextRequest): Promise<NextResponse | null> {
  return createApiKeyValidator()(request);
}

/**
 * Require API key with specific permissions
 *
 * @param permissions - Array of required ApiKeyPermission enum values
 * @example
 * ```typescript
 * const authError = await requireApiKeyWithPermissions(request, [ApiKeyPermission.WRITE, ApiKeyPermission.REVOKE]);
 * ```
 */
export async function requireApiKeyWithPermissions(
  request: NextRequest,
  permissions: ApiKeyPermission[],
): Promise<NextResponse | null> {
  return createApiKeyValidator(permissions as unknown as string[])(request);
}

/**
 * Get API key info from request
 * Returns the validated API key information without returning an error response
 *
 * @param request - The Next.js request object
 * @returns API key info if valid, null otherwise
 */
export async function getApiKeyInfo(request: NextRequest): Promise<{
  keyId: string;
  userId: string;
  permissions: string[];
} | null> {
  const result = await validateApiKey(request);

  if (!result.valid) {
    return null;
  }

  return {
    keyId: result.keyId!,
    userId: result.userId!,
    permissions: result.permissions || [],
  };
}
