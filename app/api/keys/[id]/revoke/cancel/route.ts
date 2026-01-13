// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService } from '../../../../src/lib/services';

// POST /api/keys/:id/revoke/cancel - Cancel pending revocation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: revocationId } = await params;
    const apiKey = request.headers.get('X-API-Key');
    
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
        message: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}
