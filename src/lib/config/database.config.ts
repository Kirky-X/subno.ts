// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { parseEnvInt } from '../utils/env.utils';

// Pool size: 1-100 connections
export const DB_POOL_SIZE = parseEnvInt('DB_POOL_SIZE', 10, 1, 100);

// Idle timeout: 1000-300000 ms (1 second to 5 minutes)
export const DB_IDLE_TIMEOUT = parseEnvInt('DB_IDLE_TIMEOUT', 20000, 1000, 300000);

// Connect timeout: 1000-60000 ms (1 second to 1 minute)
export const DB_CONNECT_TIMEOUT = parseEnvInt('DB_CONNECT_TIMEOUT', 10000, 1000, 60000);

export const DB_CONFIG = {
  pool: {
    max: DB_POOL_SIZE,
    idleTimeout: DB_IDLE_TIMEOUT,
    connectTimeout: DB_CONNECT_TIMEOUT,
  },
} as const;

export function getDbPoolConfig() {
  return DB_CONFIG.pool;
}

export function getPoolSize(): number {
  return DB_POOL_SIZE;
}

export function getIdleTimeout(): number {
  return DB_IDLE_TIMEOUT;
}

export function getConnectTimeout(): number {
  return DB_CONNECT_TIMEOUT;
}
