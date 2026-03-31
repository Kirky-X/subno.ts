// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { env } from '../config/env';

/**
 * 运行环境枚举
 */
export enum NodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  FATAL = 'fatal',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

/**
 * 检查是否在生产环境
 * @returns 如果在中生产环境返回 true
 */
export function isProduction(): boolean {
  const e = env as unknown as { NODE_ENV: string };
  return e.NODE_ENV === NodeEnv.PRODUCTION;
}

/**
 * 检查是否在开发环境
 * @returns 如果在开发环境返回 true
 */
export function isDevelopment(): boolean {
  const e = env as unknown as { NODE_ENV: string };
  return e.NODE_ENV === NodeEnv.DEVELOPMENT;
}

/**
 * 检查是否在测试环境
 * @returns 如果在测试环境返回 true
 */
export function isTest(): boolean {
  const e = env as unknown as { NODE_ENV: string };
  return e.NODE_ENV === NodeEnv.TEST;
}

/**
 * 检查是否应该记录指定级别的日志
 * @param level - 日志级别
 * @returns 如果应该记录返回 true
 */
export function shouldLog(level: LogLevel): boolean {
  const e = env as unknown as { LOG_LEVEL: LogLevel };
  const currentLevel = e.LOG_LEVEL;
  const levels = [
    LogLevel.FATAL,
    LogLevel.ERROR,
    LogLevel.WARN,
    LogLevel.INFO,
    LogLevel.DEBUG,
    LogLevel.TRACE,
  ];
  return levels.indexOf(level) <= levels.indexOf(currentLevel);
}

/**
 * 获取日志级别的数值（用于比较）
 * @param level - 日志级别
 * @returns 数值，越小越严重
 */
export function getLogLevelValue(level: LogLevel): number {
  const values: Record<LogLevel, number> = {
    [LogLevel.FATAL]: 0,
    [LogLevel.ERROR]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.INFO]: 3,
    [LogLevel.DEBUG]: 4,
    [LogLevel.TRACE]: 5,
  };
  return values[level] ?? 999;
}
