/**
 * Ensures a Telegram user exists with default settings.
 */

import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type { UserEntity } from '../../../domain/entities/user.entity.js';
import type { UserSettingsEntity } from '../../../domain/entities/user-settings.entity.js';

export interface EnsureUserInput {
  readonly telegramId: bigint;
  readonly telegramUsername?: string;
  readonly firstName?: string;
}

export interface EnsureUserResult {
  readonly user: UserEntity;
  readonly settings: UserSettingsEntity;
}

export class EnsureUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly settings: UserSettingsRepository,
  ) {}

  async execute(input: EnsureUserInput): Promise<EnsureUserResult> {
    const user = await this.users.upsertByTelegramId({
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername,
      firstName: input.firstName,
    });

    const settings = await this.settings.getOrCreate(user.id);

    return { user, settings };
  }
}
