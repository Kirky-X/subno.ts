// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

export function getDatabase(): any {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = neon(connectionString);
    // Use type assertion to work around drizzle-orm type incompatibility
    db = drizzle(sql as unknown as string, { schema });
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
