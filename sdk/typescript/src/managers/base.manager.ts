// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { HttpClient } from '../utils/http.js';
import { requireId, requireApiKey } from '../utils/validation.js';
import { buildListQuery, buildFilteredQuery } from '../utils/query-builder.js';

/**
 * Base manager class providing common functionality for all managers
 */
export abstract class BaseManager {
  /**
   * Create a new base manager
   * @param http - The HTTP client for making API requests
   */
  constructor(protected http: HttpClient) {}

  /**
   * Require that a string value is defined and not empty
   * @param value - The string value to check
   * @param name - The name of the value for error messages
   * @returns The string value if defined and not empty
   * @throws SecureNotifyError if value is undefined, null, or empty
   */
  protected requireId(value: string, name: string = "id"): string {
    return requireId(value, name);
  }

  /**
   * Require that an API key is configured on the HTTP client
   * @throws SecureNotifyError if no API key is configured
   */
  protected requireApiKey(): void {
    requireApiKey(this.http);
  }

  /**
   * Build a query object for list operations
   * @param options - List options with limit and offset
   * @returns Query object with only defined values
   */
  protected buildListQuery(options?: { limit?: number; offset?: number }): Record<string, unknown> {
    return buildListQuery(options);
  }

  /**
   * Build a query object by filtering out undefined and null values
   * @param options - Object containing query parameters
   * @returns Query object with only defined and non-null values
   */
  protected buildFilteredQuery(options: Record<string, unknown>): Record<string, unknown> {
    return buildFilteredQuery(options);
  }
}
