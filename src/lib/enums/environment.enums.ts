// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { env } from '../config/env';

export enum NodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum LogLevel {
  FATAL = 'fatal',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

export function isProduction(): boolean {
  const e = env as unknown as { NODE_ENV: string };
  return e.NODE_ENV === NodeEnv.PRODUCTION;
}

export function isDevelopment(): boolean {
  const e = env as unknown as { NODE_ENV: string };
  return e.NODE_ENV === NodeEnv.DEVELOPMENT;
}

export function isTest(): boolean {
  const e = env as unknown as { NODE_ENV: string };
  return e.NODE_ENV === NodeEnv.TEST;
}

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
