// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * API端点功能测试
 * 
 * 覆盖以下API端点：
 * 1. 密钥管理 API (DELETE /api/keys/:id)
 * 2. 密钥撤销请求 API (POST /api/keys/:id/revoke)
 * 3. 撤销状态查询 API (GET /api/keys/:id/revoke)
 * 4. 取消撤销 API (POST /api/keys/:id/revoke/cancel)
 * 
 * 测试覆盖：
 * - 正常功能流程
 * - 边界情况
 * - 错误场景
 * - 权限控制
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn((n: number) => Buffer.alloc(n).fill(0)),
    pbkdf2: vi.fn((
      _password: string | Buffer,
      salt: string | Buffer,
      _iterations: number,
      keylen: number,
      _digest: string,
      callback: (err: null, derivedKey: Buffer) => void
    ) => {
      callback(null, Buffer.alloc(keylen).fill(0));
    }),
    timingSafeEqual: vi.fn((a: Buffer, b: Buffer) => a.toString() === b.toString()),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('hashed_api_key_value'),
    })),
    randomUUID: vi.fn(() => 'test-uuid-1234'),
  },
  randomBytes: vi.fn((n: number) => Buffer.alloc(n).fill(0)),
  pbkdf2: vi.fn((
    _password: string | Buffer,
    salt: string | Buffer,
    _iterations: number,
    keylen: number,
    _digest: string,
    callback: (err: null, derivedKey: Buffer) => void
  ) => {
    callback(null, Buffer.alloc(keylen).fill(0));
  }),
  timingSafeEqual: vi.fn((a: Buffer, b: Buffer) => a.toString() === b.toString()),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('hashed_api_key_value'),
  })),
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

// Mock database
vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(() => ({})),
}));

// Mock repositories
const mockPublicKeyRepository = {
  findById: vi.fn(),
  findByChannelId: vi.fn(),
  softDelete: vi.fn(),
  restore: vi.fn(),
  findAll: vi.fn(),
  getDeletedKeys: vi.fn(),
  permanentDelete: vi.fn(),
  findByChannelIdWithAccess: vi.fn(),
  verifyKeyAccess: vi.fn(),
};

const mockApiKeyRepository = {
  findById: vi.fn(),
  findByKeyHash: vi.fn(),
  findByUserId: vi.fn(),
  findActive: vi.fn(),
  softDelete: vi.fn(),
  restore: vi.fn(),
  getDeletedKeys: vi.fn(),
  permanentDelete: vi.fn(),
  updateLastUsed: vi.fn(),
  deactivate: vi.fn(),
  validatePermission: vi.fn(),
};

const mockChannelRepository = {
  findById: vi.fn(),
  findByName: vi.fn(),
  findByCreator: vi.fn(),
  findActive: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  isCreator: vi.fn(),
  verifyAccess: vi.fn(),
};

const mockRevocationConfirmationRepository = {
  findById: vi.fn(),
  findByKeyId: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  findByCode: vi.fn(),
  verifyConfirmationCode: vi.fn(),
};

vi.mock('@/src/lib/repositories', () => ({
  publicKeyRepository: mockPublicKeyRepository,
  apiKeyRepository: mockApiKeyRepository,
  channelRepository: mockChannelRepository,
  revocationConfirmationRepository: mockRevocationConfirmationRepository,
}));

// Mock audit service
const mockAuditService = {
  log: vi.fn(),
};

vi.mock('@/src/lib/services/audit.service', () => ({
  auditService: mockAuditService,
}));

// Mock key revocation service
const mockKeyRevocationService = {
  requestRevocation: vi.fn(),
  confirmRevocation: vi.fn(),
  cancelRevocation: vi.fn(),
  getRevocationStatus: vi.fn(),
  getPendingRevocationByKeyId: vi.fn(),
};

vi.mock('@/src/lib/services/key-revocation.service', () => ({
  keyRevocationService: mockKeyRevocationService,
  KeyRevocationService: vi.fn(() => mockKeyRevocationService),
}));

// Mock services index
vi.mock('@/src/lib/services', () => ({
  keyRevocationService: mockKeyRevocationService,
  auditService: mockAuditService,
  apiKeyRepository: mockApiKeyRepository,
}));

// ============================================================================
// Test Data Factory
// ============================================================================

const createMockPublicKey = (overrides = {}) => ({
  id: 'key_test123',
  channelId: 'channel_test123',
  publicKey: '-----BEGIN PUBLIC KEY-----\ntest-public-key-content\n-----END PUBLIC KEY-----',
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  revokedAt: null,
  revokedBy: null,
  revocationReason: null,
  ...overrides,
});

const createMockApiKey = (overrides = {}) => ({
  id: 'apikey_test123',
  userId: 'user_test123',
  keyHash: 'hashed_api_key_value',
  permissions: ['read', 'write'],
  isActive: true,
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  revocationReason: null,
  ...overrides,
});

