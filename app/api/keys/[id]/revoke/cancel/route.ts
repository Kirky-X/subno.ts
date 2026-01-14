// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService, auditService, apiKeyRepository } from '@/src/lib/services';

// POST /api/keys/:id/revoke/cancel - Cancel pending revocation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: revocationId } = await params;
    const apiKey = request.headers.get('X-API-Key');
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'API key required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
        },
      }, { status: 401 });
    }

    // Validate API key has permission to cancel
    const hasPermission = await apiKeyRepository.validatePermission(apiKey, 'key_revoke');
    if (!hasPermission) {
      await auditService.log({
        action: 'cancel_revocation_unauthorized',
        ip: clientIP,
        success: false,
        metadata: { revocationId, reason: 'Insufficient permissions' },
      });
      return NextResponse.json({
        success: false,
        error: {
          message: 'Insufficient permissions for key revocation',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        },
      }, { status: 403 });
    }

    const result = await keyRevocationService.cancelRevocation(revocationId, apiKey);

    if (!result.success) {
      const statusCodes: Record<string, number> = {
        NOT_FOUND: 404,
        INVALID_STATE: 400,
      };

      return NextResponse.json({
        success: false,
        error: {
          message: result.error || 'Failed to cancel revocation',
          code: result.code || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString(),
        },
      }, { status: statusCodes[result.code || ''] || 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Revocation cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling revocation:', error);
    return NextResponse.json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}
