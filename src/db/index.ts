// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getPoolSize, getIdleTimeout, getConnectTimeout } from '../lib/config';

// Database connection singleton
let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    client = postgres(connectionString, {
      max: getPoolSize(),
      idle_timeout: getIdleTimeout() / 1000, // Convert ms to seconds
      connect_timeout: getConnectTimeout() / 1000, // Convert ms to seconds
    });

    db = drizzle(client, { schema });
  }

  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

// For testing purposes
export function setDatabase(testDb: ReturnType<typeof drizzle>): void {
  db = testDb;
}
