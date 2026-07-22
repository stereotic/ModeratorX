/**
 * MonitoringJob repository interface.
 * Defines data access operations for BullMQ job tracking.
 */

import type {
  MonitoringJobEntity,
  CreateMonitoringJobData,
  UpdateMonitoringJobData,
} from '../entities/monitoring-job.entity.js';

export interface MonitoringJobRepository {
  findById(id: string): Promise<MonitoringJobEntity | null>;

  /** Find monitoring job for a specific tweet */
  findByTweetId(tweetId: string): Promise<MonitoringJobEntity | null>;

  /** Find all active monitoring jobs (for restart recovery) */
  findAllActive(): Promise<MonitoringJobEntity[]>;

  create(data: CreateMonitoringJobData): Promise<MonitoringJobEntity>;
  update(id: string, data: UpdateMonitoringJobData): Promise<MonitoringJobEntity>;
  delete(id: string): Promise<void>;
}
