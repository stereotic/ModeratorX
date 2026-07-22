/**
 * Prisma implementation of UserRepository.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type {
  UserEntity,
  CreateUserData,
  UpdateUserData,
} from '../../../domain/entities/user.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { mapUser } from '../mappers/prisma.mappers.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async findByTelegramId(telegramId: bigint): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { telegramId } });
    return row ? mapUser(row) : null;
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const row = await this.prisma.user.create({
      data: {
        telegramId: data.telegramId,
        telegramUsername: data.telegramUsername ?? null,
        firstName: data.firstName ?? null,
      },
    });

    return mapUser(row);
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.telegramUsername !== undefined && {
            telegramUsername: data.telegramUsername,
          }),
          ...(data.firstName !== undefined && { firstName: data.firstName }),
        },
      });

      return mapUser(row);
    } catch {
      throw new NotFoundError('User', id);
    }
  }

  async upsertByTelegramId(data: CreateUserData): Promise<UserEntity> {
    const row = await this.prisma.user.upsert({
      where: { telegramId: data.telegramId },
      create: {
        telegramId: data.telegramId,
        telegramUsername: data.telegramUsername ?? null,
        firstName: data.firstName ?? null,
      },
      update: {
        ...(data.telegramUsername !== undefined && {
          telegramUsername: data.telegramUsername,
        }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
      },
    });

    return mapUser(row);
  }
}
