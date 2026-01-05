// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

// Singleton connection
let pool: pg.Pool | null = null;

export function getDb() {
  // Always use node-postgres for consistency
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
if (typeof process !== 'undefined') {
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing database connection...`);
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}