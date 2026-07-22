/**
 * Prisma implementation of ReplyRepository.
 *
 * claimForProcessing uses updateMany as an atomic CAS on status
 * to prevent two workers from processing the same reply.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { ReplyRepository } from '../../../domain/repositories/reply.repository.js';
import type { ReplyStatus } from '../../../domain/enums/index.js';
import type {
  ReplyEntity,
  CreateReplyData,
  UpdateReplyData,
} from '../../../domain/entities/reply.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { mapReply } from '../mappers/prisma.mappers.js';

export class PrismaReplyRepository implements ReplyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<ReplyEntity | null> {
    const row = await this.prisma.reply.findUnique({ where: { id } });
    return row ? mapReply(row) : null;
  }

  async findByReplyTweetId(replyTweetId: string): Promise<ReplyEntity | null> {
    const row = await this.prisma.reply.findUnique({ where: { replyTweetId } });
    return row ? mapReply(row) : null;
  }

  async findByTweetId(tweetId: string): Promise<ReplyEntity[]> {
    const rows = await this.prisma.reply.findMany({
      where: { tweetId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapReply);
  }

  async findByTweetIdAndStatuses(
    tweetId: string,
    statuses: readonly ReplyStatus[],
  ): Promise<ReplyEntity[]> {
    const rows = await this.prisma.reply.findMany({
      where: {
        tweetId,
        status: { in: [...statuses] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(mapReply);
  }

  async findAllByStatuses(statuses: readonly ReplyStatus[]): Promise<ReplyEntity[]> {
    const rows = await this.prisma.reply.findMany({
      where: {
        status: { in: [...statuses] },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return rows.map(mapReply);
  }

  async claimForProcessing(
    id: string,
    fromStatus: ReplyStatus,
    toStatus: ReplyStatus,
  ): Promise<ReplyEntity | null> {
    const result = await this.prisma.reply.updateMany({
      where: {
        id,
        status: fromStatus,
      },
      data: {
        status: toStatus,
        attempts: { increment: 1 },
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id);
  }

  async countBySentimentForUser(userId: string): Promise<{
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }> {
    const grouped = await this.prisma.reply.groupBy({
      by: ['sentiment'],
      where: {
        tweet: { userId },
        sentiment: { not: null },
      },
      _count: { _all: true },
    });

    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const item of grouped) {
      const count = item._count._all;

      if (item.sentiment === 'POSITIVE') {
        positive = count;
      } else if (item.sentiment === 'NEGATIVE') {
        negative = count;
      } else if (item.sentiment === 'NEUTRAL') {
        neutral = count;
      }
    }

    return {
      positive,
      negative,
      neutral,
      total: positive + negative + neutral,
    };
  }

  async create(data: CreateReplyData): Promise<ReplyEntity> {
    const row = await this.prisma.reply.create({
      data: {
        tweetId: data.tweetId,
        replyTweetId: data.replyTweetId,
        authorId: data.authorId,
        authorUsername: data.authorUsername ?? null,
        text: data.text,
      },
    });

    return mapReply(row);
  }

  async createManyIgnoreDuplicates(data: CreateReplyData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await this.prisma.reply.createMany({
      data: data.map((item) => ({
        tweetId: item.tweetId,
        replyTweetId: item.replyTweetId,
        authorId: item.authorId,
        authorUsername: item.authorUsername ?? null,
        text: item.text,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async update(id: string, data: UpdateReplyData): Promise<ReplyEntity> {
    try {
      const row = await this.prisma.reply.update({
        where: { id },
        data: {
          ...(data.status !== undefined && {
            status: data.status,
          }),
          ...(data.sentiment !== undefined && { sentiment: data.sentiment }),
          ...(data.confidence !== undefined && { confidence: data.confidence }),
          ...(data.wasReplied !== undefined && { wasReplied: data.wasReplied }),
          ...(data.wasHidden !== undefined && { wasHidden: data.wasHidden }),
          ...(data.postedReplyId !== undefined && {
            postedReplyId: data.postedReplyId,
          }),
          ...(data.attempts !== undefined && { attempts: data.attempts }),
          ...(data.failureReason !== undefined && {
            failureReason: data.failureReason,
          }),
          ...(data.processedAt !== undefined && {
            processedAt: data.processedAt,
          }),
        },
      });

      return mapReply(row);
    } catch {
      throw new NotFoundError('Reply', id);
    }
  }
}
