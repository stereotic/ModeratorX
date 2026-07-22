/**
 * Redis connection lifecycle.
 *
 * Single shared ioredis client for OAuth state, queues (later), and rate limits.
 */

import Redis from 'ioredis';
import type { EnvConfig } from '../../config/env.config.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('RedisService');

let redisInstance: Redis | null = null;

/**
 * Create (or return) the Redis singleton.
 */
export function createRedisClient(config: EnvConfig): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  redisInstance = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db: config.REDIS_DB,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisInstance.on('error', (error: Error) => {
    log.error({ err: error }, 'Redis connection error');
  });

  return redisInstance;
}

/** Access the already-created Redis client */
export function getRedisClient(): Redis {
  if (!redisInstance) {
    throw new Error('Redis has not been initialized. Call createRedisClient() first.');
  }

  return redisInstance;
}

/** Connect and verify Redis with PING */
export async function connectRedis(client: Redis): Promise<void> {
  if (client.status === 'ready') {
    await client.ping();
    log.info('Redis connected');
    return;
  }

  if (client.status === 'connecting' || client.status === 'wait') {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        client.off('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        client.off('ready', onReady);
        reject(err);
      };
      client.once('ready', onReady);
      client.once('error', onError);
    });

    log.info('Redis connected');
    return;
  }

  await client.connect();
  log.info('Redis connected');
}

/** Gracefully disconnect Redis */
export async function disconnectRedis(): Promise<void> {
  if (!redisInstance) {
    return;
  }

  await redisInstance.quit();
  redisInstance = null;
  log.info('Redis disconnected');
}
