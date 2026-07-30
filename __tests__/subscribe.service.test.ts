// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SubscribeService } from '@/src/lib/services/subscribe.service';

// Mock channelRepository
vi.mock('@/src/lib/repositories/channel.repository', () => ({
  channelRepository: {
    findById: vi.fn(),
  },
}));

// Mock auditService
vi.mock('@/src/lib/services/audit.service', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock redis-client
vi.mock('@/src/lib/utils/redis-client', () => ({
  getRedisSubscriber: vi.fn(),
  getRedisClient: vi.fn(),
}));

import { channelRepository } from '@/src/lib/repositories/channel.repository';
import { auditService } from '@/src/lib/services/audit.service';
import { getRedisSubscriber } from '@/src/lib/utils/redis-client';

describe('SubscribeService', () => {
  let service: SubscribeService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new SubscribeService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 工厂：构造一个 mock channel
  const buildChannel = (overrides: Partial<{ isActive: boolean }> = {}) => ({
    id: 'ch-1',
    name: 'Test Channel',
    description: null,
    type: 'public',
    creator: 'user-1',
    metadata: {},
    createdAt: new Date(),
    expiresAt: null,
    isActive: overrides.isActive ?? true,
  });

  describe('validateChannel', () => {
    it('频道存在且活跃时应返回 valid', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(buildChannel() as never);

      const result = await service.validateChannel('ch-1');

      expect(result).toEqual({ valid: true });
    });

    it('频道不存在时应返回 CHANNEL_NOT_FOUND', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(null);

      const result = await service.validateChannel('nonexistent');

      expect(result).toEqual({
        valid: false,
        error: '频道不存在',
        code: 'CHANNEL_NOT_FOUND',
      });
    });

    it('频道停用时应返回 CHANNEL_INACTIVE', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(
        buildChannel({ isActive: false }) as never,
      );

      const result = await service.validateChannel('ch-1');

      expect(result).toEqual({
        valid: false,
        error: '频道已停用',
        code: 'CHANNEL_INACTIVE',
      });
    });
  });

  describe('createSSEStream', () => {
    it('总连接数达到上限时应抛出错误', async () => {
      // 通过反射注入超出上限的连接数：直接填充 activeConnections
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
      };
      // MAX_TOTAL_CONNECTIONS = 10000
      const bigSet = new Set(
        Array(10000)
          .fill(null)
          .map(() => ({ controller: {}, connectedAt: 0 })),
      );
      internal.activeConnections.set('fake-channel', bigSet);

      expect(() => service.createSSEStream({ channel: 'ch-1' })).toThrow(
        'Maximum total connections reached',
      );

      // 清理状态
      internal.activeConnections.clear();
    });

    it('单频道连接数达到上限时应抛出错误', async () => {
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
      };
      // MAX_CONNECTIONS_PER_CHANNEL = 1000
      const bigSet = new Set(
        Array(1000)
          .fill(null)
          .map(() => ({ controller: {}, connectedAt: 0 })),
      );
      internal.activeConnections.set('ch-1', bigSet);

      expect(() => service.createSSEStream({ channel: 'ch-1' })).toThrow(
        'Maximum connections for this channel reached',
      );

      internal.activeConnections.clear();
    });

    it('成功创建流时应发送 connected 事件并记录审计日志', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream(
        { channel: 'ch-1' },
        { ip: '127.0.0.1', userAgent: 'agent' },
      );
      const reader = stream.getReader();

      // 读取第一条消息（connected 事件）
      const { value, done } = await reader.read();

      expect(done).toBe(false);
      const text = new TextDecoder().decode(value);
      expect(text).toContain('event: connected');
      expect(text).toContain('"channel":"ch-1"');
      expect(text).toContain('"type":"channel"');

      // 等待 start 回调中的 await subscribeToRedis 完成
      await vi.advanceTimersByTimeAsync(0);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'subscribe_started',
          channelId: 'ch-1',
          ip: '127.0.0.1',
          userAgent: 'agent',
          success: true,
        }),
      );

      expect(getRedisSubscriber).toHaveBeenCalled();
      expect(mockRedis.subscribe).toHaveBeenCalledWith('channel:ch-1', expect.any(Function));

      // 释放 reader 以便 cancel 能被调用
      reader.releaseLock();
      await stream.cancel();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'subscribe_ended',
          channelId: 'ch-1',
          success: true,
        }),
      );
    });

    it('Redis 不可用时应继续工作（不订阅但不报错）', async () => {
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(null as never);

      const stream = service.createSSEStream({ channel: 'ch-2' });
      const reader = stream.getReader();
      const { value } = await reader.read();
      await vi.advanceTimersByTimeAsync(0);

      const text = new TextDecoder().decode(value);
      expect(text).toContain('event: connected');

      reader.releaseLock();
      await stream.cancel();
    });

    it('Redis 订阅抛错时应继续工作', async () => {
      vi.mocked(getRedisSubscriber).mockRejectedValueOnce(new Error('Redis down'));

      const stream = service.createSSEStream({ channel: 'ch-3' });
      const reader = stream.getReader();
      const { value } = await reader.read();
      await vi.advanceTimersByTimeAsync(0);

      const text = new TextDecoder().decode(value);
      expect(text).toContain('event: connected');

      reader.releaseLock();
      await stream.cancel();
    });

    it('Redis 消息回调应转发为 SSE 消息', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream({ channel: 'ch-4' });
      const reader = stream.getReader();

      // 消费 connected 消息
      await reader.read();
      // 等待 subscribeToRedis 完成
      await vi.advanceTimersByTimeAsync(0);

      // 获取 subscribe 回调并触发
      const subscribeCall = mockRedis.subscribe.mock.calls[0];
      const callback = subscribeCall[1] as (msg: string) => void;

      // 测试 JSON 解析路径
      callback(JSON.stringify({ id: 'msg-1', content: 'hello' }));

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('id: msg-1');
      expect(text).toContain('event: message');
      expect(text).toContain('"content":"hello"');

      reader.releaseLock();
      await stream.cancel();
    });

    it('Redis 消息回调收到非 JSON 时应走 raw 路径', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream({ channel: 'ch-5' });
      const reader = stream.getReader();

      // 消费 connected 消息
      await reader.read();
      await vi.advanceTimersByTimeAsync(0);

      const subscribeCall = mockRedis.subscribe.mock.calls[0];
      const callback = subscribeCall[1] as (msg: string) => void;

      // 触发非 JSON 消息
      callback('not-json');

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('"raw":"not-json"');

      reader.releaseLock();
      await stream.cancel();
    });

    it('cancel 时应清理 keepalive、连接并取消 Redis 订阅', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream({ channel: 'ch-6' });
      const reader = stream.getReader();
      await reader.read();
      // 等待 subscribeToRedis 完成，确保 redisSubscriber 被设置
      await vi.advanceTimersByTimeAsync(0);
      reader.releaseLock();

      await stream.cancel();

      expect(mockRedis.unsubscribe).toHaveBeenCalledWith('channel:ch-6');
    });

    it('keepalive 定时器应定期发送心跳', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream({ channel: 'ch-7' });
      const reader = stream.getReader();

      // 消费 connected 消息
      await reader.read();
      await vi.advanceTimersByTimeAsync(0);

      // 推进时间触发 keepalive（KEEPALIVE_INTERVAL = 30000ms）
      await vi.advanceTimersByTimeAsync(30000);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toBe(': keepalive\n\n');

      reader.releaseLock();
      await stream.cancel();
    });

    it('keepalive 在 controller 已关闭时应清理定时器（catch 分支）', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream({ channel: 'ch-keepalive-catch' });
      const reader = stream.getReader();

      await reader.read();
      await vi.advanceTimersByTimeAsync(0);

      // 通过 activeConnections 访问内部 controller 并关闭它（不触发 cancel 回调）
      // 这样 keepalive 定时器仍然存活，下次触发时 enqueue 会抛错进入 catch
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: ReadableStreamDefaultController; connectedAt: number }>
        >;
      };
      const connInfo = internal.activeConnections.get('ch-keepalive-catch')?.values().next().value;
      try {
        connInfo?.controller.close();
      } catch {
        // 忽略关闭错误
      }

      // 触发 keepalive 定时器：controller.enqueue 抛错（流已关闭），进入 catch 分支
      await vi.advanceTimersByTimeAsync(30000);

      reader.releaseLock();
      try {
        await stream.cancel();
      } catch {
        // 流已关闭，cancel 可能抛错
      }
    });

    it('Redis 消息回调在 controller 已关闭时应静默失败（catch 分支）', async () => {
      const mockRedis = {
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getRedisSubscriber).mockResolvedValueOnce(mockRedis as never);

      const stream = service.createSSEStream({ channel: 'ch-redis-catch' });
      const reader = stream.getReader();

      await reader.read();
      await vi.advanceTimersByTimeAsync(0);

      // 获取 redis subscribe 回调
      const subscribeCall = mockRedis.subscribe.mock.calls[0];
      const callback = subscribeCall[1] as (msg: string) => void;

      // 关闭 controller 使 enqueue 抛错
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: ReadableStreamDefaultController; connectedAt: number }>
        >;
      };
      const connInfo = internal.activeConnections.get('ch-redis-catch')?.values().next().value;
      try {
        connInfo?.controller.close();
      } catch {
        // 忽略
      }

      // 触发 redis 回调：controller.enqueue 抛错，进入 catch 分支（line 129）
      expect(() => callback(JSON.stringify({ id: 'msg-1', content: 'hello' }))).not.toThrow();

      reader.releaseLock();
      try {
        await stream.cancel();
      } catch {
        // 流已关闭
      }
    });
  });

  describe('addConnection / removeConnection (private, via direct call)', () => {
    it('同频道添加第二个连接时应复用已有 Set', () => {
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: ReadableStreamDefaultController; connectedAt: number }>
        >;
        addConnection: (channel: string, controller: ReadableStreamDefaultController) => void;
      };
      const controller1 = { close: vi.fn() } as unknown as ReadableStreamDefaultController;
      const controller2 = { close: vi.fn() } as unknown as ReadableStreamDefaultController;

      internal.addConnection('ch-multi', controller1);
      internal.addConnection('ch-multi', controller2);

      expect(internal.activeConnections.get('ch-multi')?.size).toBe(2);
    });

    it('removeConnection 频道不存在时不应抛错', () => {
      const internal = service as unknown as {
        removeConnection: (channel: string, controller: ReadableStreamDefaultController) => void;
      };
      const controller = { close: vi.fn() } as unknown as ReadableStreamDefaultController;
      expect(() => internal.removeConnection('nonexistent', controller)).not.toThrow();
    });

    it('removeConnection controller 不匹配时应保留连接', () => {
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: ReadableStreamDefaultController; connectedAt: number }>
        >;
        removeConnection: (channel: string, controller: ReadableStreamDefaultController) => void;
      };
      const controller1 = { close: vi.fn() } as unknown as ReadableStreamDefaultController;
      const controller2 = { close: vi.fn() } as unknown as ReadableStreamDefaultController;
      internal.activeConnections.set(
        'ch-test',
        new Set([{ controller: controller1, connectedAt: Date.now() }]),
      );

      internal.removeConnection('ch-test', controller2);

      expect(internal.activeConnections.get('ch-test')?.size).toBe(1);
    });

    it('removeConnection 后连接数为 0 时应删除频道', () => {
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: ReadableStreamDefaultController; connectedAt: number }>
        >;
        removeConnection: (channel: string, controller: ReadableStreamDefaultController) => void;
      };
      const controller = { close: vi.fn() } as unknown as ReadableStreamDefaultController;
      internal.activeConnections.set(
        'ch-single',
        new Set([{ controller, connectedAt: Date.now() }]),
      );

      internal.removeConnection('ch-single', controller);

      expect(internal.activeConnections.has('ch-single')).toBe(false);
    });
  });

  describe('getActiveConnectionCount', () => {
    it('无连接时应返回 0', () => {
      expect(service.getActiveConnectionCount()).toBe(0);
    });

    it('指定频道无连接时应返回 0', () => {
      expect(service.getActiveConnectionCount('nonexistent')).toBe(0);
    });

    it('应返回指定频道的连接数', () => {
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
      };
      internal.activeConnections.set('ch-1', new Set([{}, {}]));
      expect(service.getActiveConnectionCount('ch-1')).toBe(2);
    });

    it('应返回所有频道的总连接数', () => {
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
      };
      internal.activeConnections.set('ch-1', new Set([{}]));
      internal.activeConnections.set('ch-2', new Set([{}, {}]));
      expect(service.getActiveConnectionCount()).toBe(3);
    });
  });

  describe('cleanupStaleConnections (private, via direct call)', () => {
    it('应清理超时连接并删除空频道', async () => {
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: { close: () => void }; connectedAt: number }>
        >;
        cleanupInterval: NodeJS.Timeout | null;
        cleanupStaleConnections: () => void;
        startCleanupTimer: () => void;
      };

      // 添加一个超时连接（CONNECTION_TIMEOUT_MS = 30 * 60 * 1000）
      const closeFn = vi.fn();
      const staleController = { close: closeFn };
      internal.activeConnections.set(
        'ch-stale',
        new Set([{ controller: staleController, connectedAt: Date.now() - 31 * 60 * 1000 }]),
      );

      // 调用清理
      internal.cleanupStaleConnections();

      expect(closeFn).toHaveBeenCalled();
      expect(internal.activeConnections.has('ch-stale')).toBe(false);
    });

    it('应保留未超时的连接', () => {
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: { close: () => void }; connectedAt: number }>
        >;
        cleanupStaleConnections: () => void;
      };

      const freshController = { close: vi.fn() };
      internal.activeConnections.set(
        'ch-fresh',
        new Set([{ controller: freshController, connectedAt: Date.now() }]),
      );

      internal.cleanupStaleConnections();

      expect(freshController.close).not.toHaveBeenCalled();
      expect(internal.activeConnections.has('ch-fresh')).toBe(true);
    });

    it('无连接且定时器存在时应停止定时器', () => {
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
        cleanupInterval: NodeJS.Timeout | null;
        cleanupStaleConnections: () => void;
      };

      const fakeTimer = { unref: () => {} } as unknown as NodeJS.Timeout;
      internal.cleanupInterval = fakeTimer;
      internal.activeConnections.clear();

      // 清理后应清除 cleanupInterval
      // 注意：在 fake timer 模式下，clearInterval 不会真正清除 fakeTimer 引用
      // 我们直接调用清理，由于 activeConnections.size === 0，会进入清理分支
      internal.cleanupStaleConnections();
      // 由于 activeConnections 为空，没有连接可清理，定时器引用应被清除
      expect(internal.cleanupInterval).toBeNull();
    });

    it('频道数超过 MAX_CHANNELS (5000) 时应调用 enforceChannelLimit', () => {
      const internal = service as unknown as {
        activeConnections: Map<
          string,
          Set<{ controller: { close: () => void }; connectedAt: number }>
        >;
        cleanupInterval: NodeJS.Timeout | null;
        cleanupStaleConnections: () => void;
        enforceChannelLimit: () => void;
      };
      internal.cleanupInterval = null;

      // 填充 5001 个频道，每个频道有一个活跃连接（未超时）
      const now = Date.now();
      for (let i = 0; i < 5001; i++) {
        internal.activeConnections.set(
          `ch-${i}`,
          new Set([{ controller: { close: vi.fn() }, connectedAt: now }]),
        );
      }

      const spy = vi.spyOn(internal, 'enforceChannelLimit');

      internal.cleanupStaleConnections();

      expect(spy).toHaveBeenCalled();

      internal.activeConnections.clear();
    });
  });

  describe('enforceChannelLimit (private, via direct call)', () => {
    it('频道数量超过 MAX_CHANNELS (5000) 时应清理最早的空闲频道', () => {
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
        enforceChannelLimit: () => void;
      };

      // 填充 5001 个频道，第一个为空闲频道
      for (let i = 0; i < 5001; i++) {
        internal.activeConnections.set(`ch-${i}`, new Set());
      }

      internal.enforceChannelLimit();

      // 第一个频道应被删除
      expect(internal.activeConnections.has('ch-0')).toBe(false);
      // 最后一个频道应保留
      expect(internal.activeConnections.has('ch-5000')).toBe(true);

      internal.activeConnections.clear();
    });

    it('有连接的频道不应被强制清理', () => {
      const internal = service as unknown as {
        activeConnections: Map<string, Set<unknown>>;
        enforceChannelLimit: () => void;
      };

      // 第一个频道有连接
      const connSet = new Set([{ controller: {}, connectedAt: Date.now() }]);
      internal.activeConnections.set('ch-with-conn', connSet);
      for (let i = 1; i < 5001; i++) {
        internal.activeConnections.set(`ch-${i}`, new Set());
      }

      internal.enforceChannelLimit();

      // 有连接的频道不应被删除
      expect(internal.activeConnections.has('ch-with-conn')).toBe(true);

      internal.activeConnections.clear();
    });
  });

  describe('formatSSEMessage (private, via direct call)', () => {
    const call = (msg: { id?: string; event?: string; data: string }) =>
      (service as unknown as { formatSSEMessage: (m: typeof msg) => string }).formatSSEMessage(msg);

    it('应格式化包含 id 的消息', () => {
      const result = call({ id: 'msg-1', event: 'message', data: 'hello' });
      expect(result).toBe('id: msg-1\nevent: message\ndata: hello\n\n');
    });

    it('应格式化不含 id 的消息', () => {
      const result = call({ event: 'message', data: 'hello' });
      expect(result).toBe('event: message\ndata: hello\n\n');
    });

    it('应格式化不含 event 的消息', () => {
      const result = call({ id: 'msg-2', data: 'hello' });
      expect(result).toBe('id: msg-2\ndata: hello\n\n');
    });

    it('应格式化仅含 data 的消息', () => {
      const result = call({ data: 'hello' });
      expect(result).toBe('data: hello\n\n');
    });
  });

  describe('unsubscribeFromRedis (private, via direct call)', () => {
    it('subscriber 为 null 时不应抛错', async () => {
      const internal = service as unknown as {
        unsubscribeFromRedis: (channel: string, sub: unknown) => Promise<void>;
      };
      await expect(internal.unsubscribeFromRedis('ch-1', null)).resolves.not.toThrow();
    });

    it('subscriber 有效时应调用 unsubscribe', async () => {
      const mockRedis = {
        unsubscribe: vi.fn().mockResolvedValue(undefined),
      };
      const internal = service as unknown as {
        unsubscribeFromRedis: (channel: string, sub: unknown) => Promise<void>;
      };
      await internal.unsubscribeFromRedis('ch-1', mockRedis);
      expect(mockRedis.unsubscribe).toHaveBeenCalledWith('channel:ch-1');
    });

    it('unsubscribe 抛错时应静默失败', async () => {
      const mockRedis = {
        unsubscribe: vi.fn().mockRejectedValue(new Error('fail')),
      };
      const internal = service as unknown as {
        unsubscribeFromRedis: (channel: string, sub: unknown) => Promise<void>;
      };
      await expect(internal.unsubscribeFromRedis('ch-1', mockRedis)).resolves.not.toThrow();
    });
  });

  describe('startCleanupTimer (private, via direct call)', () => {
    it('已存在定时器时不应重复创建', () => {
      const internal = service as unknown as {
        cleanupInterval: NodeJS.Timeout | null;
        startCleanupTimer: () => void;
      };
      const fakeTimer = setInterval(() => {}, 1000);
      internal.cleanupInterval = fakeTimer;

      internal.startCleanupTimer();

      expect(internal.cleanupInterval).toBe(fakeTimer);
      clearInterval(fakeTimer);
    });

    it('不存在定时器时应创建', () => {
      const internal = service as unknown as {
        cleanupInterval: NodeJS.Timeout | null;
        startCleanupTimer: () => void;
      };
      internal.cleanupInterval = null;

      internal.startCleanupTimer();

      expect(internal.cleanupInterval).not.toBeNull();
      if (internal.cleanupInterval) clearInterval(internal.cleanupInterval);
    });

    it('定时器触发时应调用 cleanupStaleConnections', () => {
      const internal = service as unknown as {
        cleanupInterval: NodeJS.Timeout | null;
        startCleanupTimer: () => void;
        cleanupStaleConnections: () => void;
      };

      const spy = vi.spyOn(internal, 'cleanupStaleConnections');

      internal.startCleanupTimer();
      // CLEANUP_INTERVAL_MS = 60000
      vi.advanceTimersByTime(60000);

      expect(spy).toHaveBeenCalled();

      if (internal.cleanupInterval) clearInterval(internal.cleanupInterval);
    });
  });
});
