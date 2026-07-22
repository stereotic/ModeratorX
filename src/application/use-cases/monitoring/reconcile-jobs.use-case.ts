import type { MonitoringJobRepository } from '../../../domain/repositories/monitoring-job.repository.js';
import type { BullQueueService } from '../../../infrastructure/bull/bull-queue.service.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('ReconcileJobsUseCase');

export interface ReconcileJobsResult {
  readonly registered: number;
  readonly removed: number;
}

export class ReconcileJobsUseCase {
  constructor(
    private readonly monitoringJobs: MonitoringJobRepository,
    private readonly queue: BullQueueService,
  ) {}

  async execute(): Promise<ReconcileJobsResult> {
    log.info('Reconciling monitoring jobs with BullMQ');

    const activeJobs = await this.monitoringJobs.findAllActive();
    const bullJobIds = await this.queue.getActiveJobIds();

    let registered = 0;
    let removed = 0;

    for (const job of activeJobs) {
      const expectedJobId = `check-tweet:${job.tweetId}`;

      const existing = bullJobIds.has(expectedJobId);

      if (existing) {
        await this.queue.removeRepeatableJob(job.tweetId);
      }

      await this.queue.addRepeatableJob(job.tweetId, job.intervalSeconds);
      registered += 1;
    }

    for (const bullJobId of bullJobIds) {
      const tweetDbId = bullJobId.replace('check-tweet:', '');
      const dbJob = await this.monitoringJobs.findByTweetId(tweetDbId);

      if (dbJob?.isActive !== true) {
        await this.queue.removeRepeatableJob(tweetDbId);
        removed += 1;
      }
    }

    log.info(
      { registered, removed, activeTotal: activeJobs.length },
      'Reconciliation complete',
    );

    return { registered, removed };
  }
}
