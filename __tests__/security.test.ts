// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Security Implementation Files', () => {
  describe('Rate Limiting Middleware', () => {
    it('should have rate-limit.ts file', () => {
      const filePath = path.join(process.cwd(), 'src/lib/middleware/rate-limit.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('rateLimit');
      expect(content).toContain('RateLimitStore');
      expect(content).toContain('X-RateLimit-Limit');
      expect(content).toContain('X-RateLimit-Remaining');
    });

    it('should have middleware index file', () => {
      const filePath = path.join(process.cwd(), 'src/lib/middleware/index.ts');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Global Middleware', () => {
    it('should have app/middleware.ts file', () => {
      const filePath = path.join(process.cwd(), 'app/middleware.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('rateLimit');
      expect(content).toContain('X-RateLimit');
      expect(content).toContain('/api/:path*');
    });
  });

  describe('Security Headers', () => {
    it('should have security headers in next.config.ts', () => {
      const filePath = path.join(process.cwd(), 'next.config.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('Strict-Transport-Security');
      expect(content).toContain('X-Frame-Options');
      expect(content).toContain('X-Content-Type-Options');
      expect(content).toContain('Content-Security-Policy');
      expect(content).toContain('X-XSS-Protection');
      expect(content).toContain('Referrer-Policy');
      expect(content).toContain('Permissions-Policy');
    });
  });

  describe('Cancel Route Permission Validation', () => {
    it('should have FORBIDDEN status in cancel route', () => {
      const filePath = path.join(process.cwd(), 'app/api/keys/[id]/revoke/cancel/route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('FORBIDDEN');
      expect(content).toContain('validatePermission');
      expect(content).toContain('auditService.log');
    });
  });

  describe('Cleanup Service CRON_SECRET', () => {
    it('should have validateCronSecret in cleanup.service.ts', () => {
      const filePath = path.join(process.cwd(), 'src/lib/services/cleanup.service.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('validateCronSecret');
      expect(content).toContain('CRON_SECRET');
      expect(content).toContain('X-Cron-Secret');
    });
  });

  describe('Audit Actions', () => {
    it('should include new audit action types', () => {
      const filePath = path.join(process.cwd(), 'src/lib/services/audit.service.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('cancel_revocation_unauthorized');
      expect(content).toContain('key_revoke_unauthorized');
    });
  });

  describe('Environment Configuration', () => {
    it('should have rate limit variables in .env.example', () => {
      const filePath = path.join(process.cwd(), '.env.example');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('RATE_LIMIT_WINDOW_SECONDS');
      expect(content).toContain('RATE_LIMIT_DEFAULT');
      expect(content).toContain('RATE_LIMIT_REVOKE');
      expect(content).toContain('RATE_LIMIT_PUBLISH');
    });
  });

  describe('Services Export', () => {
    it('should export apiKeyRepository from services index', () => {
      const filePath = path.join(process.cwd(), 'src/lib/services/index.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('apiKeyRepository');
      expect(content).toContain('ApiKeyRepository');
    });
  });
});
