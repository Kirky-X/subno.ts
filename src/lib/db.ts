// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { sql } from '@vercel/postgres';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleVercel } from 'drizzle-orm/vercel-postgres';
import pg from 'pg';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

const isVercel = process.env.VERCEL === '1';

// Singleton connection for local development
let pool: pg.Pool | null = null;

export function getDb() {
  if (isVercel) {
    // Vercel environment uses @vercel/postgres
    return drizzleVercel(sql, { schema });
  } else {
    // Local development using pg - reuse connection
    if (!pool) {
      pool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 10000,
      });
    }
    return drizzleNode(pool, { schema });
  }
}

// Export db for backward compatibility
export const db = getDb();
export { schema };

/**
 * Gracefully close database connection
 * Important for cleanup and preventing connection leaks
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

/**
 * Handle process termination
 */
if (typeof process !== 'undefined' && !isVercel) {
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing database connection...`);
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}