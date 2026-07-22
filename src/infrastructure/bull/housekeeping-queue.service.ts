import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('HousekeepingQueue');

export const HOUSEKEEPING_QUEUE_NAME = 'housekeeping';
export const REFRESH_TOKENS_JOB_NAME = 'refresh-tokens';
export const RETRY_REPLIES_JOB_NAME = 'retry-replies';

export class HousekeepingQueue {
  private readonly queue: Queue;

  constructor(redis: Redis) {
    this.queue = new Queue(HOUSEKEEPING_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });
  }

  get nativeQueue(): Queue {
    return this.queue;
  }

  async scheduleHourlyRefresh(): Promise<void> {
    await this.queue.add(
      REFRESH_TOKENS_JOB_NAME,
      {},
      {
        jobId: REFRESH_TOKENS_JOB_NAME,
        repeat: { every: 60 * 60 * 1000 },
      },
    );

    log.info('Hourly token refresh scheduled');
  }

  async scheduleRetrySweep(): Promise<void> {
    await this.queue.add(
      RETRY_REPLIES_JOB_NAME,
      {},
      {
        jobId: RETRY_REPLIES_JOB_NAME,
        repeat: { every: 15 * 60 * 1000 },
      },
    );

    log.info('Retry sweep scheduled (every 15 min)');
  }

  async scheduleAll(): Promise<void> {
    await this.scheduleHourlyRefresh();
    await this.scheduleRetrySweep();
  }

  async close(): Promise<void> {
    await this.queue.close();
    log.info('Housekeeping queue closed');
  }
}
