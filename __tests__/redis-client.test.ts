// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * RedisClientManager 使用 IIFE 模式封装私有状态，模块 import 时即创建单例。
 * 每个测试用例必须 vi.resetModules() + 动态 import 重新加载模块，以重置内部状态。
 * redis 模块通过 vi.mock 替换为可控的 mock。
 */

// mock redis 模块工厂 —— 每个测试通过 mockGetClientImpl 自定义行为
let mockClientImpl: () => any = () => createMockRedisClient();

function createMockRedisClient() {
  const handlers: Record<string, ((...args: any[]) => void)[]> = {};
  const client = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return client;
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    // 测试辅助方法：触发事件
    __emit(event: string, ...args: any[]) {
      (handlers[event] || []).forEach(h => h(...args));
    },
    __handlers: handlers,
  };
  return client;
}

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockClientImpl()),
}));

describe('RedisClientManager', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockClientImpl = () => createMockRedisClient();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function importRedisClient() {
    vi.resetModules();
    return import('@/src/lib/utils/redis-client');
  }

  describe('getClient', () => {
    it('应该在无 REDIS_URL 时返回 null', async () => {
      delete process.env.REDIS_URL;
      const { RedisClientManager } = await importRedisClient();
      const client = await RedisClientManager.getClient();
      expect(client).toBeNull();
    });

    it('应该在有 REDIS_URL 时创建并连接客户端', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const client = await RedisClientManager.getClient();
      expect(client).not.toBeNull();
      expect(client!.connect).toHaveBeenCalledTimes(1);
    });

    it('应该在第二次调用时返回已缓存的客户端（不重新连接）', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const client1 = await RedisClientManager.getClient();
      const client2 = await RedisClientManager.getClient();
      expect(client1).toBe(client2);
      expect(client1!.connect).toHaveBeenCalledTimes(1);
    });

    it('应该等待进行中的连接完成后返回相同客户端', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      // 并发调用两次，应该共享同一个 connectionPromise
      const [client1, client2] = await Promise.all([
        RedisClientManager.getClient(),
        RedisClientManager.getClient(),
      ]);
      expect(client1).toBe(client2);
      expect(client1!.connect).toHaveBeenCalledTimes(1);
    });

    it('应该在 client error 事件触发时重置状态', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { RedisClientManager } = await importRedisClient();
      const client = await RedisClientManager.getClient();
      // 触发 error 事件
      (client! as any).__emit('error', new Error('connection lost'));
      expect(errorSpy).toHaveBeenCalledWith('Redis client error:', expect.any(Error));
      // 下次调用应该重新创建客户端
      const newClient = await RedisClientManager.getClient();
      expect(newClient).not.toBe(client);
      expect(newClient!.connect).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });

    it('应该在连接失败时抛出错误（connectionPromise reject）', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // 自定义实现：connect 抛出错误
      mockClientImpl = () => {
        const c = createMockRedisClient();
        c.connect = vi.fn().mockRejectedValue(new Error('connect failed'));
        return c;
      };
      const { RedisClientManager } = await importRedisClient();
      await expect(RedisClientManager.getClient()).rejects.toThrow('connect failed');
      errorSpy.mockRestore();
    });
  });

  describe('getSubscriber', () => {
    it('应该在无 REDIS_URL 时返回 null', async () => {
      delete process.env.REDIS_URL;
      const { RedisClientManager } = await importRedisClient();
      const subscriber = await RedisClientManager.getSubscriber();
      expect(subscriber).toBeNull();
    });

    it('应该在有 REDIS_URL 时创建并连接订阅者', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const subscriber = await RedisClientManager.getSubscriber();
      expect(subscriber).not.toBeNull();
      expect(subscriber!.connect).toHaveBeenCalledTimes(1);
    });

    it('应该在第二次调用时返回已缓存的订阅者', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const sub1 = await RedisClientManager.getSubscriber();
      const sub2 = await RedisClientManager.getSubscriber();
      expect(sub1).toBe(sub2);
      expect(sub1!.connect).toHaveBeenCalledTimes(1);
    });

    it('应该等待进行中的连接完成后返回相同订阅者', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const [sub1, sub2] = await Promise.all([
        RedisClientManager.getSubscriber(),
        RedisClientManager.getSubscriber(),
      ]);
      expect(sub1).toBe(sub2);
    });

    it('应该在 subscriber error 事件触发时重置状态', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { RedisClientManager } = await importRedisClient();
      const subscriber = await RedisClientManager.getSubscriber();
      (subscriber! as any).__emit('error', new Error('subscriber error'));
      expect(errorSpy).toHaveBeenCalledWith('Redis subscriber error:', expect.any(Error));
      const newSubscriber = await RedisClientManager.getSubscriber();
      expect(newSubscriber).not.toBe(subscriber);
      errorSpy.mockRestore();
    });
  });

  describe('getClient 与 getSubscriber 独立性', () => {
    it('应该返回不同的客户端实例', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const client = await RedisClientManager.getClient();
      const subscriber = await RedisClientManager.getSubscriber();
      expect(client).not.toBe(subscriber);
    });
  });

  describe('closeAll', () => {
    it('应该在无连接时安全调用（无操作）', async () => {
      delete process.env.REDIS_URL;
      const { RedisClientManager } = await importRedisClient();
      await expect(RedisClientManager.closeAll()).resolves.toBeUndefined();
    });

    it('应该关闭已连接的客户端', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const client = await RedisClientManager.getClient();
      await RedisClientManager.closeAll();
      expect(client!.quit).toHaveBeenCalledTimes(1);
    });

    it('应该关闭已连接的订阅者', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const subscriber = await RedisClientManager.getSubscriber();
      await RedisClientManager.closeAll();
      expect(subscriber!.quit).toHaveBeenCalledTimes(1);
    });

    it('应该同时关闭客户端和订阅者', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const client = await RedisClientManager.getClient();
      const subscriber = await RedisClientManager.getSubscriber();
      await RedisClientManager.closeAll();
      expect(client!.quit).toHaveBeenCalledTimes(1);
      expect(subscriber!.quit).toHaveBeenCalledTimes(1);
    });

    it('关闭后应该允许重新创建客户端', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager } = await importRedisClient();
      const client1 = await RedisClientManager.getClient();
      await RedisClientManager.closeAll();
      const client2 = await RedisClientManager.getClient();
      expect(client2).not.toBe(client1);
      expect(client2!.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('向后兼容导出', () => {
    it('getRedisClient 应该等同于 RedisClientManager.getClient', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager, getRedisClient } = await importRedisClient();
      const client = await getRedisClient();
      const managerClient = await RedisClientManager.getClient();
      expect(client).toBe(managerClient);
    });

    it('getRedisSubscriber 应该等同于 RedisClientManager.getSubscriber', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { RedisClientManager, getRedisSubscriber } = await importRedisClient();
      const subscriber = await getRedisSubscriber();
      const managerSubscriber = await RedisClientManager.getSubscriber();
      expect(subscriber).toBe(managerSubscriber);
    });

    it('closeRedisClient 应该等同于 RedisClientManager.closeAll', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { closeRedisClient } = await importRedisClient();
      // 只验证不抛出错误
      await expect(closeRedisClient()).resolves.toBeUndefined();
    });
  });

  describe('Object.freeze 保护', () => {
    it('RedisClientManager 应该被冻结', async () => {
      const { RedisClientManager } = await importRedisClient();
      expect(Object.isFrozen(RedisClientManager)).toBe(true);
    });

    it('应该只暴露 getClient, getSubscriber, closeAll 三个方法', async () => {
      const { RedisClientManager } = await importRedisClient();
      const keys = Object.keys(RedisClientManager).sort();
      expect(keys).toEqual(['closeAll', 'getClient', 'getSubscriber']);
    });
  });
});
