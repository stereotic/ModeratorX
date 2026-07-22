import type Redis from 'ioredis';
import { createLogger } from '../../shared/logger.js';
import { RateLimitError } from '../../shared/errors.js';

const log = createLogger('RateLimiter');

export class RateLimiter {
  private readonly prefix: string;

  constructor(
    private readonly redis: Redis,
    prefix = 'rl',
  ) {
    this.prefix = prefix;
  }

  async acquire(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowKey = `${this.prefix}:${key}:${Math.floor(now / windowMs)}`;

    try {
      const count = await this.redis.incr(windowKey);

      if (count === 1) {
        await this.redis.pexpire(windowKey, windowMs);
      }

      if (count > maxRequests) {
        log.warn({ key, count, maxRequests }, 'Rate limit exceeded');
        return false;
      }

      return true;
    } catch (error) {
      log.error({ err: error, key }, 'Rate limiter error, allowing request');
      return true;
    }
  }

  async enforce(key: string, maxRequests: number, windowMs: number, apiName: string): Promise<void> {
    const allowed = await this.acquire(key, maxRequests, windowMs);

    if (!allowed) {
      throw new RateLimitError(apiName, Math.ceil(windowMs / 1000));
    }
  }
}
