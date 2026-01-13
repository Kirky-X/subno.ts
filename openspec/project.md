# Project Context

## Purpose
**subno.ts** (brand name: SecureNotify) is an encrypted push notification service focused on public key storage and message distribution. It provides end-to-end encrypted communication, real-time message push, and key management capabilities using Next.js 16 + TypeScript.

**Core Features:**
- Public key registration and management with support for multiple encryption algorithms (RSA-2048, RSA-4096, ECC-SECP256K1)
- Channel management (public, encrypted, and temporary channels)
- Real-time message push based on Server-Sent Events (SSE)
- End-to-end message encryption
- Security controls (API key authentication, rate limiting, audit logging)
- Message priority queues (CRITICAL/HIGH/NORMAL/LOW/BULK)

## Tech Stack
- **Runtime:** Node.js >=20.9.0
- **Framework:** Next.js ^16.1.1 with App Router
- **Language:** TypeScript ^5.x (strict mode)
- **Database:** PostgreSQL 14+ (persistence)
- **Cache/Message Queue:** Redis 7+ (caching, pub/sub, priority queues)
- **ORM:** Drizzle ORM ^0.45.1
- **Validation:** Zod ^3.24.1 (runtime validation)
- **Testing:** Vitest ^4.0.16
- **Deployment:** Vercel ^50.1.3

## Project Conventions

### Code Style
- **Language:** TypeScript with strict mode enabled
- **Formatting:** Follow ESLint configuration
- **License Headers:** All source files must include Apache 2.0 license header:
  ```typescript
  // SPDX-License-Identifier: Apache-2.0
  // Copyright (c) 2026 KirkyX. All rights reserved.
  ```
- **Naming:** camelCase for variables/functions, PascalCase for classes/types
- **Validation:** All inputs must be validated using Zod schemas

### Architecture Patterns

**Layered Architecture:**
- **API Layer** (`app/api/`): HTTP request/response handling
- **Business Logic Layer** (`src/lib/services/`): Core business logic implementation
- **Data Access Layer** (`src/lib/repositories/`): Database and cache operations

**Modular Encryption Services:**
- **RSA Service** (`encryption/rsa.service.ts`): RSA key generation, encryption, decryption, signing, verification
- **AES Service** (`encryption/aes.service.ts`): AES-256-GCM symmetric encryption
- **Hybrid Service** (`encryption/hybrid.service.ts`): RSA + AES combination for large messages
- **Key Cache Service** (`encryption/key-cache.service.ts`): Public key caching using Cache-Aside pattern

**Type Safety:**
- All functions must use TypeScript type annotations
- Runtime validation with Zod
- Database schema types auto-inferred via Drizzle

**Error Handling:**
- Unified error response format
- Error logging and audit information
- Clear error messages and error codes

**Security-First:**
- All input validation with Zod
- API key authentication for sensitive operations
- Rate limiting to prevent abuse
- Comprehensive audit logging

### Testing Strategy
- **Unit Tests:** Test individual functions/classes (`__tests__/unit/`)
- **Integration Tests:** Test API endpoints (`__tests__/integration/`)
- **End-to-End Tests:** Test complete user flows (`__tests__/e2e/`)
- **Performance Tests:** API load testing (`__tests__/performance/`)
- **Target Coverage:** >80% test coverage
- **Test Framework:** Vitest with watch mode

### Git Workflow
- **Pre-commit Hooks:** Husky + lint-staged for automated checks
  - Automatic license header addition
  - ESLint checks
- **Branching:** Feature-based branching
- **Commit Messages:** Follow conventional commit format (implied by lint-staged setup)

## Domain Context

**Encryption Algorithms:**
- RSA-2048/RSA-4096 for asymmetric encryption
- ECC-SECP256K1 for elliptic curve cryptography
- AES-256-GCM for symmetric encryption
- Hybrid encryption for large messages (>190 bytes for RSA-2048)

**Channel Types:**
- **Public Channels:** No encryption, accessible to all subscribers
- **Encrypted Channels:** Require public key registration, end-to-end encryption
- **Temporary Channels:** Auto-expiring channels (default 30 minutes TTL)

**Message Priority:**
- CRITICAL (100): Highest priority, immediate delivery
- HIGH (75): High priority messages
- NORMAL (50): Default priority
- LOW (25): Low priority
- BULK (0): Batch messages, lowest priority

**Key Management:**
- Public keys stored in PostgreSQL with expiration
- Redis caching for frequently accessed keys (7-day TTL)
- API keys for authentication with permissions and expiration
- Automatic cleanup of expired keys

**Data Storage Strategy:**
- PostgreSQL: Core persistent data (public keys, channels, messages, API keys, audit logs)
- Redis: High-frequency access data (message queues, pub/sub, caching)
- Vercel KV: Optional edge caching

## Important Constraints

**Security Constraints:**
- Maximum message size: 4.5MB (4718592 bytes)
- Maximum public key size: 4KB (4096 bytes)
- Maximum channel metadata size: 2048 bytes
- All sensitive operations require API key authentication
- Rate limits: 5-10 requests per minute depending on endpoint

**Message Constraints:**
- Public messages: Default TTL 12 hours, max 1000 messages per channel
- Private messages: Default TTL 24 hours, max 100 messages per channel
- Message cleanup: Maximum retention 12 hours

**Key Constraints:**
- Default key expiry: 7 days
- Maximum key expiry: 30 days
- Public key cache TTL: 7 days

**Channel Constraints:**
- Temporary channel TTL: 30 minutes (default)
- Persistent channel default TTL: 24 hours
- Persistent channel max TTL: 7 days
- Channel cleanup interval: 5 minutes

**Production Requirements:**
- `ADMIN_MASTER_KEY` must be set
- `CRON_SECRET` must be set
- Audit logging must be enabled
- HTTPS required

## External Dependencies

**Database:**
- PostgreSQL 14+ (primary persistence)
- Schema: `subno` (custom schema for all tables)

**Cache & Messaging:**
- Redis 7+ (caching, pub/sub, priority queues)

**Cloud Services:**
- Vercel (deployment, edge functions)
- Vercel KV (optional edge caching)

**Monitoring:**
- Log levels: debug/info/warn/error
- Audit log retention: 90 days

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `ADMIN_MASTER_KEY`: Admin master key (production required)
- `CRON_SECRET`: Cron task secret (production required)
- Optional: Message TTLs, rate limits, encryption parameters
