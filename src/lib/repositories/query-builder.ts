// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { SQL, and, eq, gt, inArray, isNull, AnyColumn } from 'drizzle-orm';

export class QueryBuilder {
  private conditions: SQL[] = [];

  whereEqual(column: AnyColumn, value: unknown): this {
    this.conditions.push(eq(column, value));
    return this;
  }

  whereIn(column: AnyColumn, values: unknown[]): this {
    if (values.length > 0) {
      this.conditions.push(inArray(column, values));
    }
    return this;
  }

  whereIsNull(column: AnyColumn): this {
    this.conditions.push(isNull(column));
    return this;
  }

  whereGt(column: AnyColumn, value: unknown): this {
    this.conditions.push(gt(column, value));
    return this;
  }

  whereSql(sql: SQL): this {
    this.conditions.push(sql);
    return this;
  }

  // Returns undefined if no conditions were added
  build(): SQL | undefined {
    if (this.conditions.length === 0) {
      return undefined;
    }
    if (this.conditions.length === 1) {
      return this.conditions[0];
    }
    return and(...this.conditions);
  }

  getConditionCount(): number {
    return this.conditions.length;
  }

  clear(): void {
    this.conditions = [];
  }
}

export function createQueryBuilder(): QueryBuilder {
  return new QueryBuilder();
}
