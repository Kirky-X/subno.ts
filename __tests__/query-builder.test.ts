// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm operators with identifiable return values so we can verify
// the builder correctly stores and combines conditions.
vi.mock('drizzle-orm', () => {
  const mk = (op: string) => vi.fn((...args: unknown[]) => ({ op, args }));
  return {
    eq: mk('eq'),
    and: vi.fn((...conds: unknown[]) => ({ op: 'and', conds })),
    or: mk('or'),
    desc: mk('desc'),
    asc: mk('asc'),
    sql: mk('sql'),
    count: mk('count'),
    gte: mk('gte'),
    lte: mk('lte'),
    lt: mk('lt'),
    gt: mk('gt'),
    inArray: mk('inArray'),
    isNull: mk('isNull'),
    isNotNull: mk('isNotNull'),
  };
});

import { QueryBuilder } from '@/src/lib/repositories/query-builder';
import { eq, and, gt, inArray, isNull } from 'drizzle-orm';

// A stand-in column object (AnyColumn is a type only, erased at compile time).
const colA = { name: 'col_a' } as never;
const colB = { name: 'col_b' } as never;

describe('QueryBuilder', () => {
  let builder: QueryBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = new QueryBuilder();
  });

  describe('whereEqual', () => {
    it('应添加相等条件并返回 this 以支持链式调用', () => {
      const result = builder.whereEqual(colA, 'value');
      expect(result).toBe(builder);
      expect(eq).toHaveBeenCalledWith(colA, 'value');
      expect(builder.getConditionCount()).toBe(1);
    });

    it('应支持多种值类型', () => {
      builder.whereEqual(colA, 123);
      builder.whereEqual(colB, true);
      expect(eq).toHaveBeenNthCalledWith(1, colA, 123);
      expect(eq).toHaveBeenNthCalledWith(2, colB, true);
      expect(builder.getConditionCount()).toBe(2);
    });
  });

  describe('whereIn', () => {
    it('应添加 IN 条件当数组非空', () => {
      const result = builder.whereIn(colA, ['a', 'b', 'c']);
      expect(result).toBe(builder);
      expect(inArray).toHaveBeenCalledWith(colA, ['a', 'b', 'c']);
      expect(builder.getConditionCount()).toBe(1);
    });

    it('不应添加条件当数组为空', () => {
      builder.whereIn(colA, []);
      expect(inArray).not.toHaveBeenCalled();
      expect(builder.getConditionCount()).toBe(0);
    });

    it('应支持数字数组', () => {
      builder.whereIn(colB, [1, 2, 3]);
      expect(inArray).toHaveBeenCalledWith(colB, [1, 2, 3]);
    });
  });

  describe('whereIsNull', () => {
    it('应添加 IS NULL 条件', () => {
      const result = builder.whereIsNull(colA);
      expect(result).toBe(builder);
      expect(isNull).toHaveBeenCalledWith(colA);
      expect(builder.getConditionCount()).toBe(1);
    });
  });

  describe('whereGt', () => {
    it('应添加大于条件', () => {
      const result = builder.whereGt(colA, new Date('2026-01-01'));
      expect(result).toBe(builder);
      expect(gt).toHaveBeenCalledWith(colA, new Date('2026-01-01'));
      expect(builder.getConditionCount()).toBe(1);
    });

    it('应支持数字值', () => {
      builder.whereGt(colB, 100);
      expect(gt).toHaveBeenCalledWith(colB, 100);
    });
  });

  describe('whereSql', () => {
    it('应添加自定义 SQL 条件', () => {
      const customSql = { op: 'raw', sql: '1=1' } as never;
      const result = builder.whereSql(customSql);
      expect(result).toBe(builder);
      expect(builder.getConditionCount()).toBe(1);
    });
  });

  describe('build', () => {
    it('应返回 undefined 当没有条件时', () => {
      expect(builder.build()).toBeUndefined();
    });

    it('应返回单个条件当只有一个条件时', () => {
      const cond = { op: 'eq', args: [colA, 'x'] };
      vi.mocked(eq).mockReturnValueOnce(cond as never);
      builder.whereEqual(colA, 'x');

      const result = builder.build();
      expect(result).toBe(cond);
      expect(and).not.toHaveBeenCalled();
    });

    it('应用 and 组合多个条件', () => {
      const cond1 = { op: 'eq', args: [colA, 'x'] };
      const cond2 = { op: 'isNull', args: [colB] };
      vi.mocked(eq).mockReturnValueOnce(cond1 as never);
      vi.mocked(isNull).mockReturnValueOnce(cond2 as never);
      builder.whereEqual(colA, 'x').whereIsNull(colB);

      const result = builder.build();
      expect(and).toHaveBeenCalledWith(cond1, cond2);
      expect(result).toEqual({ op: 'and', conds: [cond1, cond2] });
    });

    it('应组合三个以上条件', () => {
      const c1 = { op: 'eq', n: 1 } as never;
      const c2 = { op: 'gt', n: 2 } as never;
      const c3 = { op: 'isNull', n: 3 } as never;
      vi.mocked(eq).mockReturnValueOnce(c1);
      vi.mocked(gt).mockReturnValueOnce(c2);
      vi.mocked(isNull).mockReturnValueOnce(c3);
      builder.whereEqual(colA, 1).whereGt(colB, 2).whereIsNull(colA);

      builder.build();
      expect(and).toHaveBeenCalledWith(c1, c2, c3);
    });

    it('应在 whereIn 空数组跳过后仍正确构建', () => {
      const cond = { op: 'eq', args: [colA, 'x'] };
      vi.mocked(eq).mockReturnValueOnce(cond as never);
      builder.whereIn(colA, []).whereEqual(colA, 'x');

      const result = builder.build();
      expect(result).toBe(cond);
      expect(builder.getConditionCount()).toBe(1);
    });
  });

  describe('getConditionCount', () => {
    it('初始应为 0', () => {
      expect(builder.getConditionCount()).toBe(0);
    });

    it('应反映添加的条件数量', () => {
      builder.whereEqual(colA, 1).whereIsNull(colB).whereGt(colA, 0);
      expect(builder.getConditionCount()).toBe(3);
    });
  });

  describe('clear', () => {
    it('应清空所有条件', () => {
      builder.whereEqual(colA, 'x').whereIsNull(colB);
      expect(builder.getConditionCount()).toBe(2);

      builder.clear();
      expect(builder.getConditionCount()).toBe(0);
      expect(builder.build()).toBeUndefined();
    });

    it('清空后可继续添加条件', () => {
      builder.whereEqual(colA, 'x');
      builder.clear();

      const cond = { op: 'isNull', args: [colB] };
      vi.mocked(isNull).mockReturnValueOnce(cond as never);
      builder.whereIsNull(colB);

      expect(builder.getConditionCount()).toBe(1);
      expect(builder.build()).toBe(cond);
    });
  });

  describe('集成场景（链式调用）', () => {
    it('应支持完整的链式构建流程', () => {
      const c1 = { op: 'eq', n: 1 } as never;
      const c2 = { op: 'isNull', n: 2 } as never;
      const c3 = { op: 'gt', n: 3 } as never;
      vi.mocked(eq).mockReturnValueOnce(c1);
      vi.mocked(isNull).mockReturnValueOnce(c2);
      vi.mocked(gt).mockReturnValueOnce(c3);

      const result = builder
        .whereEqual(colA, 'user-1')
        .whereIsNull(colB)
        .whereGt(colA, new Date())
        .build();

      expect(builder.getConditionCount()).toBe(3);
      expect(and).toHaveBeenCalledWith(c1, c2, c3);
      expect(result).toEqual({ op: 'and', conds: [c1, c2, c3] });
    });
  });
});
