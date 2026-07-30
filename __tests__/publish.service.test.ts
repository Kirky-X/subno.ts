// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublishService } from '@/src/lib/services/publish.service';

// Mock db
vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

// Mock audit service
vi.mock('@/src/lib/services/audit.service', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock channel repository
vi.mock('@/src/lib/repositories/channel.repository', () => ({
  channelRepository: {
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

// Mock redis client
vi.mock('@/src/lib/utils/redis-client', () => ({
  getRedisClient: vi.fn(),
}));

import { getDatabase } from '@/src/db';
import { auditService } from '@/src/lib/services/audit.service';
import { channelRepository } from '@/src/lib/repositories/channel.repository';
import { getRedisClient } from '@/src/lib/utils/redis-client';

describe('PublishService', () => {
  let service: PublishService;
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // 构造事务 mock：tx.insert(table).values(data) 应可解析
    mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      transaction: vi.fn(async (cb: (tx: any) => Promise<void>) => cb(mockTx)),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb);
    vi.mocked(getRedisClient).mockResolvedValue(null as never);
    service = new PublishService();
  });

  // 工厂：构造一个 mock channel
  const buildChannel = (overrides: Partial<{ id: string; isActive: boolean }> = {}) => ({
    id: overrides.id ?? 'ch-1',
    name: 'Test Channel',
    description: null,
    type: 'public',
    creator: 'user-1',
    metadata: {},
    createdAt: new Date(),
    expiresAt: null,
    isActive: overrides.isActive ?? true,
  });

  describe('publish', () => {
    it('缺少 channel 时应返回 MISSING_CHANNEL', async () => {
      const result = await service.publish({ channel: '', message: 'hello' });

      expect(result).toEqual({
        success: false,
        error: '缺少频道参数',
        code: 'MISSING_CHANNEL',
      });
    });

    it('缺少 message 时应返回 MISSING_MESSAGE', async () => {
      const result = await service.publish({ channel: 'ch-1', message: '' });

      expect(result).toEqual({
        success: false,
        error: '缺少消息内容',
        code: 'MISSING_MESSAGE',
      });
    });

    it('消息超过 1MB 时应返回 MESSAGE_TOO_LARGE', async () => {
      const largeMessage = 'x'.repeat(1024 * 1024 + 1);

      const result = await service.publish({ channel: 'ch-1', message: largeMessage });

      expect(result).toEqual({
        success: false,
        error: '消息大小超过限制（最大 1MB）',
        code: 'MESSAGE_TOO_LARGE',
      });
    });

    it('频道不存在且未启用 autoCreate 时应返回 CHANNEL_NOT_FOUND', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(null);

      const result = await service.publish({ channel: 'nonexistent', message: 'hello' });

      expect(result).toEqual({
        success: false,
        error: '频道不存在',
        code: 'CHANNEL_NOT_FOUND',
      });
    });

    it('频道不存在但启用 autoCreate 时应自动创建频道', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(null);
      const newChannel = buildChannel({ id: 'ch-new' });
      vi.mocked(channelRepository.create).mockResolvedValueOnce(newChannel as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce({
        publish: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await service.publish({
        channel: 'ch-new',
        message: 'hello',
        autoCreate: true,
      });

      expect(result.success).toBe(true);
      expect(result.autoCreated).toBe(true);
      expect(result.channel).toBe('ch-new');
      expect(result.messageId).toMatch(/^msg_\d+_[a-f0-9]+$/);
      expect(channelRepository.create).toHaveBeenCalledWith({
        id: 'ch-new',
        name: 'Channel ch-new',
        type: 'public',
      });
    });

    it('频道停用时应返回 CHANNEL_INACTIVE', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(
        buildChannel({ isActive: false }) as never,
      );

      const result = await service.publish({ channel: 'ch-1', message: 'hello' });

      expect(result).toEqual({
        success: false,
        error: '频道已停用',
        code: 'CHANNEL_INACTIVE',
      });
    });

    it('成功发布消息时应返回 messageId 和 publishedAt', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce({
        publish: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await service.publish(
        { channel: 'ch-1', message: 'hello world' },
        { ip: '127.0.0.1', userAgent: 'agent', userId: 'user-1' },
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^msg_\d+_[a-f0-9]+$/);
      expect(result.channel).toBe('ch-1');
      expect(result.publishedAt).toBeDefined();
      expect(result.autoCreated).toBe(false);

      // 验证事务内的两次 insert 调用
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      // 验证 Redis 发布
      expect(getRedisClient).toHaveBeenCalled();
    });

    it('应支持自定义 priority', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce({
        publish: vi.fn().mockResolvedValue(undefined),
      } as never);

      await service.publish({ channel: 'ch-1', message: 'hello', priority: 'critical' });

      // 第一次 insert 是 messages，第二次是 auditLogs
      const messagesCall = mockTx.values.mock.calls[0][0];
      expect(messagesCall.priority).toBe(100); // critical = 100
    });

    it('应支持所有 priority 级别', async () => {
      const priorities = [
        { name: 'critical', value: 100 },
        { name: 'high', value: 75 },
        { name: 'normal', value: 50 },
        { name: 'low', value: 25 },
        { name: 'bulk', value: 0 },
      ] as const;

      for (const p of priorities) {
        vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
        vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);
        mockTx.values.mockClear();

        await service.publish({ channel: 'ch-1', message: 'hello', priority: p.name });

        const messagesCall = mockTx.values.mock.calls[0][0];
        expect(messagesCall.priority).toBe(p.value);
      }
    });

    it('未指定 priority 时应使用 normal (50)', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);

      await service.publish({ channel: 'ch-1', message: 'hello' });

      const messagesCall = mockTx.values.mock.calls[0][0];
      expect(messagesCall.priority).toBe(50);
    });

    it('应正确设置 encrypted、cached、signature 字段', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);

      await service.publish({
        channel: 'ch-1',
        message: 'secret',
        encrypted: true,
        cache: false,
        signature: 'sig-123',
        sender: 'bot',
      });

      const messagesCall = mockTx.values.mock.calls[0][0];
      expect(messagesCall.encrypted).toBe(true);
      expect(messagesCall.cached).toBe(false);
      expect(messagesCall.signature).toBe('sig-123');
      expect(messagesCall.sender).toBe('bot');
    });

    it('cache 默认应为 true，encrypted 默认应为 false', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);

      await service.publish({ channel: 'ch-1', message: 'hello' });

      const messagesCall = mockTx.values.mock.calls[0][0];
      expect(messagesCall.cached).toBe(true);
      expect(messagesCall.encrypted).toBe(false);
    });

    it('事务失败时应返回 PUBLISH_FAILED 并记录审计日志', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      mockDb.transaction.mockRejectedValueOnce(new Error('Transaction failed'));

      const result = await service.publish({ channel: 'ch-1', message: 'hello' });

      expect(result).toEqual({
        success: false,
        error: '消息发布失败',
        code: 'PUBLISH_FAILED',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'message_publish_failed',
          success: false,
          error: 'Transaction failed',
        }),
      );
    });

    it('事务失败且错误非 Error 实例时应使用 Unknown error', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      mockDb.transaction.mockRejectedValueOnce('string error');

      await service.publish({ channel: 'ch-1', message: 'hello' });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'message_publish_failed',
          error: 'Unknown error',
        }),
      );
    });

    it('Redis 不可用时不影响发布成功', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);

      const result = await service.publish({ channel: 'ch-1', message: 'hello' });

      expect(result.success).toBe(true);
    });

    it('Redis publish 抛错时不影响发布成功', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce({
        publish: vi.fn().mockRejectedValue(new Error('Redis down')),
      } as never);

      const result = await service.publish({ channel: 'ch-1', message: 'hello' });

      expect(result.success).toBe(true);
    });

    it('应将 context 信息传递给审计日志', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);
      vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);

      await service.publish(
        { channel: 'ch-1', message: 'hello' },
        { ip: '10.0.0.1', userAgent: 'test-ua', userId: 'user-99' },
      );

      // 第二次 values 调用是 auditLogs
      const auditCall = mockTx.values.mock.calls[1][0];
      expect(auditCall.ip).toBe('10.0.0.1');
      expect(auditCall.userAgent).toBe('test-ua');
      expect(auditCall.userId).toBe('user-99');
      expect(auditCall.action).toBe('message_published');
    });
  });

  describe('getQueueStatus', () => {
    it('查询成功时应返回消息列表', async () => {
      const mockResults = [
        {
          message: {
            id: 'msg-1',
            content: 'hello',
            sender: 'bot',
            createdAt: new Date('2025-01-01'),
            priority: 100,
          },
          totalCount: 5,
        },
        {
          message: {
            id: 'msg-2',
            content: 'world',
            sender: null,
            createdAt: new Date('2025-01-02'),
            priority: 50,
          },
          totalCount: 5,
        },
      ];
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockResults);

      const result = await service.getQueueStatus('ch-1', 10);

      expect(result.success).toBe(true);
      expect(result.data?.channel).toBe('ch-1');
      expect(result.data?.queueLength).toBe(5);
      expect(result.data?.messages).toHaveLength(2);
      expect(result.data?.messages[0]).toEqual({
        id: 'msg-1',
        message: 'hello',
        sender: 'bot',
        timestamp: new Date('2025-01-01').getTime(),
        priority: 'critical',
      });
      expect(result.data?.messages[1]).toEqual({
        id: 'msg-2',
        message: 'world',
        sender: undefined,
        timestamp: new Date('2025-01-02').getTime(),
        priority: 'normal',
      });
    });

    it('无消息时应返回空列表和 queueLength=0', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await service.getQueueStatus('ch-empty');

      expect(result.success).toBe(true);
      expect(result.data?.messages).toHaveLength(0);
      expect(result.data?.queueLength).toBe(0);
    });

    it('查询出错时应返回 QUERY_FAILED', async () => {
      vi.mocked(mockDb.limit).mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getQueueStatus('ch-1');

      expect(result).toEqual({
        success: false,
        error: '查询失败',
        code: 'QUERY_FAILED',
      });
    });

    it('应支持自定义 count', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await service.getQueueStatus('ch-1', 50);

      expect(mockDb.limit).toHaveBeenCalledWith(50);
    });

    it('默认 count 应为 10', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await service.getQueueStatus('ch-1');

      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('getPriorityName (private, via direct call)', () => {
    const call = (value: number) =>
      (service as unknown as { getPriorityName: (v: number) => string }).getPriorityName(value);

    it('value >= 100 应返回 critical', () => {
      expect(call(100)).toBe('critical');
      expect(call(150)).toBe('critical');
    });

    it('value >= 75 应返回 high', () => {
      expect(call(75)).toBe('high');
      expect(call(99)).toBe('high');
    });

    it('value >= 50 应返回 normal', () => {
      expect(call(50)).toBe('normal');
      expect(call(74)).toBe('normal');
    });

    it('value >= 25 应返回 low', () => {
      expect(call(25)).toBe('low');
      expect(call(49)).toBe('low');
    });

    it('value < 25 应返回 bulk', () => {
      expect(call(0)).toBe('bulk');
      expect(call(24)).toBe('bulk');
    });
  });

  describe('generateMessageId (private, via direct call)', () => {
    it('应生成 msg_ 前缀的 ID', () => {
      const gen = (service as unknown as { generateMessageId: (c: string) => string })
        .generateMessageId;
      const id = gen('ch-1');
      expect(id).toMatch(/^msg_\d+_[a-f0-9]+$/);
    });

    it('应生成唯一 ID', () => {
      const gen = (service as unknown as { generateMessageId: (c: string) => string })
        .generateMessageId;
      const id1 = gen('ch-1');
      const id2 = gen('ch-1');
      expect(id1).not.toBe(id2);
    });
  });

  describe('publishToRedis (private, via direct call)', () => {
    it('Redis 客户端可用时应调用 publish', async () => {
      const mockPublish = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getRedisClient).mockResolvedValueOnce({
        publish: mockPublish,
      } as never);

      const internal = service as unknown as {
        publishToRedis: (channel: string, data: unknown) => Promise<void>;
      };
      await internal.publishToRedis('ch-1', { msg: 'hello' });

      expect(mockPublish).toHaveBeenCalledWith('channel:ch-1', JSON.stringify({ msg: 'hello' }));
    });

    it('Redis 客户端为 null 时不应抛错', async () => {
      vi.mocked(getRedisClient).mockResolvedValueOnce(null as never);

      const internal = service as unknown as {
        publishToRedis: (channel: string, data: unknown) => Promise<void>;
      };
      await expect(internal.publishToRedis('ch-1', { msg: 'hello' })).resolves.not.toThrow();
    });

    it('Redis publish 抛错时应静默失败', async () => {
      vi.mocked(getRedisClient).mockResolvedValueOnce({
        publish: vi.fn().mockRejectedValue(new Error('fail')),
      } as never);

      const internal = service as unknown as {
        publishToRedis: (channel: string, data: unknown) => Promise<void>;
      };
      await expect(internal.publishToRedis('ch-1', { msg: 'hello' })).resolves.not.toThrow();
    });
  });
});
