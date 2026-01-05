// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

/// <reference types="vitest/globals" />

// Set default test environment variables
process.env.VERCEL = undefined; // Force disable Vercel mode for tests
process.env.DATABASE_URL = 'postgresql://securenotify:securenotify_password@localhost:5435/securenotify';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.PUBLIC_MESSAGE_TTL = '43200';
process.env.PRIVATE_MESSAGE_TTL = '86400';
process.env.PUBLIC_MESSAGE_MAX_COUNT = '1000';
process.env.PRIVATE_MESSAGE_MAX_COUNT = '100';
process.env.MAX_MESSAGE_SIZE = '4718592';
process.env.RATE_LIMIT_PUBLISH = '10';
process.env.RATE_LIMIT_REGISTER = '5';
process.env.RATE_LIMIT_SUBSCRIBE = '5';
process.env.KEY_EXPIRY_DEFAULT = '604800';
process.env.KEY_EXPIRY_MAX = '2592000';
process.env.LOG_LEVEL = 'debug';
process.env.ENABLE_AUDIT_LOG = 'true';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.AUTO_CREATE_CHANNELS_ENABLED = 'true';
process.env.TEMPORARY_CHANNEL_TTL = '1800';
