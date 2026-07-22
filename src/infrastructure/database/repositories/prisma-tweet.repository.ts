/**
 * Prisma implementation of TweetRepository.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type {
  TweetEntity,
  CreateTweetData,
  UpdateTweetData,
} from '../../../domain/entities/tweet.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { mapTweet } from '../mappers/prisma.mappers.js';

export class PrismaTweetRepository implements TweetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<TweetEntity | null> {
    const row = await this.prisma.tweet.findUnique({ where: { id } });
    return row ? mapTweet(row) : null;
  }

  async findByUserId(userId: string): Promise<TweetEntity[]> {
    const rows = await this.prisma.tweet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapTweet);
  }

  async findByAccountId(accountId: string): Promise<TweetEntity[]> {
    const rows = await this.prisma.tweet.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapTweet);
  }

  async findByAccountAndTweetId(
    accountId: string,
    tweetId: string,
  ): Promise<TweetEntity | null> {
    const row = await this.prisma.tweet.findUnique({
      where: {
        accountId_tweetId: { accountId, tweetId },
      },
    });

    return row ? mapTweet(row) : null;
  }

  async findActivelyMonitored(): Promise<TweetEntity[]> {
    const rows = await this.prisma.tweet.findMany({
      where: { isMonitoring: true },
      orderBy: { lastCheckedAt: 'asc' },
    });

    return rows.map(mapTweet);
  }

  async countByAccountId(accountId: string): Promise<number> {
    return this.prisma.tweet.count({ where: { accountId } });
  }

  async create(data: CreateTweetData): Promise<TweetEntity> {
    const row = await this.prisma.tweet.create({
      data: {
        userId: data.userId,
        accountId: data.accountId,
        tweetId: data.tweetId,
        tweetUrl: data.tweetUrl,
        tweetText: data.tweetText ?? null,
        authorId: data.authorId ?? null,
      },
    });

    return mapTweet(row);
  }

  async update(id: string, data: UpdateTweetData): Promise<TweetEntity> {
    try {
      const row = await this.prisma.tweet.update({
        where: { id },
        data: {
          ...(data.isMonitoring !== undefined && { isMonitoring: data.isMonitoring }),
          ...(data.lastCheckedAt !== undefined && {
            lastCheckedAt: data.lastCheckedAt,
          }),
          ...(data.sinceId !== undefined && { sinceId: data.sinceId }),
          ...(data.tweetText !== undefined && { tweetText: data.tweetText }),
          ...(data.authorId !== undefined && { authorId: data.authorId }),
        },
      });

      return mapTweet(row);
    } catch {
      throw new NotFoundError('Tweet', id);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.tweet.delete({ where: { id } });
    } catch {
      throw new NotFoundError('Tweet', id);
    }
  }
}
