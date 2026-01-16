// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// Database instance holder
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

    // drizzle with neon-serverless expects connection string
    // Using type assertion to handle generic type mismatch
    db = drizzle(connectionString, { schema }) as unknown as NeonDatabase<typeof schema>;
  }

  return db;
}

/**
 * Close the database connection properly.
 */
export async function closeDatabase(): Promise<void> {
  db = null;
}

/**
 * Set database instance (for testing purposes only)
 */
export function setDatabase(testDb: typeof db): void {
  db = testDb;
}
