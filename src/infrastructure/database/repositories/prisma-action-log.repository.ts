/**
 * Prisma implementation of ActionLogRepository.
 */

import type { PrismaClient, Prisma } from '../../../generated/prisma/client.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { ActionType } from '../../../domain/enums/index.js';
import type {
  ActionLogEntity,
  CreateActionLogData,
} from '../../../domain/entities/action-log.entity.js';
import { mapActionLog } from '../mappers/prisma.mappers.js';

const DEFAULT_RECENT_LIMIT = 20;

export class PrismaActionLogRepository implements ActionLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRecentByUserId(
    userId: string,
    limit: number = DEFAULT_RECENT_LIMIT,
  ): Promise<ActionLogEntity[]> {
    const rows = await this.prisma.actionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map(mapActionLog);
  }

  async countByActionForUser(
    userId: string,
  ): Promise<Partial<Record<ActionType, number>>> {
    const grouped = await this.prisma.actionLog.groupBy({
      by: ['action'],
      where: { userId },
      _count: { _all: true },
    });

    const result: Partial<Record<ActionType, number>> = {};

    for (const item of grouped) {
      result[item.action] = item._count._all;
    }

    return result;
  }

  async create(data: CreateActionLogData): Promise<ActionLogEntity> {
    const details: Prisma.InputJsonValue | undefined =
      data.details !== undefined
        ? (data.details as Prisma.InputJsonValue)
        : undefined;

    const row = await this.prisma.actionLog.create({
      data: {
        userId: data.userId,
        replyId: data.replyId ?? null,
        action: data.action,
        ...(details !== undefined && { details }),
        isSuccess: data.isSuccess ?? true,
        errorMessage: data.errorMessage ?? null,
      },
    });

    return mapActionLog(row);
  }
}
