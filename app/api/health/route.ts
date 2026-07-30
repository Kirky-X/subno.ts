// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextResponse } from 'next/server';

/**
 * Liveness probe — 进程存活即返回 200。
 * 不检查依赖（DB/Redis），避免因依赖抖动导致重启。
 * 用于 K8s livenessProbe / Vercel 健康检查。
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 },
  );
}
