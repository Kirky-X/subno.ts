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

  /**
   * Create a new HTTP client
   */
  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:3000/api";
    this.apiKey = options.apiKey;
    this.apiKeyId = options.apiKeyId;
    this.defaultTimeout = options.timeout ?? 30000;
    this.retryConfig = options.retry;
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

    // Execute the request with retry logic
    const result = await withRetry(async () => {
      return await this.executeRequest<T>(options);
    }, finalRetryConfig);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      });

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

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: responseHeaders,
        timestamp,
      };
    } catch (error) {
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
}
