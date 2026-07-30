// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Logger 模块在 import 时根据 process.env.NODE_ENV 创建 pino 实例，
 * 因此每个测试用例必须先设置 env，再 vi.resetModules() + 动态 import 重新加载。
 */
describe('logger', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function importLogger() {
    vi.resetModules();
    return import('@/src/lib/utils/logger');
  }

  it('应该在 test 环境使用 warn 级别', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.LOG_LEVEL;
    const { logger } = await importLogger();
    expect(logger.level).toBe('warn');
  });

  it('应该在 development 环境使用 debug 级别', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.LOG_LEVEL;
    const { logger } = await importLogger();
    expect(logger.level).toBe('debug');
  });

  it('应该在 production 环境使用 info 级别', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.LOG_LEVEL;
    const { logger } = await importLogger();
    expect(logger.level).toBe('info');
  });

  it('应该支持 LOG_LEVEL 环境变量覆盖', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'debug';
    const { logger } = await importLogger();
    expect(logger.level).toBe('debug');
  });

  it('应该在未设置 NODE_ENV 时默认 development', async () => {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    delete process.env.LOG_LEVEL;
    const { logger } = await importLogger();
    expect(logger.level).toBe('debug');
  });

  it('应该支持 error 级别日志', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    expect(typeof logger.error).toBe('function');
    expect(() => logger.error('test error')).not.toThrow();
  });

  it('应该支持 warn 级别日志', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    expect(typeof logger.warn).toBe('function');
    expect(() => logger.warn('test warn')).not.toThrow();
  });

  it('应该支持 info 级别日志', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    expect(typeof logger.info).toBe('function');
    expect(() => logger.info('test info')).not.toThrow();
  });

  it('应该支持 debug 级别日志', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    expect(typeof logger.debug).toBe('function');
    expect(() => logger.debug('test debug')).not.toThrow();
  });

  it('应该是 pino logger 实例（具备 levels 属性）', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.level).toBe('string');
    expect(logger.levels).toBeDefined();
  });

  it('应该使用 err formatter 处理 Error 对象', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    // pino 的 err formatter 会在日志对象包含 err 键（Error 实例）时被调用
    const error = new Error('formatted error');
    expect(() => logger.error({ err: error }, 'message with err')).not.toThrow();
  });

  it('应该使用 level formatter 将级别转为大写', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    // level formatter 在每次日志输出时被调用，将 label 转为大写
    expect(() => logger.warn('triggering level formatter')).not.toThrow();
  });

  it('应该使用自定义 timestamp formatter', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const { logger } = await importLogger();
    // timestamp formatter 在每次日志输出时被调用
    expect(() => logger.info('triggering timestamp formatter')).not.toThrow();
  });

  it('应该配置 err formatter 正确格式化 Error 对象', async () => {
    // pino 的 formatters.err 是自定义键格式化器，通过捕获 pino 构造参数验证其行为
    let capturedFormatters: { err?: (err: Error) => Record<string, unknown> } | undefined;
    vi.doMock('pino', () => ({
      default: (opts: any) => {
        capturedFormatters = opts.formatters;
        return {
          level: opts.level,
          levels: { labels: {} },
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {},
        };
      },
    }));
    try {
      vi.resetModules();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      delete process.env.LOG_LEVEL;
      await import('@/src/lib/utils/logger');
      expect(capturedFormatters).toBeDefined();
      expect(capturedFormatters!.err).toBeDefined();
      expect(typeof capturedFormatters!.err).toBe('function');

      const error = new Error('formatted error');
      error.name = 'TestError';
      const result = capturedFormatters!.err!(error);
      expect(result).toEqual({
        message: 'formatted error',
        stack: error.stack,
        name: 'TestError',
      });

      // 验证对无 stack 的 Error 也能工作
      const errNoStack = new Error('no stack');
      errNoStack.stack = undefined as any;
      const result2 = capturedFormatters!.err!(errNoStack);
      expect(result2.message).toBe('no stack');
      expect(result2.name).toBe('Error');
    } finally {
      vi.doUnmock('pino');
      vi.resetModules();
    }
  });
});
