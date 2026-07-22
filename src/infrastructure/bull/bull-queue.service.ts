import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('BullQueueService');

export const MONITORING_QUEUE_NAME = 'monitoring';
export const CHECK_TWEET_JOB_NAME = 'check-tweet';

export interface CheckTweetJobData {
  readonly tweetDbId: string;
}

export class BullQueueService {
  private readonly queue: Queue;
  /** Track interval per tweet so we can rebuild the repeat key for removal */
  private readonly intervals = new Map<string, number>();

  constructor(redis: Redis) {
    this.queue = new Queue(MONITORING_QUEUE_NAME, {
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

  async addRepeatableJob(
    tweetDbId: string,
    intervalSeconds: number,
  ): Promise<string> {
    const jobId = this.buildJobId(tweetDbId);

    this.intervals.set(tweetDbId, intervalSeconds);

    await this.queue.add(
      CHECK_TWEET_JOB_NAME,
      { tweetDbId } satisfies CheckTweetJobData,
      {
        jobId,
        repeat: {
          every: intervalSeconds * 1000,
        },
      },
    );

    log.info(
      { tweetDbId, jobId, intervalSeconds },
      'Repeatable monitoring job added',
    );

    return jobId;
  }

  async updateRepeatableJob(
    tweetDbId: string,
    intervalSeconds: number,
  ): Promise<string> {
    await this.removeRepeatableJob(tweetDbId);
    return this.addRepeatableJob(tweetDbId, intervalSeconds);
  }

  async removeRepeatableJob(tweetDbId: string): Promise<void> {
    const jobId = this.buildJobId(tweetDbId);

    try {
      await this.queue.removeJobScheduler(jobId);
    } catch {
      // scheduler may not exist — that's fine
    }

    this.intervals.delete(tweetDbId);

    log.info({ tweetDbId }, 'Repeatable monitoring job removed');
  }

  async getActiveJobIds(): Promise<Set<string>> {
    const schedulers = await this.queue.getJobSchedulers();
    const ids = new Set<string>();

    for (const scheduler of schedulers) {
      const id = scheduler.id;

      if (id) {
        ids.add(id);
      }
    }

    return ids;
  }

  async close(): Promise<void> {
    await this.queue.close();
    log.info('BullMQ queue closed');
  }

  private buildJobId(tweetDbId: string): string {
    return `${CHECK_TWEET_JOB_NAME}:${tweetDbId}`;
  }
}
