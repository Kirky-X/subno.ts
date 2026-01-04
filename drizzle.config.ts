// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Parse DATABASE_URL to extract connection details
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/securenotify';
const url = new URL(databaseUrl);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading '/'
    ssl: false,
  },
  verbose: true,
  strict: true,
});
