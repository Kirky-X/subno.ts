// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'securenotify',
    ssl: false,
  },
  // Connection pool configuration for optimal performance
  pool: {
    min: 2,                  // Minimum connections in pool
    max: 20,                 // Maximum connections in pool (adjusted based on workload)
    idleTimeoutMillis: 30000,   // Idle connections timeout after 30s
    connectionTimeoutMillis: 2000, // Connection establishment timeout
  },
  verbose: true,
  strict: true,
});
