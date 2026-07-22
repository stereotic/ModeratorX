import { Worker } from 'bullmq';
import type Redis from 'ioredis';
import type { DiscoverRepliesUseCase } from '../../application/use-cases/replies/discover-replies.use-case.js';
import type { ProcessReplyUseCase } from '../../application/use-cases/replies/process-reply.use-case.js';
import type { RetryFailedRepliesUseCase } from '../../application/use-cases/replies/retry-failed-replies.use-case.js';
import type { RefreshExpiringTokensUseCase } from '../../application/use-cases/accounts/refresh-expiring-tokens.use-case.js';
import type { ReplyRepository } from '../../domain/repositories/reply.repository.js';
import {
  MONITORING_QUEUE_NAME,
  CHECK_TWEET_JOB_NAME,
  HOUSEKEEPING_QUEUE_NAME,
  REFRESH_TOKENS_JOB_NAME,
  RETRY_REPLIES_JOB_NAME,
} from './index.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('BullWorkerService');

export class BullWorkerService {
  private readonly monitoringWorker: Worker;
  private readonly housekeepingWorker: Worker;

  constructor(
    redis: Redis,
    private readonly discoverReplies: DiscoverRepliesUseCase,
    private readonly processReply: ProcessReplyUseCase,
    private readonly retryFailed: RetryFailedRepliesUseCase,
    private readonly refreshTokens: RefreshExpiringTokensUseCase,
    private readonly replies: ReplyRepository,
  ) {
    this.monitoringWorker = new Worker(
      MONITORING_QUEUE_NAME,
      async (job) => {
        if (job.name === CHECK_TWEET_JOB_NAME) {
          await this.handleCheckTweet(job.data as { tweetDbId: string });
        }
      },
      {
        connection: redis,
        concurrency: 5,
      },
    );

    this.monitoringWorker.on('completed', (job) => {
      log.debug({ jobId: job.id, name: job.name }, 'Monitoring job completed');
    });

    this.monitoringWorker.on('failed', (job, error) => {
      log.error({ jobId: job?.id, name: job?.name, err: error }, 'Monitoring job failed');
    });

    this.monitoringWorker.on('error', (error) => {
      log.error({ err: error }, 'Monitoring worker error');
    });

    this.housekeepingWorker = new Worker(
      HOUSEKEEPING_QUEUE_NAME,
      async (job) => {
        if (job.name === REFRESH_TOKENS_JOB_NAME) {
          await this.handleRefreshTokens();
        } else if (job.name === RETRY_REPLIES_JOB_NAME) {
          await this.handleRetryReplies();
        }
      },
      {
        connection: redis,
        concurrency: 1,
      },
    );

    this.housekeepingWorker.on('completed', (job) => {
      log.debug({ jobId: job.id, name: job.name }, 'Housekeeping job completed');
    });

    this.housekeepingWorker.on('failed', (job, error) => {
      log.error({ jobId: job?.id, name: job?.name, err: error }, 'Housekeeping job failed');
    });

    this.housekeepingWorker.on('error', (error) => {
      log.error({ err: error }, 'Housekeeping worker error');
    });

    log.info('BullMQ workers initialized (monitoring + housekeeping)');
  }

  async close(): Promise<void> {
    await this.monitoringWorker.close();
    await this.housekeepingWorker.close();
    log.info('BullMQ workers closed');
  }

  private async handleCheckTweet(data: { tweetDbId: string }): Promise<void> {
    const { tweetDbId } = data;

    log.info({ tweetDbId }, 'Processing check-tweet job');

    await this.discoverReplies.execute({ tweetId: tweetDbId });

    const [pendingReplies, failedReplies] = await Promise.all([
      this.replies.findByTweetIdAndStatuses(tweetDbId, ['DISCOVERED']),
      this.replies.findByTweetIdAndStatuses(tweetDbId, ['FAILED']),
    ]);

    const retryableFailed = failedReplies.filter((r) => r.attempts < 3);

    for (const reply of [...pendingReplies, ...retryableFailed]) {
      try {
        if (reply.status === 'FAILED') {
          await this.replies.update(reply.id, { status: 'DISCOVERED', failureReason: null });
        }

        await this.processReply.execute({ replyId: reply.id });
      } catch (error) {
        log.error({ replyId: reply.id, tweetDbId, err: error }, 'Failed to process reply');
      }
    }
  }

  private async handleRefreshTokens(): Promise<void> {
    log.info('Starting scheduled token refresh');
    await this.refreshTokens.execute();
  }

  private async handleRetryReplies(): Promise<void> {
    log.info('Starting retry sweep for failed replies');
    await this.retryFailed.execute();
  }
}
