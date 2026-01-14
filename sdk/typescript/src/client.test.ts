// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SecureNotifyClient } from "../client.js";
import type { SseMessageEvent } from "./types/api.js";

describe("SecureNotifyClient", () => {
  let client: SecureNotifyClient;

  beforeEach(() => {
    client = new SecureNotifyClient({
      baseUrl: "https://api.example.com",
      apiKey: "test-api-key",
    });
  });

  afterEach(async () => {
    await client.close();
  });

  describe("constructor", () => {
    it("should create client with options", () => {
      expect(client.getBaseUrl()).toBe("https://api.example.com");
      expect(client.hasApiKey()).toBe(true);
    });

    it("should create client with default options", () => {
      const defaultClient = new SecureNotifyClient();
      expect(defaultClient.getBaseUrl()).toBe("http://localhost:3000/api");
      expect(defaultClient.hasApiKey()).toBe(false);
    });
  });

  describe("state management", () => {
    it("should start in disconnected state", () => {
      const newClient = new SecureNotifyClient();
      expect(newClient.state).toBe("disconnected");
    });

    it("should report isClosed correctly", () => {
      expect(client.isClosed()).toBe(false);
    });

    it("should report isConnected correctly when no subscriptions", () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("managers", () => {
    it("should have keys manager", () => {
      expect(client.keys).toBeDefined();
      expect(typeof client.keys.register).toBe("function");
      expect(typeof client.keys.get).toBe("function");
      expect(typeof client.keys.list).toBe("function");
    });

    it("should have channels manager", () => {
      expect(client.channels).toBeDefined();
      expect(typeof client.channels.create).toBe("function");
      expect(typeof client.channels.get).toBe("function");
      expect(typeof client.channels.list).toBe("function");
    });

    it("should have publish manager", () => {
      expect(client.publish).toBeDefined();
      expect(typeof client.publish.send).toBe("function");
      expect(typeof client.publish.sendCritical).toBe("function");
      expect(typeof client.publish.sendHigh).toBe("function");
    });

    it("should have subscribe manager", () => {
      expect(client.subscribe).toBeDefined();
      expect(typeof client.subscribe.subscribe).toBe("function");
      expect(typeof client.subscribe.unsubscribe).toBe("function");
    });

    it("should have apiKeys manager", () => {
      expect(client.apiKeys).toBeDefined();
      expect(typeof client.apiKeys.create).toBe("function");
      expect(typeof client.apiKeys.get).toBe("function");
      expect(typeof client.apiKeys.list).toBe("function");
    });
  });

  describe("close", () => {
    it("should close without error", async () => {
      await expect(client.close()).resolves.not.toThrow();
      expect(client.isClosed()).toBe(true);
    });

    it("should be idempotent", async () => {
      await client.close();
      await expect(client.close()).resolves.not.toThrow();
    });
  });

  describe("dispose", () => {
    it("should dispose client", async () => {
      await client.dispose();
      expect(client.isClosed()).toBe(true);
    });
  });

  describe("static methods", () => {
    describe("create", () => {
      it("should create client with base URL and API key", () => {
        const createdClient = SecureNotifyClient.create(
          "https://api.example.com",
          "test-key"
        );
        expect(createdClient.getBaseUrl()).toBe("https://api.example.com");
        expect(createdClient.hasApiKey()).toBe(true);
      });
    });

    describe("builder", () => {
      it("should return a builder instance", () => {
        const builder = SecureNotifyClient.builder();
        expect(builder).toBeInstanceOf(SecureNotifyClientBuilder);
      });

      it("should build client with builder", () => {
        const builder = SecureNotifyClient.builder();
        const builtClient = builder
          .baseUrl("https://api.example.com")
          .apiKey("test-key")
          .timeout(50000)
          .build();

        expect(builtClient.getBaseUrl()).toBe("https://api.example.com");
        expect(builtClient.hasApiKey()).toBe(true);
      });
    });
  });

  describe("throwIfClosed", () => {
    it("should throw when accessing managers on closed client", async () => {
      const closedClient = new SecureNotifyClient();
      await closedClient.close();

      expect(() => closedClient.keys).toThrow();
      expect(() => closedClient.channels).toThrow();
      expect(() => closedClient.publish).toThrow();
      expect(() => closedClient.subscribe).toThrow();
      expect(() => closedClient.apiKeys).toThrow();
    });
  });
});

// Helper class for testing builder
class SecureNotifyClientBuilder {
  private options = {};

  baseUrl(baseUrl: string): this {
    this.options = { ...this.options, baseUrl };
    return this;
  }

  apiKey(apiKey: string): this {
    this.options = { ...this.options, apiKey };
    return this;
  }

  timeout(timeout: number): this {
    this.options = { ...this.options, timeout };
    return this;
  }

  build(): SecureNotifyClient {
    return new SecureNotifyClient(this.options as any);
  }
}
