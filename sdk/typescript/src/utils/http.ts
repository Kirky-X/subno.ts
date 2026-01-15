// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  SuccessResponse,
  ErrorResponse,
  ClientOptions,
  RetryOptions,
} from "../types/api.js";
import { SecureNotifyError } from "../types/errors.js";
import { withRetry, type RetryConfig } from "./retry.js";
import { MetricsCollector, MetricsContext } from "./metrics.js";
import { ResponseCache } from "./cache.js";
import { RequestDeduplicator } from "./requestDeduplicator.js";

// Import Agent for Node.js SSL/TLS configuration
let Agent: any;
try {
  Agent = require("undici").Agent;
} catch {
  // undici not available, will use default fetch
}

/**
 * HTTP method types
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * HTTP headers interface
 */
export interface HttpHeaders {
  [key: string]: string;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: HttpHeaders;
  timeout?: number;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  headers: HttpHeaders;
  timestamp: string;
}

/**
 * HTTP client for SecureNotify API
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly apiKeyId: string | undefined;
  private readonly defaultTimeout: number;
  private readonly retryConfig: RetryConfig | undefined;
  private readonly metricsCollector: MetricsCollector | undefined;
  private readonly cache: ResponseCache | undefined;
  private readonly requestDeduplicator: RequestDeduplicator | undefined;
  private readonly enableDeduplication: boolean;

  /**
   * Create a new HTTP client
   */
  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:3000/api";
    this.apiKey = options.apiKey;
    this.apiKeyId = options.apiKeyId;
    this.defaultTimeout = options.timeout ?? 30000;
    this.retryConfig = options.retry;
    this.metricsCollector = options.enableMetrics ? new MetricsCollector(1000) : undefined;
    this.cache = options.enableCache ? new ResponseCache(60, 1000) : undefined;
    this.enableDeduplication = options.enableDeduplication ?? false;
    this.requestDeduplicator = this.enableDeduplication ? new RequestDeduplicator({ ttlSeconds: 5.0 }) : undefined;
  }

  /**
   * Get the API key for authentication
   */
  private getApiKey(): string | undefined {
    return this.apiKey;
  }

  /**
   * Get the API key ID for authentication
   */
  private getApiKeyId(): string | undefined {
    return this.apiKeyId;
  }

  /**
   * Build the full URL for a request
   */
  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Serialize request body to JSON
   */
  private serializeBody(body: unknown): string | undefined {
    if (body === undefined || body === null) {
      return undefined;
    }
    try {
      return JSON.stringify(body);
    } catch {
      throw SecureNotifyError.serialization("Failed to serialize request body");
    }
  }

  /**
   * Parse JSON response safely
   */
  private parseResponse<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw SecureNotifyError.deserialization("Failed to parse response body");
    }
  }

  /**
   * Parse response headers
   */
  private parseHeaders(headers: Headers): HttpHeaders {
    const result: HttpHeaders = {};
    for (const [key, value] of headers.entries()) {
      result[key.toLowerCase()] = value;
    }
    return result;
  }

  /**
   * Build request headers
   */
  private buildHeaders(additionalHeaders?: HttpHeaders): HttpHeaders {
    const headers: HttpHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "SecureNotify-TypeScript/0.1.0",  // Add User-Agent header
    };

    // Add API key authentication if available
    const apiKey = this.getApiKey();
    const apiKeyId = this.getApiKeyId();

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }
    if (apiKeyId) {
      headers["X-API-Key-Id"] = apiKeyId;
    }

    // Merge additional headers
    if (additionalHeaders) {
      for (const [key, value] of Object.entries(additionalHeaders)) {
        headers[key.toLowerCase()] = value;
      }
    }

    return headers;
  }

  /**
   * Execute an HTTP request
   */
  async request<T>(
    options: HttpRequestOptions,
    retryOptions?: RetryOptions
  ): Promise<HttpResponse<T>> {
    // Merge retry options: explicit options > client config > default
    const finalRetryConfig: RetryConfig = retryOptions ?? this.retryConfig ?? {};

    // Apply request deduplication if enabled (PERFORMANCE FIX)
    const executeRequest = async () => {
      const result = await withRetry(async () => {
        return await this.executeRequest<T>(options);
      }, finalRetryConfig);

      if (!result.success) {
        throw result.error;
      }

      return result.data;
    };

    if (this.enableDeduplication && this.requestDeduplicator) {
      // Use deduplicator for all requests
      const dedupKey = `${options.method ?? "GET"}:${options.path}`;
      const dedupParams = { ...(options.body as Record<string, any> || {}), ...(options.query || {}) };
      return await this.requestDeduplicator.execute(
        dedupKey,
        dedupParams,
        executeRequest,
        options.method === "GET"
      );
    } else {
      // Execute request directly
      return executeRequest();
    }
  }

  /**
   * Execute a single HTTP request (without retry logic)
   */
  private async executeRequest<T>(
    options: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.headers);
    const body = this.serializeBody(options.body);
    const timeout = options.timeout ?? this.defaultTimeout;

    // Check cache for GET requests if enabled (PERFORMANCE FIX)
    let cacheKey: string | undefined;
    if (this.cache && options.method === "GET") {
      // Create cache key from endpoint and query
      const queryStr = options.query ? JSON.stringify(options.query) : "";
      cacheKey = `${options.method}:${options.path}:${queryStr}`;
      const cachedValue = this.cache.get(cacheKey);
      if (cachedValue !== null) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          data: cachedValue as T,
          headers: {},
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Add request ID for tracing
    const requestId = crypto.randomUUID();
    headers["X-Request-ID"] = requestId;

    // Create metrics context for performance monitoring (PERFORMANCE FIX)
    const metricsCtx = this.metricsCollector
      ? new MetricsContext(this.metricsCollector, options.path)
      : null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Build fetch options with SSL/TLS configuration for Node.js
      const fetchOptions: RequestInit = {
        method: options.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      };

      // Add SSL/TLS configuration for Node.js environments (CRITICAL SECURITY FIX)
      if (Agent && typeof process !== "undefined" && process.versions?.node) {
        fetchOptions.dispatcher = new Agent({
          connect: {
            rejectUnauthorized: true, // Always verify SSL certificates
            minVersion: "TLSv1.3", // Enforce TLS 1.3
          },
        });
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      const responseText = await response.text();
      const responseHeaders = this.parseHeaders(response.headers);
      const timestamp = new Date().toISOString();

      // Try to parse as JSON
      let data: T;
      let isJson = false;
      try {
        data = this.parseResponse<T>(responseText);
        isJson = true;
      } catch {
        // If not JSON, use the raw text
        data = responseText as unknown as T;
      }

      // Check for error response
      if (!response.ok) {
        let errorDetails;
        if (isJson) {
          const errorResponse = this.parseResponse<ErrorResponse>(responseText);
          if (errorResponse.success === false && errorResponse.error) {
            throw SecureNotifyError.fromApiResponse(errorResponse.error, response.status);
          }
          // If it's a success response wrapper, extract the error
          const successResponse = data as SuccessResponse<unknown>;
          if (successResponse && "success" in successResponse) {
            throw new SecureNotifyError(
              "UNKNOWN",
              `HTTP ${response.status}: ${response.statusText}`,
              { status: response.status }
            );
          }
        }

        throw new SecureNotifyError(
          "UNKNOWN",
          `HTTP ${response.status}: ${response.statusText}`,
          { status: response.status }
        );
      }

      // Cache successful GET responses (PERFORMANCE FIX)
      if (this.cache && options.method === "GET" && cacheKey) {
        this.cache.set(cacheKey, data, 60);
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: responseHeaders,
        timestamp,
      };
    } catch (error) {
      // Record metrics for failed request (PERFORMANCE FIX)
      if (metricsCtx) {
        metricsCtx.record();
      }

      clearTimeout(timeoutId);

      if (error instanceof SecureNotifyError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw SecureNotifyError.timeout(`Request timed out after ${timeout}ms`);
        }
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          throw SecureNotifyError.network(`Network error: ${error.message}`);
        }
      }

      throw SecureNotifyError.connection(`Request failed: ${(error as Error).message}`);
    } finally {
      // Record metrics for successful request (PERFORMANCE FIX)
      if (metricsCtx && response) {
        metricsCtx.markSuccess();
        metricsCtx.record();
      }
    }
  }

  /**
   * Execute a GET request
   */
  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "GET", path, query });
  }

  /**
   * Execute a POST request
   */
  async post<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "POST", path, body, query });
  }

  /**
   * Execute a PUT request
   */
  async put<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "PUT", path, body, query });
  }

  /**
   * Execute a PATCH request
   */
  async patch<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "PATCH", path, body, query });
  }

  /**
   * Execute a DELETE request
   */
  async delete<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "DELETE", path, query });
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return this.apiKey !== undefined && this.apiKey !== "";
  }

  /**
   * Get performance metrics summary if enabled.
   *
   * @returns Metrics summary or null if metrics disabled
   */
  getMetricsSummary(): MetricsSummary | null {
    return this.metricsCollector?.getSummary() ?? null;
  }

  /**
   * Get performance statistics for a specific endpoint.
   *
   * @param endpoint API endpoint
   * @returns Metric statistics or null if metrics disabled
   */
  getEndpointStats(endpoint: string): MetricStats | null {
    return this.metricsCollector?.getStats(endpoint) ?? null;
  }

  /**
   * Reset all metrics.
   */
  resetMetrics(): void {
    this.metricsCollector?.reset();
  }

  // Cache management methods (PERFORMANCE FIX)

  /**
   * Clear all cached responses.
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Remove expired cache entries.
   *
   * @returns Number of entries removed
   */
  cleanupCache(): number {
    return this.cache?.cleanupExpired() ?? 0;
  }

  /**
   * Get cache size.
   *
   * @returns Number of cached entries
   */
  getCacheSize(): number {
    return this?.cache?.size() ?? 0;
  }

  /**
   * Get cache metrics.
   *
   * @returns Cache performance metrics or null if cache disabled
   */
  getCacheMetrics(): { hits: number; misses: number; entries: number; cleanupCount: number; hitRate: number } | null {
    if (!this.cache) return null;
    const metrics = this.cache.getMetrics();
    return {
      ...metrics,
      hitRate: this.cache.getHitRate(),
    };
  }

  /**
   * Reset cache metrics.
   */
  resetCacheMetrics(): void {
    this.cache?.resetMetrics();
  }

  // Deduplicator management methods (PERFORMANCE FIX)

  /**
   * Clear all pending duplicate requests.
   *
   * @returns Number of pending requests cleared
   */
  clearPendingRequests(): number {
    return this.requestDeduplicator?.clearPending() ?? 0;
  }

  /**
   * Clear all completed duplicate requests.
   *
   * @returns Number of completed requests cleared
   */
  clearCompletedRequests(): number {
    return this.requestDeduplicator?.clearCompleted() ?? 0;
  }

  /**
   * Clear all pending and completed duplicate requests.
   *
   * @returns Total number of requests cleared
   */
  clearAllRequests(): number {
    return this.requestDeduplicator?.clearAll() ?? 0;
  }

  /**
   * Remove expired entries from request deduplicator.
   *
   * @returns Number of entries removed
   */
  cleanupExpiredRequests(): number {
    return this.requestDeduplicator?.cleanupExpired() ?? 0;
  }

  /**
   * Get statistics about the request deduplicator.
   *
   * @returns Dictionary with statistics or empty object if disabled
   */
  getDeduplicatorStats(): { hits: number; misses: number; errors: number; hitRate: number; pendingCount: number; completedCount: number; ttlSeconds: number } {
    return this.requestDeduplicator?.getStats() ?? {
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
      pendingCount: 0,
      completedCount: 0,
      ttlSeconds: 5.0,
    };
  }

  /**
   * Reset deduplicator statistics counters.
   */
  resetDeduplicatorStats(): void {
    this.requestDeduplicator?.resetStats();
  }

  /**
   * Check if request deduplication is enabled.
   *
   * @returns True if enabled, false otherwise
   */
  deduplicationEnabled(): boolean {
    return this.enableDeduplication;
  }
}
