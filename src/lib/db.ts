// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

const isVercel = process.env.VERCEL === '1';

// Singleton connection for local development
let postgresClient: Sql | null = null;

export function getDb() {
  if (isVercel) {
    // Vercel environment uses @vercel/postgres
    // Cast sql to unknown first to bypass strict type checking
    return drizzle(sql as unknown as string, { schema });
  } else {
    // Local development using postgres.js - reuse connection
    if (!postgresClient) {
      postgresClient = postgres(env.DATABASE_URL, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
    }
    return drizzle(postgresClient, { schema });
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
  if (postgresClient) {
    try {
      await postgresClient.end();
      postgresClient = null;
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