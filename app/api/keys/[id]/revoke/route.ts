// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService } from '../../../../src/lib/services';

// POST /api/keys/:id/revoke - Request key revocation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: keyId } = await params;
    const body = await request.json();
    
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

    // TODO: Validate API key has admin permission
    // For now, we'll assume the API key validation is done in middleware

    const result = await keyRevocationService.requestRevocation({
      keyId,
      apiKeyId: apiKey,
      reason: body.reason,
      confirmationHours: body.confirmationHours,
    });

    if (!result.success) {
      const statusCodes: Record<string, number> = {
        NOT_FOUND: 404,
        ALREADY_REVOKED: 409,
        INVALID_REASON: 400,
        REVOCATION_PENDING: 409,
      };

      return NextResponse.json({
        success: false,
        error: {
          message: result.error || 'Failed to request revocation',
          code: result.code || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString(),
        },
      }, { status: statusCodes[result.code || ''] || 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        revocationId: result.revocationId,
        keyId,
        status: 'pending',
        expiresAt: result.expiresAt,
        confirmationCodeSent: true,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error requesting key revocation:', error);
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

// GET /api/keys/:id/revoke/status - Get revocation status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: revocationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const keyId = searchParams.get('keyId');

    let result;
    
    if (keyId) {
      result = await keyRevocationService.getPendingRevocationByKeyId(keyId);
    } else {
      result = await keyRevocationService.getRevocationStatus(revocationId);
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: {
          message: result.error || 'Failed to get revocation status',
          code: result.code || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString(),
        },
      }, { status: result.code === 'NOT_FOUND' ? 404 : 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: result.status,
        keyId: result.keyId,
        channelId: result.channelId,
        revokedAt: result.revokedAt,
        revokedBy: result.revokedBy,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error getting revocation status:', error);
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
