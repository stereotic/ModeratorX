/**
 * UserSettings domain entity.
 *
 * Separates product preferences from Telegram identity.
 * Defaults match commercial-safe Basic/pay-per-use X API usage.
 */

import type { ModerationMode } from '../enums/index.js';

export interface UserSettingsEntity {
  readonly id: string;
  readonly userId: string;
  readonly gptPrompt: string | null;
  readonly checkIntervalSec: number;
  readonly moderationMode: ModerationMode;
  readonly confidenceThreshold: number;
  readonly dailyTokenBudget: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data required to create default settings for a new user */
export interface CreateUserSettingsData {
  readonly userId: string;
  readonly gptPrompt?: string;
  readonly checkIntervalSec?: number;
  readonly moderationMode?: ModerationMode;
  readonly confidenceThreshold?: number;
  readonly dailyTokenBudget?: number | null;
}

/** Fields that can be updated on user settings */
export interface UpdateUserSettingsData {
  readonly gptPrompt?: string | null;
  readonly checkIntervalSec?: number;
  readonly moderationMode?: ModerationMode;
  readonly confidenceThreshold?: number;
  readonly dailyTokenBudget?: number | null;
}
