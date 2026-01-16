// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { apiKeyRepository } from '../repositories';
import { createHash } from 'crypto';

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
  code?: string;
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
      code: 'MISSING_API_KEY',
    };
  }

  if (apiKey.length < 16) {
    return {
      valid: false,
      error: 'Invalid API key format',
      code: 'INVALID_API_KEY',
    };
  }

  try {
    // Hash the provided API key for lookup
    // This ensures plaintext keys are never logged or stored
    const keyHash = hashApiKey(apiKey);
    const key = await apiKeyRepository.findByKeyHash(keyHash);
    
    if (!key) {
      return {
        valid: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      };
    }

    // Verify key is active
    if (!key.isActive) {
      return {
        valid: false,
        error: 'API key is inactive',
        code: 'INACTIVE_API_KEY',
      };
    }

    // Verify key has not been revoked
    if (key.isDeleted) {
      return {
        valid: false,
        error: 'API key has been revoked',
        code: 'REVOKED_API_KEY',
      };
    }

    // Verify key has not expired
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return {
        valid: false,
        error: 'API key has expired',
        code: 'EXPIRED_API_KEY',
      };
    }

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
      code: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Create a middleware-compatible API key validator
 */
export function createApiKeyValidator(requiredPermissions?: string[]) {
  return async function validate(request: NextRequest): Promise<NextResponse | null> {
    const result = await validateApiKey(request);
    
    if (!result.valid) {
      return NextResponse.json({
        success: false,
        error: {
          message: result.error || 'Authentication failed',
          code: result.code || 'AUTH_ERROR',
        },
      }, { status: 401 });
    }

    // Check required permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const keyPermissions = result.permissions || [];
      const hasAllPermissions = requiredPermissions.every(
        permission => keyPermissions.includes(permission)
      );
      
      if (!hasAllPermissions) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'FORBIDDEN',
            required: requiredPermissions,
          },
        }, { status: 403 });
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
 * @param permissions - Array of required permission strings
 * @example
 * ```typescript
 * const authError = await requireApiKeyWithPermissions(request, ['write', 'key_revoke']);
 * ```
 */
export async function requireApiKeyWithPermissions(
  request: NextRequest,
  permissions: string[]
): Promise<NextResponse | null> {
  return createApiKeyValidator(permissions)(request);
}
