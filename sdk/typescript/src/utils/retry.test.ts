// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, createRetryableFunction, DEFAULT_RETRY_OPTIONS, RetryConfig } from "../../src/utils/retry.js";
import { SecureNotifyError } from "../../src/types/errors.js";

describe("Retry Utility", () => {
  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(mockFn);

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(
          new SecureNotifyError("RATE_LIMIT_EXCEEDED", "Rate limited", { status: 429 })
        )
        .mockResolvedValueOnce("success");

      const result = await withRetry(mockFn, { maxRetries: 3, initialDelay: 10 });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should give up after max retries", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValue(
          new SecureNotifyError("INTERNAL_ERROR", "Server error", { status: 500 })
        );

      const result = await withRetry(mockFn, { maxRetries: 3, initialDelay: 10 });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INTERNAL_ERROR");
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it("should not retry non-retryable errors", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValue(
          new SecureNotifyError("NOT_FOUND", "Not found", { status: 404 })
        );

      const result = await withRetry(mockFn, { maxRetries: 3, initialDelay: 10 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // Should not retry
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should use default options", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(mockFn);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    it("should calculate total time", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(
          new SecureNotifyError("RATE_LIMIT_EXCEEDED", "Rate limited", { status: 429 })
        )
        .mockResolvedValueOnce("success");

      const startTime = Date.now();
      const result = await withRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 50,
        jitter: false,
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      // With jitter disabled and 50ms delay, should be at least 50ms
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });
  });

  describe("createRetryableFunction", () => {
    it("should create a retryable version of a function", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(
          new SecureNotifyError("RATE_LIMIT_EXCEEDED", "Rate limited", { status: 429 })
        )
        .mockResolvedValueOnce("success");

      const retryableFn = createRetryableFunction(mockFn, { maxRetries: 3, initialDelay: 10 });
      const result = await retryableFn();

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValue(
          new SecureNotifyError("INTERNAL_ERROR", "Server error", { status: 500 })
        );

      const retryableFn = createRetryableFunction(mockFn, { maxRetries: 2, initialDelay: 10 });

      try {
        await retryableFn();
        expect(true).toBe(false); // Should have thrown
      } catch (error) {
        expect(error).toBeInstanceOf(SecureNotifyError);
        const sdkError = error as SecureNotifyError;
        expect(sdkError.code).toBe("INTERNAL_ERROR");
      }
    });
  });

  describe("DEFAULT_RETRY_OPTIONS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_OPTIONS.initialDelay).toBe(1000);
      expect(DEFAULT_RETRY_OPTIONS.maxDelay).toBe(30000);
      expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_OPTIONS.jitter).toBe(true);
      expect(DEFAULT_RETRY_OPTIONS.retryOnStatusCodes).toContain(429);
      expect(DEFAULT_RETRY_OPTIONS.retryOnStatusCodes).toContain(500);
      expect(DEFAULT_RETRY_OPTIONS.retryOnStatusCodes).toContain(502);
      expect(DEFAULT_RETRY_OPTIONS.retryOnStatusCodes).toContain(503);
      expect(DEFAULT_RETRY_OPTIONS.retryOnStatusCodes).toContain(504);
    });
  });

  describe("error classification", () => {
    it("should retry rate limit errors", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(
          new SecureNotifyError("RATE_LIMIT_EXCEEDED", "Rate limited", { status: 429 })
        )
        .mockResolvedValueOnce("success");

      const result = await withRetry(mockFn, { maxRetries: 3, initialDelay: 10 });

      expect(result.success).toBe(true);
    });

    it("should retry server errors", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValue(
          new SecureNotifyError("INTERNAL_ERROR", "Server error", { status: 500 })
        );

      const result = await withRetry(mockFn, { maxRetries: 3, initialDelay: 10 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // Should have retried
    });

    it("should not retry client errors", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValue(
          new SecureNotifyError("NOT_FOUND", "Not found", { status: 404 })
        );

      const result = await withRetry(mockFn, { maxRetries: 3, initialDelay: 10 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // Should not retry
    });
  });
});
