// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublishManager } from "../../src/managers/publish.manager.js";
import { HttpClient } from "../../src/utils/http.js";

describe("PublishManager", () => {
  let manager: PublishManager;
  let mockHttp: HttpClient;

  beforeEach(() => {
    mockHttp = {
      post: vi.fn().mockResolvedValue({
        data: {
          success: true,
          data: {
            messageId: "msg_123",
            channel: "test-channel",
            publishedAt: "2026-01-14T00:00:00.000Z",
          },
        },
      }),
      get: vi.fn().mockResolvedValue({
        data: {
          success: true,
          data: {
            channel: "test-channel",
            messages: [],
            queueLength: 0,
          },
        },
      }),
    } as unknown as HttpClient;

    manager = new PublishManager(mockHttp);
  });

  describe("send", () => {
    it("should send a message successfully", async () => {
      const result = await manager.send({
        channel: "test-channel",
        message: "Hello, World!",
      });

      expect(result.messageId).toBe("msg_123");
      expect(result.channel).toBe("test-channel");
      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          channel: "test-channel",
          message: "Hello, World!",
          priority: "normal",
          cache: true,
        })
      );
    });

    it("should throw validation error when channel is missing", async () => {
      await expect(
        manager.send({ channel: "", message: "Hello" })
      ).rejects.toThrow("channel is required");
    });

    it("should throw validation error when message is missing", async () => {
      await expect(
        manager.send({ channel: "test", message: "" })
      ).rejects.toThrow("message is required");
    });

    it("should use custom priority", async () => {
      await manager.send({
        channel: "test-channel",
        message: "Urgent!",
        priority: "critical",
      });

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          priority: "critical",
        })
      );
    });

    it("should use custom sender", async () => {
      await manager.send({
        channel: "test-channel",
        message: "Hello",
        sender: "Test Sender",
      });

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          sender: "Test Sender",
        })
      );
    });
  });

  describe("sendCritical", () => {
    it("should send critical priority message", async () => {
      await manager.sendCritical("test-channel", "Critical!");

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          priority: "critical",
        })
      );
    });
  });

  describe("sendHigh", () => {
    it("should send high priority message", async () => {
      await manager.sendHigh("test-channel", "High priority!");

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          priority: "high",
        })
      );
    });
  });

  describe("sendNormal", () => {
    it("should send normal priority message", async () => {
      await manager.sendNormal("test-channel", "Normal message");

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          priority: "normal",
        })
      );
    });
  });

  describe("sendLow", () => {
    it("should send low priority message", async () => {
      await manager.sendLow("test-channel", "Low priority");

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          priority: "low",
        })
      );
    });
  });

  describe("sendBulk", () => {
    it("should send bulk priority message", async () => {
      await manager.sendBulk("test-channel", "Bulk message");

      expect(mockHttp.post).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          priority: "bulk",
        })
      );
    });
  });

  describe("getQueueStatus", () => {
    it("should get queue status", async () => {
      const status = await manager.getQueueStatus("test-channel", 10);

      expect(status.channel).toBe("test-channel");
      expect(status.queueLength).toBe(0);
      expect(mockHttp.get).toHaveBeenCalledWith(
        "/api/publish",
        expect.objectContaining({
          channel: "test-channel",
          count: 10,
        })
      );
    });

    it("should throw validation error when channel is missing", async () => {
      await expect(manager.getQueueStatus("")).rejects.toThrow(
        "channel is required"
      );
    });
  });

  describe("sendToChannels", () => {
    it("should send to multiple channels", async () => {
      const results = await manager.sendToChannels(
        ["channel-1", "channel-2"],
        "Broadcast!"
      );

      expect(results).toHaveLength(2);
      expect(mockHttp.post).toHaveBeenCalledTimes(2);
    });
  });

  describe("broadcast", () => {
    it("should broadcast with partial success", async () => {
      // First call succeeds, second fails
      (mockHttp.post as any).mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            success: true,
            data: { messageId: "msg_1" },
          },
        })
      );
      (mockHttp.post as any).mockImplementationOnce(() =>
        Promise.reject(new Error("Failed"))
      );

      const results = await manager.broadcast(
        ["channel-1", "channel-2"],
        "Broadcast!"
      );

      expect(results).toHaveLength(2);
      expect(results[0].result?.messageId).toBe("msg_1");
      expect(results[1].error).toBeDefined();
    });
  });
});
