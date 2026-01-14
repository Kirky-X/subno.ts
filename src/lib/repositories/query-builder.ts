// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { SQL, and, eq, gt, inArray, isNull, AnyColumn } from 'drizzle-orm';

/**
 * Unified query builder for repository operations
 * Reduces duplicate condition building logic
 */
export class QueryBuilder<T> {
  private conditions: SQL[] = [];

  /**
   * Add equality condition
   */
  whereEqual(column: AnyColumn, value: unknown): this {
    this.conditions.push(eq(column, value));
    return this;
  }

  /**
   * Add IN condition
   */
  whereIn(column: AnyColumn, values: unknown[]): this {
    if (values.length > 0) {
      this.conditions.push(inArray(column, values));
    }
    return this;
  }

  /**
   * Add IS NULL condition
   */
  whereIsNull(column: AnyColumn): this {
    this.conditions.push(isNull(column));
    return this;
  }

  /**
   * Add greater than condition
   */
  whereGt(column: AnyColumn, value: unknown): this {
    this.conditions.push(gt(column, value));
    return this;
  }

  /**
   * Add custom SQL condition
   */
  whereSql(sql: SQL): this {
    this.conditions.push(sql);
    return this;
  }

  /**
   * Build the final SQL condition
   * Returns undefined if no conditions were added
   */
  build(): SQL | undefined {
    if (this.conditions.length === 0) {
      return undefined;
    }
    if (this.conditions.length === 1) {
      return this.conditions[0];
    }
    return and(...this.conditions);
  }

  /**
   * Get the number of conditions
   */
  getConditionCount(): number {
    return this.conditions.length;
  }

  /**
   * Clear all conditions
   */
  clear(): void {
    this.conditions = [];
  }
}

/**
 * Create a new query builder instance
 */
export function createQueryBuilder<T>(): QueryBuilder<T> {
  return new QueryBuilder<T>();
}
