/**
 * Read / update user moderation settings with validation.
 */

import type { EnvConfig } from '../../../config/env.config.js';
import type { ModerationMode } from '../../../domain/enums/index.js';
import type { UserSettingsEntity } from '../../../domain/entities/user-settings.entity.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import { ValidationError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('UpdateSettingsUseCase');

const MODERATION_MODES: readonly ModerationMode[] = ['AUTO', 'NOTIFY_ONLY', 'DRY_RUN'];

export class GetSettingsUseCase {
  constructor(private readonly settings: UserSettingsRepository) {}

  async execute(userId: string): Promise<UserSettingsEntity> {
    return this.settings.getOrCreate(userId);
  }
}

export interface UpdateSettingsInput {
  readonly userId: string;
  readonly gptPrompt?: string | null;
  readonly checkIntervalSec?: number;
  readonly moderationMode?: ModerationMode;
  readonly confidenceThreshold?: number;
}

export class UpdateSettingsUseCase {
  constructor(
    private readonly config: EnvConfig,
    private readonly settings: UserSettingsRepository,
    private readonly actionLogs: ActionLogRepository,
  ) {}

  async execute(input: UpdateSettingsInput): Promise<UserSettingsEntity> {
    await this.settings.getOrCreate(input.userId);

    if (input.checkIntervalSec !== undefined) {
      if (
        input.checkIntervalSec < this.config.MIN_CHECK_INTERVAL ||
        input.checkIntervalSec > this.config.MAX_CHECK_INTERVAL
      ) {
        throw new ValidationError(
          `Interval must be between ${this.config.MIN_CHECK_INTERVAL} and ${this.config.MAX_CHECK_INTERVAL} seconds`,
          'checkIntervalSec',
        );
      }
    }

    if (input.confidenceThreshold !== undefined) {
      if (input.confidenceThreshold < 0 || input.confidenceThreshold > 1) {
        throw new ValidationError('Confidence must be between 0 and 1', 'confidenceThreshold');
      }
    }

    if (input.moderationMode !== undefined && !MODERATION_MODES.includes(input.moderationMode)) {
      throw new ValidationError('Invalid moderation mode', 'moderationMode');
    }

    if (input.gptPrompt !== undefined && input.gptPrompt !== null && input.gptPrompt.length > 4000) {
      throw new ValidationError('Prompt is too long (max 4000 characters)', 'gptPrompt');
    }

    const updated = await this.settings.updateByUserId(input.userId, {
      ...(input.gptPrompt !== undefined && { gptPrompt: input.gptPrompt }),
      ...(input.checkIntervalSec !== undefined && {
        checkIntervalSec: input.checkIntervalSec,
      }),
      ...(input.moderationMode !== undefined && { moderationMode: input.moderationMode }),
      ...(input.confidenceThreshold !== undefined && {
        confidenceThreshold: input.confidenceThreshold,
      }),
    });

    await this.actionLogs.create({
      userId: input.userId,
      action: 'SETTINGS_UPDATED',
      details: {
        gptPrompt: input.gptPrompt !== undefined,
        checkIntervalSec: input.checkIntervalSec,
        moderationMode: input.moderationMode,
        confidenceThreshold: input.confidenceThreshold,
      },
    });

    log.info({ userId: input.userId }, 'Settings updated');

    return updated;
  }
}
