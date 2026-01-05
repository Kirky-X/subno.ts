// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from '@/lib/db';

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    const db = getDb();
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations().then(() => process.exit(0));
