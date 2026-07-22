/**
 * Prisma implementation of TwitterAccountRepository.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type {
  TwitterAccountEntity,
  CreateTwitterAccountData,
  UpdateTwitterAccountData,
} from '../../../domain/entities/twitter-account.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { mapTwitterAccount } from '../mappers/prisma.mappers.js';

export class PrismaTwitterAccountRepository implements TwitterAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<TwitterAccountEntity | null> {
    const row = await this.prisma.twitterAccount.findUnique({ where: { id } });
    return row ? mapTwitterAccount(row) : null;
  }

  async findByUserId(userId: string): Promise<TwitterAccountEntity[]> {
    const rows = await this.prisma.twitterAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(mapTwitterAccount);
  }

  async findByTwitterUserId(twitterUserId: string): Promise<TwitterAccountEntity | null> {
    const row = await this.prisma.twitterAccount.findFirst({
      where: { twitterUserId },
    });

    return row ? mapTwitterAccount(row) : null;
  }

  async findByUserAndTwitterId(
    userId: string,
    twitterUserId: string,
  ): Promise<TwitterAccountEntity | null> {
    const row = await this.prisma.twitterAccount.findUnique({
      where: {
        userId_twitterUserId: { userId, twitterUserId },
      },
    });

    return row ? mapTwitterAccount(row) : null;
  }

  async findWithExpiringTokens(beforeDate: Date): Promise<TwitterAccountEntity[]> {
    const rows = await this.prisma.twitterAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: { lte: beforeDate },
      },
      orderBy: { tokenExpiresAt: 'asc' },
    });

    return rows.map(mapTwitterAccount);
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.twitterAccount.count({ where: { userId } });
  }

  async create(data: CreateTwitterAccountData): Promise<TwitterAccountEntity> {
    const row = await this.prisma.twitterAccount.create({
      data: {
        userId: data.userId,
        twitterUserId: data.twitterUserId,
        twitterUsername: data.twitterUsername,
        displayName: data.displayName ?? null,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      },
    });

    return mapTwitterAccount(row);
  }

  async update(id: string, data: UpdateTwitterAccountData): Promise<TwitterAccountEntity> {
    try {
      const row = await this.prisma.twitterAccount.update({
        where: { id },
        data: {
          ...(data.twitterUsername !== undefined && {
            twitterUsername: data.twitterUsername,
          }),
          ...(data.displayName !== undefined && { displayName: data.displayName }),
          ...(data.accessToken !== undefined && { accessToken: data.accessToken }),
          ...(data.refreshToken !== undefined && { refreshToken: data.refreshToken }),
          ...(data.tokenExpiresAt !== undefined && {
            tokenExpiresAt: data.tokenExpiresAt,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      return mapTwitterAccount(row);
    } catch {
      throw new NotFoundError('TwitterAccount', id);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.twitterAccount.delete({ where: { id } });
    } catch {
      throw new NotFoundError('TwitterAccount', id);
    }
  }
}
