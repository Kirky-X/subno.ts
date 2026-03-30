// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

/**
 * Redis client manager using IIFE pattern for encapsulation
 * Prevents external tampering with internal state
 */
export const RedisClientManager = (() => {
  // Private variables - not accessible outside
  let redisClient: RedisClient | null = null;
  let connectionPromise: Promise<void> | null = null;
  let redisSubscriber: RedisClient | null = null;
  let subscriberConnectionPromise: Promise<void> | null = null;

  /**
   * Get or create Redis client
   */
  async function getClient(): Promise<RedisClient | null> {
    if (redisClient) return redisClient;
    if (connectionPromise) {
      await connectionPromise;
      return redisClient;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    connectionPromise = (async () => {
      const client = createClient({ 
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 5000),
          connectTimeout: 10000,
        },
      });
      
      client.on('error', (err) => {
        console.error('Redis client error:', err);
        redisClient = null;
        connectionPromise = null;
      });
      
      await client.connect();
      redisClient = client;
    })();

    await connectionPromise;
    return redisClient;
  }

  /**
   * Get or create Redis subscriber
   */
  async function getSubscriber(): Promise<RedisClient | null> {
    if (redisSubscriber) return redisSubscriber;
    if (subscriberConnectionPromise) {
      await subscriberConnectionPromise;
      return redisSubscriber;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    subscriberConnectionPromise = (async () => {
      const client = createClient({ 
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 5000),
          connectTimeout: 10000,
        },
      });
      
      client.on('error', (err) => {
        console.error('Redis subscriber error:', err);
        redisSubscriber = null;
        subscriberConnectionPromise = null;
      });
      
      await client.connect();
      redisSubscriber = client;
    })();

    await subscriberConnectionPromise;
    return redisSubscriber;
  }

  /**
   * Close all Redis connections
   */
  async function closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    
    if (redisClient) {
      closePromises.push(redisClient.quit().then(() => {
        redisClient = null;
        connectionPromise = null;
      }));
    }
    
    if (redisSubscriber) {
      closePromises.push(redisSubscriber.quit().then(() => {
        redisSubscriber = null;
        subscriberConnectionPromise = null;
      }));
    }
    
    await Promise.all(closePromises);
  }

  // Return frozen public API
  return Object.freeze({
    getClient,
    getSubscriber,
    closeAll,
  });
})();

// Backward compatible exports
export const getRedisClient = RedisClientManager.getClient;
export const getRedisSubscriber = RedisClientManager.getSubscriber;
export const closeRedisClient = RedisClientManager.closeAll;
