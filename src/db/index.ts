// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { NeonClient } from 'drizzle-orm/neon-serverless';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

export function getDatabase(): any {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = neon(connectionString) as unknown as NeonClient;
    db = drizzle(sql, { schema });
  }

  return db;
}

export async function closeDatabase(): Promise<void> {
  db = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setDatabase(testDb: any): void {
  db = testDb;
}
