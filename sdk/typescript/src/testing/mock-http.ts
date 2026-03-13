// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Mock HTTP client for testing without actual server
 */

import type { HttpClient, HttpRequestOptions, HttpResponse, HttpHeaders } from "../utils/http.js";
import type { SuccessResponse } from "../types/api.js";
import { MockResponses, TestDataFactory } from "./config.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * Request handler function type
 */
type RequestHandler = (options: HttpRequestOptions) => Promise<HttpResponse<unknown>>;

/**
 * Mock HTTP client that simulates API responses
 */
export class MockHttpClient implements Pick<HttpClient, keyof HttpClient> {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly apiKeyId: string | undefined;
  private readonly requestHandlers: Map<string, RequestHandler> = new Map();
  private readonly responseOverrides: Map<string, { data: unknown; status: number }> = new Map();
  private requestHistory: Array<{ method: string; path: string; body?: unknown; timestamp: Date }> = [];

  constructor(options?: { baseUrl?: string; apiKey?: string; apiKeyId?: string }) {
    this.baseUrl = options?.baseUrl ?? "http://localhost:3002/api";
    this.apiKey = options?.apiKey;
    this.apiKeyId = options?.apiKeyId;
    this.setupDefaultHandlers();
  }

  /**
   * Setup default request handlers for common API endpoints
   */
  private setupDefaultHandlers(): void {
    // Health check
    this.onGet("/api/health", async () => this.createResponse(MockResponses.healthCheck()));

    // API Key endpoints
    this.onPost("/api/keys", async (options) => {
      const body = options.body as { name?: string; permissions?: string[]; userId?: string };
      return this.createResponse(MockResponses.success(MockResponses.createApiKey({
        name: body?.name,
        permissions: body?.permissions as any,
      })));
    });

    this.onGet("/api/keys", async () => {
      const result = MockResponses.listApiKeys();
      return this.createResponse({
        success: true,
        data: result.keys,
        pagination: result.pagination,
      });
    });

    // API Key get by ID endpoint - GET /api/keys/{id}
    this.onGet(/\/api\/keys\/[^/]+$/, async (options) => {
      const match = options.path.match(/\/api\/keys\/(.+)$/);
      const keyId = match ? match[1] : TestDataFactory.generateApiKeyId();
      const mockKey = MockResponses.createApiKey({ name: "test-key" });
      return this.createResponse(MockResponses.success({
        ...mockKey,
        id: keyId,
      }));
    });

    // Key registration endpoints
    this.onPost("/api/register", async (options) => {
      const body = options.body as { algorithm?: string; publicKey?: string };
      return this.createResponse(MockResponses.success(MockResponses.registerKey({
        algorithm: body?.algorithm as any,
      })));
    });

    this.onGet("/api/register", async () => {
      return this.createResponse(MockResponses.success(MockResponses.listKeys()));
    });

    // Channel endpoints
    this.onPost("/api/channels", async (options) => {
      const body = options.body as { id?: string; name?: string; type?: string };
      return this.createResponse(MockResponses.success(MockResponses.createChannel({
        id: body?.id,
        name: body?.name,
        type: body?.type as any,
      })));
    });

    this.onGet("/api/channels", async () => {
      const result = MockResponses.listChannels();
      return this.createResponse({
        success: true,
        data: result.channels,
        pagination: result.pagination,
      });
    });

    // Publish endpoints
    this.onPost("/api/publish", async (options) => {
      const body = options.body as { channel?: string };
      return this.createResponse(MockResponses.success(MockResponses.publishMessage({
        channel: body?.channel,
      })));
    });

    this.onGet("/api/publish", async (options) => {
      const channel = options.query?.channel as string ?? TestDataFactory.generateChannelId();
      return this.createResponse(MockResponses.success(MockResponses.queueStatus(channel)));
    });

    // Key revocation endpoints - POST to /api/keys/{id}/revoke
    this.onPost(/\/api\/keys\/[^/]+\/revoke$/, async (options) => {
      const match = options.path.match(/\/api\/keys\/(.+)\/revoke$/);
      const keyId = match ? match[1] : TestDataFactory.generateId("key");
      const revokeResult = MockResponses.revokeKey();
      return this.createResponse(MockResponses.success({
        ...revokeResult,
        keyId,
      }));
    });

    // Cancel revocation - POST to /api/keys/{id}/revoke/cancel
    this.onPost(/\/api\/keys\/[^/]+\/revoke\/cancel$/, async () => {
      return this.createResponse(MockResponses.success({ message: "Revocation cancelled" }));
    });

    // API Key revoke - DELETE /api/keys/{id} (no query params)
    this.onDelete(/\/api\/keys\/[^/?]+$/, async (options) => {
      const match = options.path.match(/\/api\/keys\/([^/?]+)$/);
      const keyId = match ? match[1] : TestDataFactory.generateApiKeyId();
      return this.createResponse(MockResponses.success({
        success: true,
        deletedId: keyId,
        deletedAt: new Date().toISOString(),
      }));
    });

    // Key confirm revocation - DELETE /api/keys/{id}?confirmationCode=xxx
    this.onDelete(/\/api\/keys\/[^/?]+\?.+/, async (options) => {
      const match = options.path.match(/\/api\/keys\/([^/?]+)\?/);
      const keyId = match ? match[1] : TestDataFactory.generateId("key");
      const confirmResult = MockResponses.confirmRevoke();
      return this.createResponse(MockResponses.success({
        ...confirmResult,
        deletedId: keyId,
      }));
    });
  }

