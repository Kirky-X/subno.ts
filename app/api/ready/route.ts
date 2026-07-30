// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/db';
import { getRedisClient } from '@/src/lib/utils/redis-client';

/**
 * Readiness probe — 检查依赖（DB/Redis）是否就绪。
 * 任一依赖不可用返回 503，所有依赖就绪返回 200。
 * 用于 K8s readinessProbe / 负载均衡流量切换。
 *
 * 检查项：
 * - 数据库：执行 SELECT 1 验证连接
 * - Redis：若配置了 REDIS_URL 则 ping 验证，未配置则跳过（允许无 Redis 部署）
 */
export async function GET(): Promise<NextResponse> {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};
  let allReady = true;

  // 数据库检查
  try {
    const start = Date.now();
    const db = getDatabase();
    await db.execute('SELECT 1');
    checks.database = { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    allReady = false;
    // 生产环境不暴露内部错误详情（可能含连接字符串/SQL 状态码）
    checks.database = { status: 'error', error: 'database unavailable' };
  }

  // Redis 检查（可选 — 未配置 REDIS_URL 时跳过）
  if (process.env.REDIS_URL) {
    try {
      const start = Date.now();
      const client = await getRedisClient();
      if (client) {
        await client.ping();
        checks.redis = { status: 'ok', latencyMs: Date.now() - start };
      } else {
        checks.redis = { status: 'error', error: 'redis client unavailable' };
        allReady = false;
      }
    } catch {
      allReady = false;
      checks.redis = { status: 'error', error: 'redis unavailable' };
    }
  }

  return NextResponse.json(
    {
      status: allReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allReady ? 200 : 503 },
  );
}
