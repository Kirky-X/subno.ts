#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  connect_timeout: 10,
});

async function migrate() {
  console.log('Starting database migration for key revocation security...');

  try {
    // 1. Add soft delete columns to public_keys
    console.log('Adding soft delete columns to public_keys...');
    await sql`
      ALTER TABLE public_keys
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS revoked_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
    `;
    console.log('✓ public_keys columns added');

    // 2. Add soft delete columns to api_keys
    console.log('Adding soft delete columns to api_keys...');
    await sql`
      ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS revoked_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
    `;
    console.log('✓ api_keys columns added');

    // 3. Create revocation_confirmations table
    console.log('Creating revocation_confirmations table...');
    await sql`
      CREATE TABLE IF NOT EXISTS revocation_confirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_id UUID REFERENCES public_keys(id) ON DELETE CASCADE,
        api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
        confirmation_code_hash VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reason TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMP,
        confirmed_by VARCHAR(255)
      );
    `;
    console.log('✓ revocation_confirmations table created');

    // 4. Create notification_history table
    console.log('Creating notification_history table...');
    await sql`
      CREATE TABLE IF NOT EXISTS notification_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_id UUID REFERENCES public_keys(id) ON DELETE CASCADE,
        channel_id VARCHAR(64),
        notification_type VARCHAR(50) NOT NULL,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        delivery_status VARCHAR(20),
        error_details JSONB,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    console.log('✓ notification_history table created');

    // 5. Create indexes for performance
    console.log('Creating indexes...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_revocations_status ON revocation_confirmations(status);
      CREATE INDEX IF NOT EXISTS idx_revocations_expires ON revocation_confirmations(expires_at);
      CREATE INDEX IF NOT EXISTS idx_revocations_key_id ON revocation_confirmations(key_id);
      CREATE INDEX IF NOT EXISTS idx_public_keys_deleted ON public_keys(is_deleted, revoked_at);
      CREATE INDEX IF NOT EXISTS idx_api_keys_deleted ON api_keys(is_deleted, revoked_at);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
    `;
    console.log('✓ Indexes created');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nMigration Summary:');
    console.log('  - Added soft delete columns to public_keys');
    console.log('  - Added soft delete columns to api_keys');
    console.log('  - Created revocation_confirmations table');
    console.log('  - Created notification_history table');
    console.log('  - Created performance indexes');
    console.log('\nYou can now start using the key revocation features.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

async function rollback() {
  console.log('Rolling back migration...');

  try {
    // Drop tables
    await sql`DROP TABLE IF EXISTS notification_history CASCADE;`;
    await sql`DROP TABLE IF EXISTS revocation_confirmations CASCADE;`;

    // Remove columns (Note: In PostgreSQL, you can't easily remove columns in a single statement)
    // For production, you may want to create a new table without these columns
    console.log('Note: Column removal requires manual SQL operations.');
    console.log('To remove columns, use:');
    console.log('  ALTER TABLE public_keys DROP COLUMN IF EXISTS is_deleted;');
    console.log('  ALTER TABLE public_keys DROP COLUMN IF EXISTS revoked_at;');
    console.log('  ALTER TABLE public_keys DROP COLUMN IF EXISTS revoked_by;');
    console.log('  ALTER TABLE public_keys DROP COLUMN IF EXISTS revocation_reason;');
    console.log('  (same for api_keys table)');

    console.log('\n✅ Rollback completed (tables dropped, columns need manual removal)');
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// CLI interface
const command = process.argv[2];

if (command === 'rollback') {
  rollback();
} else {
  migrate();
}
