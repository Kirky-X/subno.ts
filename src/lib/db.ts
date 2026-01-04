// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

const isVercel = process.env.VERCEL === '1';

export function getDb() {
  if (isVercel) {
    // Vercel environment uses @vercel/postgres
    // Cast sql to unknown first to bypass strict type checking
    return drizzle(sql as unknown as string, { schema });
  } else {
    // Local development using postgres.js
    const client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return drizzle(client, { schema });
  }
}

// Export db for backward compatibility
export const db = getDb();
export { schema };