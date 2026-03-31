// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DB_POOL_SIZE, DB_IDLE_TIMEOUT, DB_CONNECT_TIMEOUT } from '../lib/config/database.config';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabase() {
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

    db = drizzle(pool, { schema });
  }

  return db;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export function setDatabase(testDb: typeof db): void {
  db = testDb;
}
