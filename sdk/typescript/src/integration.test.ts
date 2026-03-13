// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SecureNotifyClient } from "./client.js";
import { MockHttpClient, TEST_CONFIG, TestDataFactory, MockResponses } from "./testing/index.js";
import { KeyManager } from "./managers/key.manager.js";
import { ChannelManager } from "./managers/channel.manager.js";
import { PublishManager } from "./managers/publish.manager.js";
import { ApiKeyManager } from "./managers/apikey.manager.js";

/**
 * Integration Tests with Mock HTTP Client
 * 
 * These tests run independently without requiring a real server.
 * All HTTP requests are mocked using MockHttpClient.
 */
describe("Integration Tests with Mock Client", () => {
  let client: SecureNotifyClient;
  let mockHttp: MockHttpClient;

  beforeAll(() => {
    // Create mock HTTP client
    mockHttp = new MockHttpClient({
      baseUrl: TEST_CONFIG.baseUrl,
      apiKey: TEST_CONFIG.apiKey,
      apiKeyId: TEST_CONFIG.apiKeyId,
    });

    // Create client with mocked HTTP
    client = new SecureNotifyClient({
      baseUrl: TEST_CONFIG.baseUrl,
      apiKey: TEST_CONFIG.apiKey,
      apiKeyId: TEST_CONFIG.apiKeyId,
    });

    // Override the internal HTTP client with our mock
    (client as any).http = mockHttp;
    (client as any)._keys = new KeyManager(mockHttp);
    (client as any)._channels = new ChannelManager(mockHttp);
    (client as any)._publish = new PublishManager(mockHttp);
    (client as any)._apiKeys = new ApiKeyManager(mockHttp);
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(() => {
    // Reset mock state before each test
    mockHttp.reset();
    TestDataFactory.reset();
  });

  describe("Server Health Check", () => {
    it("should connect to mock server", async () => {
      // Use mockHttp directly instead of real fetch
      const response = await mockHttp.get("/api/health");
      expect(response.ok).toBe(true);
      
      const data = response.data;
      expect(data.status).toBe("healthy");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("API Key Management", () => {
    it("should create an API key", async () => {
      const apiKey = await client.apiKeys.create({
        name: "integration-test-key",
        userId: "test-user-001",
        permissions: ["publish", "subscribe"],
      });

      expect(apiKey).toBeDefined();
      expect(apiKey.id).toBeDefined();
      expect(apiKey.keyPrefix).toBeDefined();
      expect(apiKey.keyPrefix.length).toBeGreaterThan(0);
      expect(apiKey.name).toBe("integration-test-key");
      expect(apiKey.permissions).toContain("publish");
      expect(apiKey.permissions).toContain("subscribe");
    });

    it("should list API keys", async () => {
      const result = await client.apiKeys.list();

      expect(result).toBeDefined();
      expect(Array.isArray(result.keys)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBeGreaterThanOrEqual(0);
    });

    it("should get API key by ID", async () => {
      // Override the mock response for this specific test
      const mockKey = MockResponses.createApiKey({ name: "test-key" });
      mockHttp.overrideResponse("GET", `/api/keys/${mockKey.id}`, MockResponses.success(mockKey));

      const key = await client.apiKeys.get(mockKey.id);

      expect(key).toBeDefined();
      expect(key.id).toBe(mockKey.id);
      expect(key.name).toBe("test-key");
    });

    it("should revoke an API key", async () => {
      const mockKeyId = TestDataFactory.generateApiKeyId();
      
      const result = await client.apiKeys.revoke(mockKeyId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deletedId).toBeDefined();
      expect(result.deletedAt).toBeDefined();
    });
  });

  describe("Key Management", () => {
    it("should register a public key", async () => {
      const testKey = TestDataFactory.generatePublicKey();

      const key = await client.keys.register({
        publicKey: testKey,
        algorithm: "RSA-4096",
      });

      expect(key).toBeDefined();
      expect(key.channelId).toBeDefined();
      expect(key.publicKeyId).toBeDefined();
      expect(key.algorithm).toBe("RSA-4096");
      expect(key.expiresAt).toBeDefined();
    });

    it("should list keys", async () => {
      const keys = await client.keys.list();

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThanOrEqual(0);
    });

    it("should get key details", async () => {
      const mockKey = MockResponses.listKeys(1)[0];
      mockHttp.overrideResponse("GET", `/api/keys/${mockKey.id}`, MockResponses.success({
        ...mockKey,
        publicKey: TestDataFactory.generatePublicKey(),
      }));

      const key = await client.keys.getDetails(mockKey.id);

      expect(key).toBeDefined();
      expect(key.id).toBe(mockKey.id);
      expect(key.publicKey).toBeDefined();
    });

    it("should initiate key revocation", async () => {
      const keyId = TestDataFactory.generateId("key");

      const result = await client.keys.revoke(keyId, "Test revocation");

      expect(result).toBeDefined();
      expect(result.revocationId).toBeDefined();
      expect(result.keyId).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.confirmationCodeSent).toBe(true);
    });

    it("should confirm key revocation", async () => {
      const keyId = TestDataFactory.generateId("key");
      const confirmationCode = "123456";

      const result = await client.keys.confirmRevocation(keyId, confirmationCode);

      expect(result).toBeDefined();
      expect(result.deletedId).toBeDefined();
      expect(result.channelId).toBeDefined();
      expect(result.deletedAt).toBeDefined();
    });

    it("should cancel pending revocation", async () => {
      const keyId = TestDataFactory.generateId("key");

      // Should not throw
      await expect(client.keys.cancelRevocation(keyId)).resolves.not.toThrow();
    });
  });

  describe("Channel Management", () => {
    it("should create a channel", async () => {
      const channel = await client.channels.create({
        name: `test-channel-${Date.now()}`,
        type: "public",
      });

      expect(channel).toBeDefined();
      expect(channel.id).toBeDefined();
      expect(channel.name).toBeDefined();
      expect(channel.type).toBe("public");
      expect(channel.isActive).toBe(true);
    });

    it("should create an encrypted channel", async () => {
      const channel = await client.channels.create({
        name: "encrypted-test-channel",
        type: "encrypted",
        creator: "test-user-001",
      });

      expect(channel).toBeDefined();
      expect(channel.type).toBe("encrypted");
    });

    it("should list channels", async () => {
      const result = await client.channels.list();

      expect(result).toBeDefined();
      expect(Array.isArray(result.channels)).toBe(true);
      expect(result.pagination).toBeDefined();
    });

    it("should get channel by ID", async () => {
      const mockChannel = MockResponses.createChannel({ id: "test-channel-123" });
      mockHttp.overrideResponse("GET", "/api/channels", MockResponses.success(mockChannel));

      const channel = await client.channels.get("test-channel-123");

      expect(channel).toBeDefined();
      expect(channel.id).toBe("test-channel-123");
    });

    it("should check if channel exists", async () => {
      const mockChannel = MockResponses.createChannel({ id: "existing-channel" });
      mockHttp.overrideResponse("GET", "/api/channels", MockResponses.success(mockChannel));

      const exists = await client.channels.exists("existing-channel");

      expect(exists).toBe(true);
    });

    it("should return false for non-existent channel", async () => {
      // Override with 404 error response
      mockHttp.overrideResponse("GET", "/api/channels", MockResponses.error("Not found", "NOT_FOUND"), 404);

      const exists = await client.channels.exists("non-existent-channel");

      expect(exists).toBe(false);
    });
  });

  describe("Message Publishing", () => {
    let testChannel: string;

    beforeAll(() => {
      testChannel = TestDataFactory.generateChannelId();
    });

    it("should publish a message", async () => {
      const result = await client.publish.send({
        channel: testChannel,
        message: `Test message at ${new Date().toISOString()}`,
        priority: "normal",
      });

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.channel).toBe(testChannel);
      expect(result.publishedAt).toBeDefined();
    });

    it("should send high priority message", async () => {
      const result = await client.publish.sendHigh(testChannel, "High priority test");

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it("should send critical priority message", async () => {
      const result = await client.publish.sendCritical(testChannel, "Critical priority test");

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it("should send normal priority message", async () => {
      const result = await client.publish.sendNormal(testChannel, "Normal priority test");

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it("should send low priority message", async () => {
      const result = await client.publish.sendLow(testChannel, "Low priority test");

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it("should send bulk priority message", async () => {
      const result = await client.publish.sendBulk(testChannel, "Bulk priority test");

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it("should get queue status", async () => {
      const status = await client.publish.getQueueStatus(testChannel);

      expect(status).toBeDefined();
      expect(status.channel).toBe(testChannel);
      expect(Array.isArray(status.messages)).toBe(true);
      expect(typeof status.queueLength).toBe("number");
    });

    it("should send message to multiple channels", async () => {
      const channels = [
        TestDataFactory.generateChannelId(),
        TestDataFactory.generateChannelId(),
        TestDataFactory.generateChannelId(),
      ];

      const results = await client.publish.sendToChannels(channels, "Broadcast message");

      expect(results).toBeDefined();
      expect(results.length).toBe(channels.length);
      results.forEach((result) => {
        expect(result.messageId).toBeDefined();
      });
    });

    it("should broadcast message with error handling", async () => {
      const channels = [
        TestDataFactory.generateChannelId(),
        TestDataFactory.generateChannelId(),
      ];

      const results = await client.publish.broadcast(channels, "Broadcast test");

      expect(results).toBeDefined();
      expect(results.length).toBe(channels.length);
      results.forEach((result) => {
        expect(result.channel).toBeDefined();
      });
    });
  });

  describe("Client State Management", () => {
    it("should report correct state", () => {
      expect(client.isClosed()).toBe(false);
      expect(client.isConnected()).toBe(false);
      expect(client.getBaseUrl()).toBe(TEST_CONFIG.baseUrl);
      expect(client.hasApiKey()).toBe(true);
    });

    it("should have all managers", () => {
      expect(client.keys).toBeDefined();
      expect(client.channels).toBeDefined();
      expect(client.publish).toBeDefined();
      expect(client.subscribe).toBeDefined();
      expect(client.apiKeys).toBeDefined();
    });

    it("should track subscribed channels", () => {
      const channels = client.getSubscribedChannels();
      expect(Array.isArray(channels)).toBe(true);
    });

    it("should report subscription count", () => {
      const count = client.getSubscriptionCount();
      expect(typeof count).toBe("number");
      expect(count).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors", async () => {
      await expect(client.publish.send({
        channel: "",
        message: "test",
      })).rejects.toThrow();
    });

    it("should handle missing required fields", async () => {
      await expect(client.keys.register({
        publicKey: "",
      })).rejects.toThrow();
    });

    it("should handle channel creation without name", async () => {
      const channel = await client.channels.create({
        type: "public",
      });

      expect(channel).toBeDefined();
      expect(channel.id).toBeDefined();
    });
  });

  describe("Request History Tracking", () => {
    it("should track request history", async () => {
      mockHttp.clearHistory();

      await client.channels.list();
      await client.keys.list();

      const history = mockHttp.getRequestHistory();

      expect(history.length).toBe(2);
      expect(history[0].method).toBe("GET");
      expect(history[0].path).toBe("/api/channels");
      expect(history[1].path).toBe("/api/register");
    });

    it("should track POST request body", async () => {
      mockHttp.clearHistory();

      await client.publish.send({
        channel: "test-channel",
        message: "test message",
      });

      const history = mockHttp.getRequestHistory();

      expect(history.length).toBe(1);
      expect(history[0].method).toBe("POST");
      expect(history[0].body).toBeDefined();
      expect((history[0].body as Record<string, unknown>).channel).toBe("test-channel");
      expect((history[0].body as Record<string, unknown>).message).toBe("test message");
    });
  });

  describe("Client Builder", () => {
    it("should create client using builder", () => {
      const builtClient = SecureNotifyClient.builder()
        .baseUrl("http://localhost:8080/api")
        .apiKey("builder-test-key")
        .timeout(10000)
        .build();

      expect(builtClient).toBeDefined();
      expect(builtClient.getBaseUrl()).toBe("http://localhost:8080/api");
      expect(builtClient.hasApiKey()).toBe(true);
    });

    it("should create client with static create method", () => {
      const createdClient = SecureNotifyClient.create(
        "http://localhost:9000/api",
        "static-create-key"
      );

      expect(createdClient).toBeDefined();
      expect(createdClient.getBaseUrl()).toBe("http://localhost:9000/api");
      expect(createdClient.hasApiKey()).toBe(true);
    });
  });

  describe("Client Lifecycle", () => {
    it("should close client properly", async () => {
      const tempClient = new SecureNotifyClient({
        baseUrl: TEST_CONFIG.baseUrl,
        apiKey: TEST_CONFIG.apiKey,
      });

      expect(tempClient.isClosed()).toBe(false);

      await tempClient.close();

      expect(tempClient.isClosed()).toBe(true);
    });

    it("should throw error when accessing closed client", async () => {
      const tempClient = new SecureNotifyClient({
        baseUrl: TEST_CONFIG.baseUrl,
        apiKey: TEST_CONFIG.apiKey,
      });

      await tempClient.close();

      expect(() => tempClient.keys).toThrow();
      expect(() => tempClient.channels).toThrow();
    });

    it("should handle multiple close calls gracefully", async () => {
      const tempClient = new SecureNotifyClient({
        baseUrl: TEST_CONFIG.baseUrl,
        apiKey: TEST_CONFIG.apiKey,
      });

      await tempClient.close();
      await tempClient.close(); // Should not throw

      expect(tempClient.isClosed()).toBe(true);
    });
  });
});
