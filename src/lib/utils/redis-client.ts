// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let connectionPromise: Promise<void> | null = null;

let redisSubscriber: RedisClient | null = null;
let subscriberConnectionPromise: Promise<void> | null = null;

export async function getRedisClient(): Promise<RedisClient | null> {
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

export async function getRedisSubscriber(): Promise<RedisClient | null> {
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

export async function closeRedisClient(): Promise<void> {
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
