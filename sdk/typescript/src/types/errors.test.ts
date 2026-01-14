// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from "vitest";
import {
  SecureNotifyError,
  ErrorCode,
  isRetryableError,
  isSecureNotifyError,
  assertNotNull,
  assert,
} from "../../src/types/errors.js";

describe("SecureNotifyError", () => {
  describe("constructor", () => {
    it("should create an error with code and message", () => {
      const error = new SecureNotifyError("NOT_FOUND", "Resource not found");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Resource not found");
      expect(error.status).toBe(404);
      expect(error.retryable).toBe(false);
    });

    it("should set retryable based on error code", () => {
      const rateLimitError = new SecureNotifyError("RATE_LIMIT_EXCEEDED", "Rate limited");
      expect(rateLimitError.retryable).toBe(true);
      expect(rateLimitError.status).toBe(429);

      const serverError = new SecureNotifyError("INTERNAL_ERROR", "Server error");
      expect(serverError.retryable).toBe(true);
      expect(serverError.status).toBe(500);
    });

    it("should include timestamp", () => {
      const error = new SecureNotifyError("VALIDATION_ERROR", "Invalid input");
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe("string");
    });

    it("should preserve stack trace", () => {
      const error = new SecureNotifyError("VALIDATION_ERROR", "Invalid input");
      expect(error.stack).toBeDefined();
    });
  });

  describe("fromApiResponse", () => {
    it("should create error from API response", () => {
      const errorDetails = {
        message: "Channel not found",
        code: "NOT_FOUND",
        timestamp: new Date().toISOString(),
      };

      const error = SecureNotifyError.fromApiResponse(errorDetails, 404);

      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Channel not found");
      expect(error.status).toBe(404);
      expect(error.retryable).toBe(false);
    });

    it("should handle rate limit response", () => {
      const errorDetails = {
        message: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        timestamp: new Date().toISOString(),
      };

      const error = SecureNotifyError.fromApiResponse(errorDetails, 429);

      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.retryable).toBe(true);
    });
  });

  describe("static factory methods", () => {
    it("should create validation error", () => {
      const error = SecureNotifyError.validation("Invalid input");

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.retryable).toBe(false);
    });

    it("should create auth required error", () => {
      const error = SecureNotifyError.authRequired();

      expect(error.code).toBe("AUTH_REQUIRED");
      expect(error.message).toBe("API key is required");
      expect(error.status).toBe(401);
    });

    it("should create auth failed error", () => {
      const error = SecureNotifyError.authFailed();

      expect(error.code).toBe("AUTH_FAILED");
      expect(error.message).toBe("Invalid API key");
    });

    it("should create rate limit error", () => {
      const error = SecureNotifyError.rateLimitExceeded("Try again later");

      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.status).toBe(429);
      expect(error.retryable).toBe(true);
    });

    it("should create network error", () => {
      const error = SecureNotifyError.network();

      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("should create timeout error", () => {
      const error = SecureNotifyError.timeout();

      expect(error.code).toBe("TIMEOUT_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("should create connection error", () => {
      const error = SecureNotifyError.connection();

      expect(error.code).toBe("CONNECTION_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("should create missing API key error", () => {
      const error = SecureNotifyError.missingApiKey();

      expect(error.code).toBe("MISSING_API_KEY");
      expect(error.retryable).toBe(false);
    });

    it("should create SSE connection error", () => {
      const error = SecureNotifyError.sseConnection();

      expect(error.code).toBe("SSE_CONNECTION_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("should create SSE heartbeat timeout error", () => {
      const error = SecureNotifyError.sseHeartbeatTimeout();

      expect(error.code).toBe("SSE_HEARTBEAT_TIMEOUT");
      expect(error.retryable).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("should serialize to JSON", () => {
      const error = new SecureNotifyError("NOT_FOUND", "Not found", {
        status: 404,
        retryable: false,
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: "SecureNotifyError",
        message: "Not found",
        code: "NOT_FOUND",
        status: 404,
        retryable: false,
        timestamp: error.timestamp,
        details: undefined,
      });
    });

    it("should include details when provided", () => {
      const errorDetails = {
        message: "Detailed error",
        code: "VALIDATION_ERROR",
        timestamp: new Date().toISOString(),
      };

      const error = new SecureNotifyError("VALIDATION_ERROR", "Validation failed", {
        details: errorDetails,
      });

      const json = error.toJSON();
      expect((json as { details: typeof errorDetails }).details).toEqual(errorDetails);
    });
  });

  describe("toString", () => {
    it("should return string representation", () => {
      const error = new SecureNotifyError("NOT_FOUND", "Resource not found");
      expect(error.toString()).toBe("SecureNotifyError[NOT_FOUND]: Resource not found");
    });
  });
});

describe("isRetryableError", () => {
  it("should return true for retryable error codes", () => {
    expect(isRetryableError("RATE_LIMIT_EXCEEDED")).toBe(true);
    expect(isRetryableError("INTERNAL_ERROR")).toBe(true);
    expect(isRetryableError("BAD_GATEWAY")).toBe(true);
    expect(isRetryableError("SERVICE_UNAVAILABLE")).toBe(true);
    expect(isRetryableError("GATEWAY_TIMEOUT")).toBe(true);
    expect(isRetryableError("NETWORK_ERROR")).toBe(true);
    expect(isRetryableError("TIMEOUT_ERROR")).toBe(true);
    expect(isRetryableError("CONNECTION_ERROR")).toBe(true);
  });

  it("should return false for non-retryable error codes", () => {
    expect(isRetryableError("VALIDATION_ERROR")).toBe(false);
    expect(isRetryableError("AUTH_REQUIRED")).toBe(false);
    expect(isRetryableError("AUTH_FAILED")).toBe(false);
    expect(isRetryableError("NOT_FOUND")).toBe(false);
    expect(isRetryableError("FORBIDDEN")).toBe(false);
  });
});

describe("isSecureNotifyError", () => {
  it("should return true for SecureNotifyError", () => {
    const error = new SecureNotifyError("NOT_FOUND", "Not found");
    expect(isSecureNotifyError(error)).toBe(true);
  });

  it("should return false for other errors", () => {
    expect(isSecureNotifyError(new Error("Regular error"))).toBe(false);
    expect(isSecureNotifyError("string error")).toBe(false);
    expect(isSecureNotifyError(null)).toBe(false);
    expect(isSecureNotifyError(undefined)).toBe(false);
  });
});

describe("assertNotNull", () => {
  it("should return value if not null/undefined", () => {
    expect(assertNotNull("value")).toBe("value");
    expect(assertNotNull(0)).toBe(0);
    expect(assertNotNull(false)).toBe(false);
    expect(assertNotNull({})).toEqual({});
  });

  it("should throw validation error if null", () => {
    expect(() => assertNotNull(null)).toThrow(SecureNotifyError);
    expect(() => assertNotNull(null)).toThrow("Value cannot be null");
  });

  it("should throw validation error if undefined", () => {
    expect(() => assertNotNull(undefined)).toThrow(SecureNotifyError);
  });

  it("should throw with custom message", () => {
    expect(() => assertNotNull(null, "Custom message")).toThrow("Custom message");
  });
});

describe("assert", () => {
  it("should not throw if condition is true", () => {
    expect(() => assert(true)).not.toThrow();
    expect(() => assert(true, "message")).not.toThrow();
  });

  it("should throw if condition is false", () => {
    expect(() => assert(false)).toThrow(SecureNotifyError);
    expect(() => assert(false, "Custom message")).toThrow("Custom message");
  });
});