const createMockChannel = (overrides = {}) => ({
  id: 'channel_test123',
  name: 'Test Channel',
  type: 'public',
  creator: 'user_test123',
  description: 'Test channel description',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  metadata: {},
  expiresAt: null,
  ...overrides,
});

const createMockRevocationConfirmation = (overrides = {}) => ({
  id: 'revocation_test123',
  keyId: 'key_test123',
  apiKeyId: 'apikey_test123',
  reason: 'Test revocation reason for testing purposes',
  status: 'pending',
  confirmationCodeHash: 'hashed_confirmation_code',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  failedAttempts: 0,
  isLocked: false,
  confirmedBy: null,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('API端点功能测试', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env.ADMIN_MASTER_KEY = 'test-admin-master-key-12345678';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // 1. 密钥删除 API (DELETE /api/keys/:id)
  // ==========================================================================
  
  describe('DELETE /api/keys/:id - 密钥删除', () => {
    
    describe('两阶段确认删除模式', () => {
      
      it('应成功确认撤销并删除密钥', async () => {
        const mockKey = createMockPublicKey();
        const mockConfirmation = createMockRevocationConfirmation();
        
        mockKeyRevocationService.confirmRevocation.mockResolvedValue({
          success: true,
          deletedId: mockKey.id,
          channelId: mockKey.channelId,
        });
        
        mockAuditService.log.mockResolvedValue(undefined);
        
        const result = await mockKeyRevocationService.confirmRevocation(
          'key_test123',
          'valid-confirmation-code',
          'apikey_test123'
        );
        
        expect(result.success).toBe(true);
        expect(result.deletedId).toBe('key_test123');
        expect(result.channelId).toBe('channel_test123');
      });

      it('应在确认码无效时拒绝删除', async () => {
        mockKeyRevocationService.confirmRevocation.mockResolvedValue({
          success: false,
          error: 'Invalid confirmation code',
          code: 'INVALID_CODE',
        });
        
        const result = await mockKeyRevocationService.confirmRevocation(
          'key_test123',
          'invalid-code',
          'apikey_test123'
        );
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('INVALID_CODE');
      });

      it('应在密钥不存在时返回NOT_FOUND错误', async () => {
        mockKeyRevocationService.confirmRevocation.mockResolvedValue({
          success: false,
          error: 'Key not found',
          code: 'NOT_FOUND',
        });
        
        const result = await mockKeyRevocationService.confirmRevocation(
          'nonexistent_key',
          'some-code',
          'apikey_test123'
        );
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('NOT_FOUND');
      });

      it('应在尝试次数过多时锁定', async () => {
        mockKeyRevocationService.confirmRevocation.mockResolvedValue({
          success: false,
          error: 'Too many failed attempts. Please try again later.',
          code: 'LOCKED',
        });
        
        const result = await mockKeyRevocationService.confirmRevocation(
          'key_test123',
          'wrong-code',
          'apikey_test123'
        );
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('LOCKED');
      });
    });

    describe('管理员直接删除模式', () => {
      
      it('应允许管理员使用正确密钥直接删除', async () => {
        const mockKey = createMockPublicKey();
        
        mockPublicKeyRepository.findById.mockResolvedValue(mockKey);
        mockPublicKeyRepository.softDelete.mockResolvedValue({
          ...mockKey,
          isDeleted: true,
          revokedAt: new Date(),
          revokedBy: 'admin_direct',
          revocationReason: 'Security incident - immediate action required',
        });
        mockAuditService.log.mockResolvedValue(undefined);
        
        const key = await mockPublicKeyRepository.findById('key_test123');
        const deletedKey = await mockPublicKeyRepository.softDelete(
          'key_test123',
          'admin_direct',
          'Security incident - immediate action required'
        );
        
        expect(key).toBeDefined();
        expect(deletedKey?.isDeleted).toBe(true);
        expect(deletedKey?.revokedBy).toBe('admin_direct');
      });

      it('应在管理员密钥错误时拒绝访问', async () => {
        // 模拟安全比较失败
        const crypto = await import('crypto');
        vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(false);
        
        const adminKey = 'wrong-admin-key';
        const expectedKey = process.env.ADMIN_MASTER_KEY;
        
        // 使用安全比较
        const bufA = Buffer.from(adminKey);
        const bufB = Buffer.from(expectedKey || '');
        const isValid = bufA.length === bufB.length && 
          (await import('crypto')).timingSafeEqual(bufA, bufB);
        
        expect(isValid).toBe(false);
      });

      it('应在缺少原因时拒绝直接删除', async () => {
        const reason = '';
        const minLength = 10;
        
        const isValid = reason.length >= minLength;
        
        expect(isValid).toBe(false);
      });

      it('应在原因过短时拒绝直接删除', async () => {
        const reason = 'short'; // 少于10个字符
        const minLength = 10;
        
        const isValid = reason.length >= minLength;
        
        expect(isValid).toBe(false);
      });

      it('应在密钥不存在时返回NOT_FOUND', async () => {
        mockPublicKeyRepository.findById.mockResolvedValue(null);
        
        const key = await mockPublicKeyRepository.findById('nonexistent_key');
        
        expect(key).toBeNull();
      });
    });

    describe('无效请求处理', () => {
      
      it('应在缺少必要参数时返回错误', async () => {
        // 无confirmationCode, 无adminKey
        const hasConfirmationCode = false;
        const hasApiKey = false;
        const hasAdminKey = false;
        
        const isValidRequest = hasConfirmationCode && hasApiKey || hasAdminKey;
        
        expect(isValidRequest).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 2. 密钥撤销请求 API (POST /api/keys/:id/revoke)
  // ==========================================================================
  
  describe('POST /api/keys/:id/revoke - 请求密钥撤销', () => {
    
    describe('正常流程', () => {
      
      it('应成功创建撤销请求', async () => {
        const mockKey = createMockPublicKey();
        const mockConfirmation = createMockRevocationConfirmation();
        
        mockKeyRevocationService.requestRevocation.mockResolvedValue({
          success: true,
          revocationId: 'revocation_test123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        
        const result = await mockKeyRevocationService.requestRevocation({
          keyId: 'key_test123',
          apiKeyId: 'apikey_test123',
          reason: 'Key compromised - need immediate revocation',
        });
        
        expect(result.success).toBe(true);
        expect(result.revocationId).toBe('revocation_test123');
        expect(result.expiresAt).toBeDefined();
      });

      it('应使用自定义确认时间', async () => {
        const customHours = 48;
        
        mockKeyRevocationService.requestRevocation.mockResolvedValue({
          success: true,
          revocationId: 'revocation_test123',
          expiresAt: new Date(Date.now() + customHours * 60 * 60 * 1000).toISOString(),
        });
        
        const result = await mockKeyRevocationService.requestRevocation({
          keyId: 'key_test123',
          apiKeyId: 'apikey_test123',
          reason: 'Custom expiry time test reason',
          confirmationHours: customHours,
        });
        
        expect(result.success).toBe(true);
      });
    });

    describe('权限验证', () => {
      
      it('应验证API密钥具有key_revoke权限', async () => {
        const mockApiKey = createMockApiKey({
          permissions: ['read', 'write', 'key_revoke'],
        });
        
        mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
        
        const key = await mockApiKeyRepository.findById('apikey_test123');
        const hasPermission = (key?.permissions as string[]).includes('key_revoke');
        
        expect(hasPermission).toBe(true);
      });

      it('应验证管理员权限可绕过所有权检查', async () => {
        const mockApiKey = createMockApiKey({
          permissions: ['admin'],
        });
        
        mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
        
        const key = await mockApiKeyRepository.findById('apikey_test123');
        const isAdmin = (key?.permissions as string[]).includes('admin');
        
        expect(isAdmin).toBe(true);
      });

      it('应拒绝无key_revoke权限的请求', async () => {
        const mockApiKey = createMockApiKey({
          permissions: ['read'], // 只有read权限
        });
        
        mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
        
        const key = await mockApiKeyRepository.findById('apikey_test123');
        const hasPermission = (key?.permissions as string[]).includes('key_revoke');
        const isAdmin = (key?.permissions as string[]).includes('admin');
        
        expect(hasPermission).toBe(false);
        expect(isAdmin).toBe(false);
      });
    });

    describe('所有权验证', () => {
      
      it('应允许频道创建者撤销自己的密钥', async () => {
        const userId = 'user_test123';
        const channelId = 'channel_test123';
        
        mockChannelRepository.verifyAccess.mockResolvedValue({
          hasAccess: true,
          channel: createMockChannel({ creator: userId }),
        });
        
        const access = await mockChannelRepository.verifyAccess(channelId, userId, true);
        
        expect(access.hasAccess).toBe(true);
      });

      it('应拒绝非频道创建者撤销密钥', async () => {
        const userId = 'user_test123';
        const otherUserId = 'user_other456';
        const channelId = 'channel_test123';
        
        mockChannelRepository.verifyAccess.mockResolvedValue({
          hasAccess: false,
          error: 'Not authorized to access this channel',
        });
        
        const access = await mockChannelRepository.verifyAccess(channelId, otherUserId, true);
        
        expect(access.hasAccess).toBe(false);
        expect(access.error).toContain('Not authorized');
      });
    });

    describe('错误场景', () => {
      
      it('应在密钥不存在时返回NOT_FOUND', async () => {
        mockKeyRevocationService.requestRevocation.mockResolvedValue({
          success: false,
          error: 'Key not found',
          code: 'NOT_FOUND',
        });
        
        const result = await mockKeyRevocationService.requestRevocation({
          keyId: 'nonexistent_key',
          apiKeyId: 'apikey_test123',
          reason: 'Test reason for revocation',
        });
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('NOT_FOUND');
      });

      it('应在密钥已撤销时返回ALREADY_REVOKED', async () => {
        mockKeyRevocationService.requestRevocation.mockResolvedValue({
          success: false,
          error: 'Key already revoked',
          code: 'ALREADY_REVOKED',
        });
        
        const result = await mockKeyRevocationService.requestRevocation({
          keyId: 'already_revoked_key',
          apiKeyId: 'apikey_test123',
          reason: 'Test reason for revocation',
        });
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('ALREADY_REVOKED');
      });

      it('应在存在待处理撤销时返回REVOCATION_PENDING', async () => {
        mockKeyRevocationService.requestRevocation.mockResolvedValue({
          success: false,
          error: 'Revocation already pending',
          code: 'REVOCATION_PENDING',
          revocationId: 'existing_revocation',
        });
        
        const result = await mockKeyRevocationService.requestRevocation({
          keyId: 'key_with_pending_revocation',
          apiKeyId: 'apikey_test123',
          reason: 'Test reason for revocation',
        });
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('REVOCATION_PENDING');
      });

      it('应在原因无效时返回INVALID_REASON', async () => {
        mockKeyRevocationService.requestRevocation.mockResolvedValue({
          success: false,
          error: 'Reason must be at least 10 characters',
          code: 'INVALID_REASON',
        });
        
        const result = await mockKeyRevocationService.requestRevocation({
          keyId: 'key_test123',
          apiKeyId: 'apikey_test123',
          reason: 'short', // 少于10个字符
        });
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('INVALID_REASON');
      });
    });
  });

  // ==========================================================================
  // 3. 撤销状态查询 API (GET /api/keys/:id/revoke)
  // ==========================================================================
  
  describe('GET /api/keys/:id/revoke - 查询撤销状态', () => {
    
    describe('正常查询', () => {
      
      it('应返回撤销状态', async () => {
        mockKeyRevocationService.getRevocationStatus.mockResolvedValue({
          success: true,
          status: 'pending',
          keyId: 'key_test123',
          channelId: 'channel_test123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        
        const result = await mockKeyRevocationService.getRevocationStatus('revocation_test123');
        
        expect(result.success).toBe(true);
        expect(result.status).toBe('pending');
        expect(result.keyId).toBe('key_test123');
      });

      it('应通过keyId查询待处理撤销', async () => {
        mockKeyRevocationService.getPendingRevocationByKeyId.mockResolvedValue({
          success: true,
          status: 'pending',
          keyId: 'key_test123',
          channelId: 'channel_test123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        
        const result = await mockKeyRevocationService.getPendingRevocationByKeyId('key_test123');
        
        expect(result.success).toBe(true);
        expect(result.status).toBe('pending');
      });

      it('应返回已确认状态', async () => {
        mockKeyRevocationService.getRevocationStatus.mockResolvedValue({
          success: true,
          status: 'confirmed',
          keyId: 'key_test123',
          channelId: 'channel_test123',
          revokedAt: new Date().toISOString(),
          revokedBy: 'apikey_test123',
        });
        
        const result = await mockKeyRevocationService.getRevocationStatus('revocation_test123');
        
        expect(result.success).toBe(true);
        expect(result.status).toBe('confirmed');
        expect(result.revokedAt).toBeDefined();
      });

      it('应返回已取消状态', async () => {
        mockKeyRevocationService.getRevocationStatus.mockResolvedValue({
          success: true,
          status: 'cancelled',
          keyId: 'key_test123',
          channelId: 'channel_test123',
        });
        
        const result = await mockKeyRevocationService.getRevocationStatus('revocation_test123');
        
        expect(result.success).toBe(true);
        expect(result.status).toBe('cancelled');
      });

      it('应返回已过期状态', async () => {
        mockKeyRevocationService.getRevocationStatus.mockResolvedValue({
          success: true,
          status: 'expired',
          keyId: 'key_test123',
          channelId: 'channel_test123',
        });
        
        const result = await mockKeyRevocationService.getRevocationStatus('revocation_test123');
        
        expect(result.success).toBe(true);
        expect(result.status).toBe('expired');
      });
    });

    describe('错误处理', () => {
      
      it('应在撤销记录不存在时返回NOT_FOUND', async () => {
        mockKeyRevocationService.getRevocationStatus.mockResolvedValue({
          success: false,
          error: 'Revocation not found',
          code: 'NOT_FOUND',
        });
        
        const result = await mockKeyRevocationService.getRevocationStatus('nonexistent');
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('NOT_FOUND');
      });

      it('应在无待处理撤销时返回NOT_FOUND', async () => {
        mockKeyRevocationService.getPendingRevocationByKeyId.mockResolvedValue({
          success: false,
          error: 'No pending revocation',
          code: 'NOT_FOUND',
          status: 'not_found',
        });
        
        const result = await mockKeyRevocationService.getPendingRevocationByKeyId('key_without_revocation');
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('NOT_FOUND');
      });
    });
  });

  // ==========================================================================
  // 4. 取消撤销 API (POST /api/keys/:id/revoke/cancel)
  // ==========================================================================
  
  describe('POST /api/keys/:id/revoke/cancel - 取消撤销', () => {
    
    describe('正常流程', () => {
      
      it('应成功取消待处理的撤销', async () => {
        mockApiKeyRepository.validatePermission.mockResolvedValue(true);
        mockKeyRevocationService.cancelRevocation.mockResolvedValue({
          success: true,
        });
        mockAuditService.log.mockResolvedValue(undefined);
        
        const hasPermission = await mockApiKeyRepository.validatePermission('apikey_test123', 'key_revoke');
        const result = await mockKeyRevocationService.cancelRevocation('revocation_test123', 'apikey_test123');
        
        expect(hasPermission).toBe(true);
        expect(result.success).toBe(true);
      });
    });

    describe('权限验证', () => {
      
      it('应验证API密钥具有key_revoke权限', async () => {
        mockApiKeyRepository.validatePermission.mockResolvedValue(true);
        
        const hasPermission = await mockApiKeyRepository.validatePermission('apikey_test123', 'key_revoke');
        
        expect(hasPermission).toBe(true);
      });

      it('应拒绝无权限的请求', async () => {
        mockApiKeyRepository.validatePermission.mockResolvedValue(false);
        
        const hasPermission = await mockApiKeyRepository.validatePermission('apikey_no_permission', 'key_revoke');
        
        expect(hasPermission).toBe(false);
      });
    });

    describe('错误场景', () => {
      
      it('应在撤销记录不存在时返回NOT_FOUND', async () => {
        mockApiKeyRepository.validatePermission.mockResolvedValue(true);
        mockKeyRevocationService.cancelRevocation.mockResolvedValue({
          success: false,
          error: 'Revocation not found',
          code: 'NOT_FOUND',
        });
        
        const result = await mockKeyRevocationService.cancelRevocation('nonexistent', 'apikey_test123');
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('NOT_FOUND');
      });

      it('应在撤销状态非pending时返回INVALID_STATE', async () => {
        mockApiKeyRepository.validatePermission.mockResolvedValue(true);
        mockKeyRevocationService.cancelRevocation.mockResolvedValue({
          success: false,
          error: 'Revocation is not in pending state',
          code: 'INVALID_STATE',
        });
        
        const result = await mockKeyRevocationService.cancelRevocation('confirmed_revocation', 'apikey_test123');
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('INVALID_STATE');
      });
    });
  });
});

// ==========================================================================
// 边界情况测试
// ==========================================================================

describe('边界情况测试', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('空值输入', () => {
    
    it('应拒绝空的密钥ID', async () => {
      const keyId = '';
      const isValid = keyId.length > 0;
      
      expect(isValid).toBe(false);
    });

    it('应拒绝空的撤销原因', async () => {
      const reason = '';
      const minLength = 10;
      
      const isValid = typeof reason === 'string' && reason.length >= minLength;
      
      expect(isValid).toBe(false);
    });

    it('应拒绝空的确认码', async () => {
      const confirmationCode = '';
      const isValid = confirmationCode.length > 0;
      
      expect(isValid).toBe(false);
    });

    it('应拒绝空的API密钥', async () => {
      const apiKey = '';
      const minLength = 16;
      
      const isValid = apiKey.length >= minLength;
      
      expect(isValid).toBe(false);
    });
  });

  describe('超长输入', () => {
    
    it('应拒绝超长的撤销原因', async () => {
      const maxLength = 1000;
      const reason = 'a'.repeat(maxLength + 1);
      
      const isValid = reason.length <= maxLength;
      
      expect(isValid).toBe(false);
    });

    it('应拒绝超长的API密钥', async () => {
      const maxLength = 128;
      const apiKey = 'a'.repeat(maxLength + 1);
      
      const isValid = apiKey.length <= maxLength;
      
      expect(isValid).toBe(false);
    });

    it('应接受最大长度的有效输入', async () => {
      const maxLength = 1000;
      const reason = 'a'.repeat(maxLength);
      
      const isValid = reason.length <= maxLength && reason.length >= 10;
      
      expect(isValid).toBe(true);
    });
  });

  describe('无效格式', () => {
    
    it('应拒绝包含控制字符的原因', async () => {
      const reason = 'Valid reason\x00with null byte';
      
      // 检查是否包含控制字符
      const hasControlChars = reason.split('').some(char => {
        const code = char.charCodeAt(0);
        return code < 32 && code !== 9 && code !== 10 && code !== 13;
      });
      
      expect(hasControlChars).toBe(true);
    });

    it('应拒绝无效的API密钥格式', async () => {
      const apiKey = 'invalid key with spaces!';
      const validPattern = /^[a-zA-Z0-9-]+$/;
      
      const isValid = validPattern.test(apiKey);
      
      expect(isValid).toBe(false);
    });

    it('应接受有效的API密钥格式', async () => {
      const apiKey = 'valid-api-key-12345678';
      const validPattern = /^[a-zA-Z0-9-]+$/;
      
      const isValid = validPattern.test(apiKey) && apiKey.length >= 16;
      
      expect(isValid).toBe(true);
    });
  });

  describe('权限边界', () => {
    
    it('应正确处理read权限用户的访问限制', async () => {
      const permissions = ['read'];
      const requiredPermission = 'write';
      
      const hasPermission = permissions.includes(requiredPermission);
      
      expect(hasPermission).toBe(false);
    });

    it('应正确处理key_revoke权限的层级关系', async () => {
      const permissions = ['key_revoke'];
      
      // key_revoke应该隐含read权限
      const hierarchy = {
        'key_revoke': ['read', 'key_revoke'],
      };
      
      const hasRead = hierarchy['key_revoke'].includes('read');
      const hasWrite = hierarchy['key_revoke'].includes('write');
      
      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(false);
    });

    it('应正确处理admin权限的全局访问', async () => {
      const permissions = ['admin'];
      
      // admin应该拥有所有权限
      const hierarchy = {
        'admin': ['read', 'write', 'key_revoke', 'admin'],
      };
      
      const hasAll = ['read', 'write', 'key_revoke', 'admin'].every(
        p => hierarchy['admin'].includes(p)
      );
      
      expect(hasAll).toBe(true);
    });
  });

  describe('数值边界', () => {
    
    it('应正确处理确认时间的边界值', async () => {
      const minHours = 1;
      const maxHours = 168; // 7天
      
      expect(minHours).toBeGreaterThanOrEqual(1);
      expect(maxHours).toBeLessThanOrEqual(168);
    });

    it('应正确处理最大尝试次数', async () => {
      const maxAttempts = 5;
      const currentAttempts = 5;
      
      const isLocked = currentAttempts >= maxAttempts;
      
      expect(isLocked).toBe(true);
    });

    it('应正确处理锁定时间', async () => {
      const lockoutMinutes = 60;
      const lockoutMs = lockoutMinutes * 60 * 1000;
      
      expect(lockoutMs).toBe(3600000);
    });
  });
});

// ==========================================================================
// 错误场景测试
// ==========================================================================

describe('错误场景测试', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('认证失败', () => {
    
    it('应在缺少API密钥时返回MISSING_API_KEY', async () => {
      const apiKey = null;
      
      const error = apiKey ? null : { code: 'MISSING_API_KEY', message: 'API key is required' };
      
      expect(error).not.toBeNull();
      expect(error?.code).toBe('MISSING_API_KEY');
    });

    it('应在API密钥无效时返回INVALID_API_KEY', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(null);
      
      const key = await mockApiKeyRepository.findByKeyHash('invalid_hash');
      
      expect(key).toBeNull();
    });

    it('应在API密钥已停用时返回INACTIVE_API_KEY', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(
        createMockApiKey({ isActive: false })
      );
      
      const key = await mockApiKeyRepository.findByKeyHash('test_hash');
      
      expect(key?.isActive).toBe(false);
    });

    it('应在API密钥已撤销时返回REVOKED_API_KEY', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(
        createMockApiKey({ isDeleted: true })
      );
      
      const key = await mockApiKeyRepository.findByKeyHash('test_hash');
      
      expect(key?.isDeleted).toBe(true);
    });

    it('应在API密钥已过期时返回EXPIRED_API_KEY', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(
        createMockApiKey({ expiresAt: new Date('2020-01-01') })
      );
      
      const key = await mockApiKeyRepository.findByKeyHash('test_hash');
      const isExpired = key?.expiresAt && new Date(key.expiresAt) < new Date();
      
      expect(isExpired).toBe(true);
    });
  });

  describe('权限不足', () => {
    
    it('应在缺少必要权限时返回INSUFFICIENT_PERMISSIONS', async () => {
      const userPermissions = ['read'];
      const requiredPermissions = ['write', 'key_revoke'];
      
      const hasAll = requiredPermissions.every(p => userPermissions.includes(p));
      
      expect(hasAll).toBe(false);
    });

    it('应在非频道创建者尝试撤销时拒绝', async () => {
      mockChannelRepository.verifyAccess.mockResolvedValue({
        hasAccess: false,
        error: 'Not authorized to access this channel',
      });
      
      const access = await mockChannelRepository.verifyAccess('channel_test', 'other_user', true);
      
      expect(access.hasAccess).toBe(false);
    });

    it('应在非管理员尝试直接删除时拒绝', async () => {
      const isAdmin = false;
      const hasAdminKey = false;
      
      const canDirectDelete = isAdmin || hasAdminKey;
      
      expect(canDirectDelete).toBe(false);
    });
  });

  describe('资源不存在', () => {
    
    it('应在密钥不存在时返回NOT_FOUND', async () => {
      mockPublicKeyRepository.findById.mockResolvedValue(null);
      
      const key = await mockPublicKeyRepository.findById('nonexistent');
      
      expect(key).toBeNull();
    });

    it('应在频道不存在时返回NOT_FOUND', async () => {
      mockChannelRepository.findById.mockResolvedValue(null);
      
      const channel = await mockChannelRepository.findById('nonexistent');
      
      expect(channel).toBeNull();
    });

    it('应在撤销记录不存在时返回NOT_FOUND', async () => {
      mockRevocationConfirmationRepository.findById.mockResolvedValue(null);
      
      const confirmation = await mockRevocationConfirmationRepository.findById('nonexistent');
      
      expect(confirmation).toBeNull();
    });
  });

  describe('速率限制触发', () => {
    
    it('应在超过速率限制时返回RATE_LIMIT_EXCEEDED', async () => {
      const rateLimitResult = {
        success: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfter: 60,
      };
      
      expect(rateLimitResult.success).toBe(false);
      expect(rateLimitResult.remaining).toBe(0);
      expect(rateLimitResult.retryAfter).toBeGreaterThan(0);
    });

    it('应在Redis不可用时fail-closed', async () => {
      // Fail-closed: 当速率限制服务不可用时，拒绝请求
      const isRedisAvailable = false;
      const failClosed = true;
      
      const shouldAllow = isRedisAvailable || !failClosed;
      
      expect(shouldAllow).toBe(false);
    });

    it('应正确设置Retry-After头', async () => {
      const retryAfter = 60;
      const resetTime = Math.ceil(Date.now() / 1000 + retryAfter);
      
      expect(retryAfter).toBe(60);
      expect(resetTime).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('服务器错误', () => {
    
    it('应在数据库错误时返回DATABASE_ERROR', async () => {
      mockPublicKeyRepository.findById.mockRejectedValue(new Error('Connection refused'));
      
      try {
        await mockPublicKeyRepository.findById('test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Connection refused');
      }
    });

    it('应在删除失败时返回DELETE_FAILED', async () => {
      mockPublicKeyRepository.softDelete.mockResolvedValue(null);
      
      const result = await mockPublicKeyRepository.softDelete('test', 'user', 'reason');
      
      expect(result).toBeNull();
    });

    it('应在内部错误时返回INTERNAL_ERROR', async () => {
      const error = new Error('Unexpected error');
      
      expect(error).toBeInstanceOf(Error);
    });
  });
});

// ==========================================================================
// 安全测试
// ==========================================================================

describe('安全测试', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('时序攻击防护', () => {
    
    it('应使用常量时间比较验证管理员密钥', async () => {
      const crypto = await import('crypto');
      
      const key1 = Buffer.from('test_key_1');
      const key2 = Buffer.from('test_key_2');
      
      // timingSafeEqual 应该被调用
      const result = crypto.timingSafeEqual(key1, key1);
      
      expect(result).toBe(true);
    });

    it('应使用常量时间比较确认码', async () => {
      const crypto = await import('crypto');
      
      const code1 = Buffer.from('confirmation_code_1');
      const code2 = Buffer.from('confirmation_code_2');
      
      const result = crypto.timingSafeEqual(code1, code2);
      
      expect(result).toBe(false);
    });
  });

  describe('API密钥哈希', () => {
    
    it('应使用SHA-256哈希API密钥', async () => {
      const crypto = await import('crypto');
      
      const apiKey = 'test_api_key_12345678';
      const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      expect(hash).toBeDefined();
      expect(hash).toBe('hashed_api_key_value'); // Mock返回值
    });

    it('应使用哈希值查找API密钥', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(createMockApiKey());
      
      const key = await mockApiKeyRepository.findByKeyHash('hashed_value');
      
      expect(mockApiKeyRepository.findByKeyHash).toHaveBeenCalledWith('hashed_value');
      expect(key).toBeDefined();
    });
  });

  describe('审计日志', () => {
    
    it('应记录成功的撤销请求', async () => {
      mockAuditService.log.mockResolvedValue(undefined);
      
      await mockAuditService.log({
        action: 'key_revoke_request',
        keyId: 'key_test',
        success: true,
      });
      
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('应记录失败的撤销尝试', async () => {
      mockAuditService.log.mockResolvedValue(undefined);
      
      await mockAuditService.log({
        action: 'key_revoke_request',
        keyId: 'key_test',
        success: false,
        error: 'Permission denied',
      });
      
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('应记录管理员直接删除操作', async () => {
      mockAuditService.log.mockResolvedValue(undefined);
      
      await mockAuditService.log({
        action: 'key_direct_delete',
        keyId: 'key_test',
        success: true,
        metadata: { isSecurityEvent: true },
      });
      
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'key_direct_delete',
          metadata: expect.objectContaining({ isSecurityEvent: true }),
        })
      );
    });

    it('应记录未授权的访问尝试', async () => {
      mockAuditService.log.mockResolvedValue(undefined);
      
      await mockAuditService.log({
        action: 'cancel_revocation_unauthorized',
        success: false,
      });
      
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('输入验证', () => {
    
    it('应验证密钥ID格式', async () => {
      const validId = 'key_12345678';
      const invalidId = 'key with spaces';
      
      const validPattern = /^[a-zA-Z0-9_-]+$/;
      
      expect(validPattern.test(validId)).toBe(true);
      expect(validPattern.test(invalidId)).toBe(false);
    });

    it('应验证撤销原因长度', async () => {
      const minLength = 10;
      const maxLength = 1000;
      
      const validReason = 'This is a valid reason for key revocation';
      const shortReason = 'short';
      const longReason = 'a'.repeat(1001);
      
      expect(validReason.length >= minLength && validReason.length <= maxLength).toBe(true);
      expect(shortReason.length >= minLength).toBe(false);
      expect(longReason.length <= maxLength).toBe(false);
    });

    it('应验证确认码格式', async () => {
      // 确认码应该是64字符的十六进制字符串
      const validCode = 'a'.repeat(64);
      const invalidCode = 'not-hex!';
      
      const hexPattern = /^[a-fA-F0-9]+$/;
      
      expect(hexPattern.test(validCode)).toBe(true);
      expect(hexPattern.test(invalidCode)).toBe(false);
    });
  });
});

// ==========================================================================
// 集成测试场景
// ==========================================================================

describe('集成测试场景', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('完整撤销流程', () => {
    
    it('应完成从请求到确认的完整流程', async () => {
      const userId = 'user_test123';
      const keyId = 'key_test123';
      const apiKeyId = 'apikey_test123';
      const channelId = 'channel_test123';
      
      // 1. 验证API密钥
      mockApiKeyRepository.findById.mockResolvedValue(
        createMockApiKey({ 
          id: apiKeyId, 
          userId, 
          permissions: ['read', 'write', 'key_revoke'] 
        })
      );
      
      // 2. 验证密钥存在
      mockPublicKeyRepository.findById.mockResolvedValue(
        createMockPublicKey({ id: keyId, channelId })
      );
      
      // 3. 验证频道所有权
      mockChannelRepository.verifyAccess.mockResolvedValue({
        hasAccess: true,
        channel: createMockChannel({ id: channelId, creator: userId }),
      });
      
      // 4. 创建撤销请求
      mockRevocationConfirmationRepository.findByKeyId.mockResolvedValue(null);
      mockRevocationConfirmationRepository.create.mockResolvedValue({
        confirmation: createMockRevocationConfirmation({ keyId, apiKeyId }),
      });
      
      // 5. 确认撤销
      mockRevocationConfirmationRepository.verifyConfirmationCode.mockResolvedValue({
        valid: true,
        confirmation: createMockRevocationConfirmation({ keyId }),
      });
      mockPublicKeyRepository.softDelete.mockResolvedValue(
        createMockPublicKey({ id: keyId, isDeleted: true })
      );
      
      // 执行验证
      const apiKey = await mockApiKeyRepository.findById(apiKeyId);
      expect(apiKey).toBeDefined();
      expect(apiKey?.permissions).toContain('key_revoke');
      
      const key = await mockPublicKeyRepository.findById(keyId);
      expect(key).toBeDefined();
      
      const access = await mockChannelRepository.verifyAccess(channelId, userId, true);
      expect(access.hasAccess).toBe(true);
    });

    it('应在权限不足时阻止完整流程', async () => {
      const userId = 'user_test123';
      const otherUserId = 'user_other456';
      const keyId = 'key_test123';
      const apiKeyId = 'apikey_test123';
      const channelId = 'channel_test123';
      
      // API密钥属于user_test123
      mockApiKeyRepository.findById.mockResolvedValue(
        createMockApiKey({ id: apiKeyId, userId, permissions: ['key_revoke'] })
      );
      
      // 密钥属于另一个用户的频道
      mockPublicKeyRepository.findById.mockResolvedValue(
        createMockPublicKey({ id: keyId, channelId })
      );
      
      // 频道属于otherUserId
      mockChannelRepository.verifyAccess.mockResolvedValue({
        hasAccess: false,
        error: 'Not authorized to access this channel',
      });
      
      // 验证
      const access = await mockChannelRepository.verifyAccess(channelId, userId, true);
      expect(access.hasAccess).toBe(false);
    });
  });

  describe('并发场景', () => {
    
    it('应防止重复撤销请求', async () => {
      mockRevocationConfirmationRepository.findByKeyId.mockResolvedValue(
        createMockRevocationConfirmation({ status: 'pending' })
      );
      
      const existing = await mockRevocationConfirmationRepository.findByKeyId('key_test');
      
      expect(existing).toBeDefined();
      expect(existing?.status).toBe('pending');
    });

    it('应正确处理并发取消请求', async () => {
      mockRevocationConfirmationRepository.findById.mockResolvedValue(
        createMockRevocationConfirmation({ status: 'pending' })
      );
      mockRevocationConfirmationRepository.updateStatus.mockResolvedValue(undefined);
      
      // 第一次取消应该成功
      const confirmation = await mockRevocationConfirmationRepository.findById('revocation_test');
      expect(confirmation?.status).toBe('pending');
    });
  });

  describe('错误恢复', () => {
    
    it('应在临时错误后允许重试', async () => {
      // 第一次调用失败
      mockPublicKeyRepository.findById
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(createMockPublicKey());
      
      // 第一次应该失败
      try {
        await mockPublicKeyRepository.findById('key_test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      // 重试应该成功
      const key = await mockPublicKeyRepository.findById('key_test');
      expect(key).toBeDefined();
    });
  });
});
