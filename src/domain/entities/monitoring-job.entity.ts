/**
 * MonitoringJob domain entity.
 *
 * Tracks the BullMQ repeatable job for each monitored tweet.
 * Used for restart recovery — on startup, all active jobs
 * are re-registered in BullMQ.
 */

export interface MonitoringJobEntity {
  readonly id: string;
  readonly tweetId: string;
  readonly bullJobId: string | null;
  readonly intervalSeconds: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data required to create a monitoring job */
export interface CreateMonitoringJobData {
  readonly tweetId: string;
  readonly bullJobId?: string;
  readonly intervalSeconds: number;
}

/** Fields that can be updated on a monitoring job */
export interface UpdateMonitoringJobData {
  readonly bullJobId?: string | null;
  readonly intervalSeconds?: number;
  readonly isActive?: boolean;
}
