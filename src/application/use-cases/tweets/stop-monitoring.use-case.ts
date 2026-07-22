import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { MonitoringJobRepository } from '../../../domain/repositories/monitoring-job.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { BullQueueService } from '../../../infrastructure/bull/bull-queue.service.js';
import type { TweetEntity } from '../../../domain/entities/tweet.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('StopMonitoringUseCase');

export interface StopMonitoringInput {
  readonly userId: string;
  readonly tweetDbId: string;
}

export class StopMonitoringUseCase {
  constructor(
    private readonly tweets: TweetRepository,
    private readonly monitoringJobs: MonitoringJobRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly queue: BullQueueService,
  ) {}

  async execute(input: StopMonitoringInput): Promise<TweetEntity> {
    const tweet = await this.tweets.findById(input.tweetDbId);

    if (tweet?.userId !== input.userId) {
      throw new NotFoundError('Tweet', input.tweetDbId);
    }

    await this.queue.removeRepeatableJob(tweet.id);

    const job = await this.monitoringJobs.findByTweetId(tweet.id);

    if (job) {
      await this.monitoringJobs.update(job.id, { isActive: false, bullJobId: null });
    }

    const updated = await this.tweets.update(tweet.id, { isMonitoring: false });

    await this.actionLogs.create({
      userId: input.userId,
      action: 'MONITORING_STOPPED',
      details: { tweetDbId: tweet.id, tweetId: tweet.tweetId },
    });

    log.info({ tweetDbId: tweet.id }, 'Monitoring stopped');

    return updated;
  }
}
