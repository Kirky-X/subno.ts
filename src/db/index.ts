// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { drizzle } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;

export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = neon(connectionString);
    db = drizzle(sql, { schema });
  }

  return db;
}

export async function closeDatabase(): Promise<void> {
  db = null;
}

export function setDatabase(testDb: ReturnType<typeof drizzle>): void {
  db = testDb;
}
