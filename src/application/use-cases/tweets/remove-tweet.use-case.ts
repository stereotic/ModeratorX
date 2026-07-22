import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { MonitoringJobRepository } from '../../../domain/repositories/monitoring-job.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { BullQueueService } from '../../../infrastructure/bull/bull-queue.service.js';
import { NotFoundError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('RemoveTweetUseCase');

export interface RemoveTweetInput {
  readonly userId: string;
  readonly tweetDbId: string;
}

export class RemoveTweetUseCase {
  constructor(
    private readonly tweets: TweetRepository,
    private readonly monitoringJobs: MonitoringJobRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly queue: BullQueueService,
  ) {}

  async execute(input: RemoveTweetInput): Promise<void> {
    const tweet = await this.tweets.findById(input.tweetDbId);

    if (tweet?.userId !== input.userId) {
      throw new NotFoundError('Tweet', input.tweetDbId);
    }

    await this.queue.removeRepeatableJob(tweet.id);

    const job = await this.monitoringJobs.findByTweetId(tweet.id);

    if (job) {
      await this.monitoringJobs.delete(job.id);
    }

    await this.tweets.delete(tweet.id);

    await this.actionLogs.create({
      userId: input.userId,
      action: 'TWEET_REMOVED',
      details: { tweetDbId: tweet.id, tweetId: tweet.tweetId },
    });

    log.info({ userId: input.userId, tweetDbId: tweet.id }, 'Tweet removed');
  }
}
