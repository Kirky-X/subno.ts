// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatISODate,
  formatHumanReadableDate,
  getRelativeTime,
  isPast,
  isFuture,
  isWithinRange,
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  startOfDay,
  endOfDay,
  parseISODate,
  getTimeDifference,
  sleep,
  debounce,
  throttle,
} from '@/src/lib/utils/datetime';

describe('datetime utils', () => {
  describe('formatISODate', () => {
    it('应该去除毫秒部分并以 Z 结尾', () => {
      const date = new Date('2026-03-31T14:30:00.123Z');
      expect(formatISODate(date)).toBe('2026-03-31T14:30:00Z');
    });

    it('应该处理无毫秒的日期', () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      expect(formatISODate(date)).toBe('2026-01-01T00:00:00Z');
    });

    it('应该使用默认参数（当前时间）', () => {
      const result = formatISODate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });
  });

  describe('formatHumanReadableDate', () => {
    it('应该返回人类可读格式', () => {
      const date = new Date('2026-03-31T14:30:00.000Z');
      expect(formatHumanReadableDate(date)).toBe('2026-03-31 14:30:00.000 UTC');
    });

    it('应该使用默认参数', () => {
      const result = formatHumanReadableDate();
      expect(result).toMatch(/ UTC$/);
      expect(result).toContain(' ');
    });
  });

  describe('getRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该返回过去的秒数', () => {
      const date = new Date('2026-03-31T11:59:35.000Z'); // 25 秒前
      expect(getRelativeTime(date)).toBe('25秒前');
    });

    it('应该返回未来的秒数', () => {
      const date = new Date('2026-03-31T12:00:40.000Z'); // 40 秒后
      expect(getRelativeTime(date)).toBe('40秒后');
    });

    it('应该返回过去的分钟数', () => {
      const date = new Date('2026-03-31T11:55:00.000Z'); // 5 分钟前
      expect(getRelativeTime(date)).toBe('5分钟前');
    });

    it('应该返回未来的分钟数', () => {
      const date = new Date('2026-03-31T12:05:00.000Z'); // 5 分钟后
      expect(getRelativeTime(date)).toBe('5分钟后');
    });

    it('应该返回过去的小时数', () => {
      const date = new Date('2026-03-31T10:00:00.000Z'); // 2 小时前
      expect(getRelativeTime(date)).toBe('2小时前');
    });

    it('应该返回未来的小时数', () => {
      const date = new Date('2026-03-31T14:00:00.000Z'); // 2 小时后
      expect(getRelativeTime(date)).toBe('2小时后');
    });

    it('应该返回过去的天数', () => {
      const date = new Date('2026-03-29T12:00:00.000Z'); // 2 天前
      expect(getRelativeTime(date)).toBe('2天前');
    });

    it('应该返回未来的天数', () => {
      const date = new Date('2026-04-02T12:00:00.000Z'); // 2 天后
      expect(getRelativeTime(date)).toBe('2天后');
    });
  });

  describe('isPast / isFuture', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('isPast 应该返回 true 对于过去日期', () => {
      expect(isPast(new Date('2026-03-31T11:00:00.000Z'))).toBe(true);
    });

    it('isPast 应该返回 false 对于未来日期', () => {
      expect(isPast(new Date('2026-03-31T13:00:00.000Z'))).toBe(false);
    });

    it('isFuture 应该返回 true 对于未来日期', () => {
      expect(isFuture(new Date('2026-03-31T13:00:00.000Z'))).toBe(true);
    });

    it('isFuture 应该返回 false 对于过去日期', () => {
      expect(isFuture(new Date('2026-03-31T11:00:00.000Z'))).toBe(false);
    });
  });

  describe('isWithinRange', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该返回 true 当日期在范围内', () => {
      const date = new Date('2026-03-31T11:59:30.000Z'); // 30 秒前
      expect(isWithinRange(date, 60_000)).toBe(true);
    });

    it('应该返回 false 当日期超出范围', () => {
      const date = new Date('2026-03-31T11:58:00.000Z'); // 2 分钟前
      expect(isWithinRange(date, 60_000)).toBe(false);
    });

    it('应该处理未来日期', () => {
      const date = new Date('2026-03-31T12:00:30.000Z'); // 30 秒后
      expect(isWithinRange(date, 60_000)).toBe(true);
    });

    it('应该在边界值时返回 true', () => {
      const date = new Date('2026-03-31T12:01:00.000Z'); // 刚好 60 秒后
      expect(isWithinRange(date, 60_000)).toBe(true);
    });
  });

  describe('addSeconds / addMinutes / addHours / addDays', () => {
    const base = new Date('2026-03-31T12:00:00.000Z');

    it('addSeconds 应该增加秒数', () => {
      expect(addSeconds(base, 30)).toEqual(new Date('2026-03-31T12:00:30.000Z'));
    });

    it('addSeconds 应该处理负数', () => {
      expect(addSeconds(base, -30)).toEqual(new Date('2026-03-31T11:59:30.000Z'));
    });

    it('addMinutes 应该增加分钟数', () => {
      expect(addMinutes(base, 15)).toEqual(new Date('2026-03-31T12:15:00.000Z'));
    });

    it('addMinutes 应该处理负数', () => {
      expect(addMinutes(base, -15)).toEqual(new Date('2026-03-31T11:45:00.000Z'));
    });

    it('addHours 应该增加小时数', () => {
      expect(addHours(base, 2)).toEqual(new Date('2026-03-31T14:00:00.000Z'));
    });

    it('addHours 应该处理负数', () => {
      expect(addHours(base, -2)).toEqual(new Date('2026-03-31T10:00:00.000Z'));
    });

    it('addDays 应该增加天数', () => {
      expect(addDays(base, 5)).toEqual(new Date('2026-04-05T12:00:00.000Z'));
    });

    it('addDays 应该处理负数', () => {
      expect(addDays(base, -5)).toEqual(new Date('2026-03-26T12:00:00.000Z'));
    });

    it('应该不修改原始日期', () => {
      addSeconds(base, 30);
      expect(base).toEqual(new Date('2026-03-31T12:00:00.000Z'));
    });
  });

  describe('startOfDay / endOfDay', () => {
    it('startOfDay 应该返回午夜时间', () => {
      const date = new Date('2026-03-31T14:30:45.123Z');
      const start = startOfDay(date);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('endOfDay 应该返回 23:59:59.999', () => {
      const date = new Date('2026-03-31T14:30:45.123Z');
      const end = endOfDay(date);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });

    it('startOfDay 应该使用默认参数', () => {
      const start = startOfDay();
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    });

    it('endOfDay 应该使用默认参数', () => {
      const end = endOfDay();
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });

    it('应该不修改原始日期', () => {
      const date = new Date('2026-03-31T14:30:45.123Z');
      const originalHours = date.getHours();
      startOfDay(date);
      expect(date.getHours()).toBe(originalHours);
    });
  });

  describe('parseISODate', () => {
    it('应该解析合法 ISO 字符串', () => {
      const result = parseISODate('2026-03-31T14:30:00.000Z');
      expect(result).toEqual(new Date('2026-03-31T14:30:00.000Z'));
    });

    it('应该对非法字符串返回 null', () => {
      expect(parseISODate('invalid-date')).toBeNull();
    });

    it('应该对空字符串返回 null', () => {
      expect(parseISODate('')).toBeNull();
    });

    it('应该在 Date 构造抛出异常时返回 null（防御性 catch）', () => {
      // 构造一个 Symbol.toPrimitive 会抛出的对象，使 new Date(obj) 抛出
      const throwingObj = {
        [Symbol.toPrimitive]() {
          throw new Error('cannot convert');
        },
      };
      expect(parseISODate(throwingObj as any)).toBeNull();
    });
  });

  describe('getTimeDifference', () => {
    it('应该计算两个日期的差值（正向）', () => {
      const from = new Date('2026-03-31T12:00:00.000Z');
      const to = new Date('2026-04-02T14:30:45.500Z'); // 2天2小时30分45.5秒
      const diff = getTimeDifference(from, to);
      expect(diff.days).toBe(2);
      expect(diff.hours).toBe(2);
      expect(diff.minutes).toBe(30);
      expect(diff.seconds).toBe(45);
      expect(diff.milliseconds).toBe(500);
    });

    it('应该计算反向差值（取绝对值）', () => {
      const from = new Date('2026-04-02T14:30:45.500Z');
      const to = new Date('2026-03-31T12:00:00.000Z');
      const diff = getTimeDifference(from, to);
      expect(diff.days).toBe(2);
      expect(diff.hours).toBe(2);
      expect(diff.minutes).toBe(30);
      expect(diff.seconds).toBe(45);
    });

    it('应该使用默认 to 参数（当前时间）', () => {
      const from = new Date(Date.now() - 5000);
      const diff = getTimeDifference(from);
      expect(diff.seconds).toBeGreaterThanOrEqual(4);
    });

    it('应该计算月份和年份（近似）', () => {
      const from = new Date('2024-01-01T00:00:00.000Z');
      const to = new Date('2026-04-01T00:00:00.000Z'); // ~2年3月
      const diff = getTimeDifference(from, to);
      expect(diff.years).toBeGreaterThanOrEqual(2);
      expect(diff.months).toBeGreaterThanOrEqual(2);
    });

    it('应该处理相同日期（差值为 0）', () => {
      const date = new Date('2026-03-31T12:00:00.000Z');
      const diff = getTimeDifference(date, date);
      expect(diff.milliseconds).toBe(0);
      expect(diff.seconds).toBe(0);
      expect(diff.minutes).toBe(0);
    });
  });

  describe('sleep', () => {
    it('应该等待指定毫秒', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('应该返回 Promise', () => {
      expect(sleep(0)).toBeInstanceOf(Promise);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在等待后调用函数', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在多次调用时只调用最后一次', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      debounced();
      debounced();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在重新调用时重置计时器', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该传递参数', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced('a', 'b');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该立即调用第一次', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在节流期间不调用', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      throttled();
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在节流结束后允许再次调用', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      throttled();
      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('应该保持 this 上下文', () => {
      const obj = {
        value: 42,
        captured: 0 as number,
        method: function (this: any) {
          this.captured = this.value;
        },
      };
      const throttled = throttle(obj.method, 100);
      throttled.call(obj);
      expect(obj.captured).toBe(42);
    });

    it('应该传递参数', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      throttled('x', 'y');
      expect(fn).toHaveBeenCalledWith('x', 'y');
    });
  });
});
