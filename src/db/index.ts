// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import {
  DB_POOL_SIZE,
  DB_IDLE_TIMEOUT,
  DB_CONNECT_TIMEOUT,
} from '../lib/config/database.config';

let pool: Pool | null = null;
let db: NeonDatabase<typeof schema> | null = null;

/**
 * Get the database instance, creating it if necessary.
 */
export function getDatabase(): NeonDatabase<typeof schema> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      max: DB_POOL_SIZE,
      idleTimeoutMillis: DB_IDLE_TIMEOUT,
      connectionTimeoutMillis: DB_CONNECT_TIMEOUT,
    });

    db = drizzle(pool, { schema }) as unknown as NeonDatabase<typeof schema>;
  }

  return db;
}

/**
 * Close the database connection properly.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

/**
 * Set database instance (for testing purposes only)
 */
export function setDatabase(testDb: typeof db): void {
  db = testDb;
}
