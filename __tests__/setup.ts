// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Vitest setup file - sets test environment variables before any tests run.
 * Many modules transitively import env validation / database which requires these vars.
 */

process.env.SKIP_ENV_VALIDATION = '1';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?sslmode=disable';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ADMIN_MASTER_KEY = 'test-admin-master-key-32chars-min!!';
process.env.CRON_SECRET = 'test-cron-secret-32-chars-minimum!!';
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
