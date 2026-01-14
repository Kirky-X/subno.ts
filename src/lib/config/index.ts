// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

// Rate limit configuration
export { 
  RATE_LIMIT_CONFIG, 
  getRateLimitConfig, 
  getRateLimitWindowMs,
  getCleanupIntervalMs,
} from './rate-limit.config';

// Database configuration
export { 
  DB_CONFIG,
  DB_POOL_SIZE,
  DB_IDLE_TIMEOUT,
  DB_CONNECT_TIMEOUT,
  getDbPoolConfig,
  getPoolSize,
  getIdleTimeout,
  getConnectTimeout,
} from './database.config';

// Security configuration (PBKDF2, hashing, encryption)
export {
  SECURITY_CONFIG as SECURITY_PBKDF2_CONFIG,
  getSecurityConfig,
} from './security.config';
