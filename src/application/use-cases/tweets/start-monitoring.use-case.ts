import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { MonitoringJobRepository } from '../../../domain/repositories/monitoring-job.repository.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { BullQueueService } from '../../../infrastructure/bull/bull-queue.service.js';
import type { TweetEntity } from '../../../domain/entities/tweet.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('StartMonitoringUseCase');

export interface StartMonitoringInput {
  readonly userId: string;
  readonly tweetDbId: string;
}

export class StartMonitoringUseCase {
  constructor(
    private readonly tweets: TweetRepository,
    private readonly monitoringJobs: MonitoringJobRepository,
    private readonly settings: UserSettingsRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly queue: BullQueueService,
  ) {}

  async execute(input: StartMonitoringInput): Promise<TweetEntity> {
    const tweet = await this.tweets.findById(input.tweetDbId);

    if (tweet?.userId !== input.userId) {
      throw new NotFoundError('Tweet', input.tweetDbId);
    }

    const userSettings = await this.settings.getOrCreate(input.userId);

    const bullJobId = await this.queue.addRepeatableJob(
      tweet.id,
      userSettings.checkIntervalSec,
    );

    const existingJob = await this.monitoringJobs.findByTweetId(tweet.id);

    if (existingJob) {
      await this.monitoringJobs.update(existingJob.id, {
        isActive: true,
        intervalSeconds: userSettings.checkIntervalSec,
        bullJobId,
      });
    } else {
      await this.monitoringJobs.create({
        tweetId: tweet.id,
        intervalSeconds: userSettings.checkIntervalSec,
        bullJobId,
      });
    }

    const updated = await this.tweets.update(tweet.id, { isMonitoring: true });

    await this.actionLogs.create({
      userId: input.userId,
      action: 'MONITORING_STARTED',
      details: {
        tweetDbId: tweet.id,
        tweetId: tweet.tweetId,
        intervalSeconds: userSettings.checkIntervalSec,
      },
    });

    log.info({ tweetDbId: tweet.id }, 'Monitoring started');

    return updated;
  }
}
