/**
 * Prisma implementation of UserSettingsRepository.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type {
  UserSettingsEntity,
  CreateUserSettingsData,
  UpdateUserSettingsData,
} from '../../../domain/entities/user-settings.entity.js';
import { NotFoundError } from '../../../shared/errors.js';
import { mapUserSettings } from '../mappers/prisma.mappers.js';

export class PrismaUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserSettingsEntity | null> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    return row ? mapUserSettings(row) : null;
  }

  async create(data: CreateUserSettingsData): Promise<UserSettingsEntity> {
    const row = await this.prisma.userSettings.create({
      data: {
        userId: data.userId,
        ...(data.gptPrompt !== undefined && { gptPrompt: data.gptPrompt }),
        ...(data.checkIntervalSec !== undefined && {
          checkIntervalSec: data.checkIntervalSec,
        }),
        ...(data.moderationMode !== undefined && {
          moderationMode: data.moderationMode,
        }),
        ...(data.confidenceThreshold !== undefined && {
          confidenceThreshold: data.confidenceThreshold,
        }),
        ...(data.dailyTokenBudget !== undefined && {
          dailyTokenBudget: data.dailyTokenBudget,
        }),
      },
    });

    return mapUserSettings(row);
  }

  async updateByUserId(
    userId: string,
    data: UpdateUserSettingsData,
  ): Promise<UserSettingsEntity> {
    try {
      const row = await this.prisma.userSettings.update({
        where: { userId },
        data: {
          ...(data.gptPrompt !== undefined && { gptPrompt: data.gptPrompt }),
          ...(data.checkIntervalSec !== undefined && {
            checkIntervalSec: data.checkIntervalSec,
          }),
          ...(data.moderationMode !== undefined && {
            moderationMode: data.moderationMode,
          }),
          ...(data.confidenceThreshold !== undefined && {
            confidenceThreshold: data.confidenceThreshold,
          }),
          ...(data.dailyTokenBudget !== undefined && {
            dailyTokenBudget: data.dailyTokenBudget,
          }),
        },
      });

      return mapUserSettings(row);
    } catch {
      throw new NotFoundError('UserSettings', userId);
    }
  }

  async getOrCreate(userId: string): Promise<UserSettingsEntity> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }

    return this.create({ userId });
  }
}
