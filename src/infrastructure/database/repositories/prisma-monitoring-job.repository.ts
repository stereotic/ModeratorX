/**
 * Prisma implementation of MonitoringJobRepository.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { MonitoringJobRepository } from '../../../domain/repositories/monitoring-job.repository.js';
import type {
  MonitoringJobEntity,
  CreateMonitoringJobData,
  UpdateMonitoringJobData,
} from '../../../domain/entities/monitoring-job.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { mapMonitoringJob } from '../mappers/prisma.mappers.js';

export class PrismaMonitoringJobRepository implements MonitoringJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<MonitoringJobEntity | null> {
    const row = await this.prisma.monitoringJob.findUnique({ where: { id } });
    return row ? mapMonitoringJob(row) : null;
  }

  async findByTweetId(tweetId: string): Promise<MonitoringJobEntity | null> {
    const row = await this.prisma.monitoringJob.findUnique({ where: { tweetId } });
    return row ? mapMonitoringJob(row) : null;
  }

  async findAllActive(): Promise<MonitoringJobEntity[]> {
    const rows = await this.prisma.monitoringJob.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(mapMonitoringJob);
  }

  async create(data: CreateMonitoringJobData): Promise<MonitoringJobEntity> {
    const row = await this.prisma.monitoringJob.create({
      data: {
        tweetId: data.tweetId,
        bullJobId: data.bullJobId ?? null,
        intervalSeconds: data.intervalSeconds,
      },
    });

    return mapMonitoringJob(row);
  }

  async update(
    id: string,
    data: UpdateMonitoringJobData,
  ): Promise<MonitoringJobEntity> {
    try {
      const row = await this.prisma.monitoringJob.update({
        where: { id },
        data: {
          ...(data.bullJobId !== undefined && { bullJobId: data.bullJobId }),
          ...(data.intervalSeconds !== undefined && {
            intervalSeconds: data.intervalSeconds,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      return mapMonitoringJob(row);
    } catch {
      throw new NotFoundError('MonitoringJob', id);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.monitoringJob.delete({ where: { id } });
    } catch {
      throw new NotFoundError('MonitoringJob', id);
    }
  }
}
