// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Options for list queries
 */
export interface ListOptions {
  /** Maximum number of items to return */
  limit?: number;
  /** Number of items to skip for pagination */
  offset?: number;
}

/**
 * Build a query object for list operations
 * @param options - List options with limit and offset
 * @returns Query object with only defined values
 */
export function buildListQuery(options?: ListOptions): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (options?.limit !== undefined) {
    query['limit'] = options.limit;
  }
  if (options?.offset !== undefined) {
    query['offset'] = options.offset;
  }
  return query;
}

/**
 * Build a query object by filtering out undefined and null values
 * @param options - Object containing query parameters
 * @returns Query object with only defined and non-null values
 */
export function buildFilteredQuery(options: Record<string, unknown>): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) {
      query[key] = value;
    }
  }
  return query;
}