  /**
   * Create a mock HTTP response
   */
  private createResponse<T>(data: T, status: number = 200): HttpResponse<T> {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "Error",
      data,
      headers: {
        "content-type": "application/json",
        "x-request-id": crypto.randomUUID(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Register a handler for GET requests
   */
  onGet(path: string | RegExp, handler: RequestHandler): void {
    const pattern = path instanceof RegExp ? path.source : path;
    const key = `GET:${pattern}`;
    this.requestHandlers.set(key, handler);
  }

  /**
   * Register a handler for POST requests
   */
  onPost(path: string | RegExp, handler: RequestHandler): void {
    const pattern = path instanceof RegExp ? path.source : path;
    const key = `POST:${pattern}`;
    this.requestHandlers.set(key, handler);
  }

  /**
   * Register a handler for PUT requests
   */
  onPut(path: string | RegExp, handler: RequestHandler): void {
    const pattern = path instanceof RegExp ? path.source : path;
    const key = `PUT:${pattern}`;
    this.requestHandlers.set(key, handler);
  }

  /**
   * Register a handler for DELETE requests
   */
  onDelete(path: string | RegExp, handler: RequestHandler): void {
    const pattern = path instanceof RegExp ? path.source : path;
    const key = `DELETE:${pattern}`;
    this.requestHandlers.set(key, handler);
  }

  /**
   * Find a matching handler for the request
   */
  private findHandler(method: string, path: string): RequestHandler | undefined {
    // Try exact match first
    const exactKey = `${method}:${path}`;
    if (this.requestHandlers.has(exactKey)) {
      return this.requestHandlers.get(exactKey);
    }

    // Try regex match - check handlers with query params first (more specific)
    const handlers = Array.from(this.requestHandlers.entries());
    
    // Sort handlers: those with ? in pattern first (more specific), then by pattern length (longer = more specific)
    handlers.sort((a, b) => {
      const aHasQuery = a[0].includes("?") || a[0].includes("\\?");
      const bHasQuery = b[0].includes("?") || b[0].includes("\\?");
      if (aHasQuery && !bHasQuery) return -1;
      if (!aHasQuery && bHasQuery) return 1;
      // Longer patterns are more specific
      return b[0].length - a[0].length;
    });

    for (const [key, handler] of handlers) {
      const colonIndex = key.indexOf(":");
      const handlerMethod = key.substring(0, colonIndex);
      const pattern = key.substring(colonIndex + 1);
      
      if (handlerMethod === method) {
        // Use the pattern directly as regex
        const regex = new RegExp(pattern);
        if (regex.test(path)) {
          return handler;
        }
      }
    }

    return undefined;
  }

  /**
   * Execute a mock HTTP request
   */
  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const method = options.method ?? "GET";
    const path = options.path;

    // Record request history
    this.requestHistory.push({
      method,
      path,
      body: options.body,
      timestamp: new Date(),
    });

    // Check for response override
    const overrideKey = `${method}:${path}`;
    if (this.responseOverrides.has(overrideKey)) {
      const override = this.responseOverrides.get(overrideKey)!;
      
      // If status is not OK, throw an error like the real HttpClient does
      if (override.status < 200 || override.status >= 300) {
        const errorData = override.data as { success?: boolean; error?: { message: string; code: string; timestamp: string } };
        if (errorData.success === false && errorData.error) {
          throw SecureNotifyError.fromApiResponse(errorData.error, override.status);
        }
        throw new SecureNotifyError(
          "UNKNOWN",
          `HTTP ${override.status}: Error`,
          { status: override.status }
        );
      }
      
      return this.createResponse(override.data as T, override.status);
    }

    // Find and execute handler
    const handler = this.findHandler(method, path);
    if (handler) {
      return handler(options) as Promise<HttpResponse<T>>;
    }

    // Default 404 response - throw error
    const errorResponse = MockResponses.error(`Endpoint not found: ${method} ${path}`, "NOT_FOUND");
    throw SecureNotifyError.fromApiResponse(errorResponse.error, 404);
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
   * Override a response for specific endpoint
   */
  overrideResponse(method: string, path: string, data: unknown, status: number = 200): void {
    const key = `${method}:${path}`;
    this.responseOverrides.set(key, { data, status });
  }

  /**
   * Clear response overrides
   */
  clearOverrides(): void {
    this.responseOverrides.clear();
  }

  /**
   * Get request history
   */
  getRequestHistory(): Array<{ method: string; path: string; body?: unknown; timestamp: Date }> {
    return [...this.requestHistory];
  }

  /**
   * Clear request history
   */
  clearHistory(): void {
    this.requestHistory = [];
  }

  /**
   * Reset the mock client
   */
  reset(): void {
    this.clearHistory();
    this.clearOverrides();
    this.requestHandlers.clear();
    this.setupDefaultHandlers();
  }

  // Stub methods for metrics and cache (not needed for testing)
  getMetricsSummary(): null {
    return null;
  }

  getEndpointStats(): null {
    return null;
  }

  resetMetrics(): void {}

  clearCache(): void {}

  cleanupCache(): number {
    return 0;
  }

  getCacheSize(): number {
    return 0;
  }

  getCacheMetrics(): null {
    return null;
  }

  resetCacheMetrics(): void {}

  clearPendingRequests(): number {
    return 0;
  }

  clearCompletedRequests(): number {
    return 0;
  }

  clearAllRequests(): number {
    return 0;
  }

  cleanupExpiredRequests(): number {
    return 0;
  }

  getDeduplicatorStats(): { hits: number; misses: number; errors: number; hitRate: number; pendingCount: number; completedCount: number; ttlSeconds: number } {
    return {
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
      pendingCount: 0,
      completedCount: 0,
      ttlSeconds: 5.0,
    };
  }

  resetDeduplicatorStats(): void {}

  deduplicationEnabled(): boolean {
    return false;
  }
}

/**
 * Create a mock HTTP client for testing
 */
export function createMockHttpClient(options?: {
  baseUrl?: string;
  apiKey?: string;
  apiKeyId?: string;
}): MockHttpClient {
  return new MockHttpClient(options);
}
