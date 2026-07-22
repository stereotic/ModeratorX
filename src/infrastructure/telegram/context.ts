/**
 * grammY context flavors for the moderation bot.
 */

import type { Context, SessionFlavor } from 'grammy';
import type { UserEntity } from '../../domain/entities/user.entity.js';
import type { AppContainer } from '../../container.js';

/** Pending text-input flows driven by session */
export type AwaitingInput =
  | 'tweet_url'
  | 'gpt_prompt'
  | 'check_interval'
  | 'confidence'
  | null;

export interface BotSessionData {
  awaiting: AwaitingInput;
  /** Account selected before waiting for a tweet URL */
  selectedAccountId: string | null;
}

export interface BotServicesFlavor {
  readonly container: AppContainer;
  readonly dbUser: UserEntity;
}

export type BotContext = Context & SessionFlavor<BotSessionData> & BotServicesFlavor;

export function createInitialSession(): BotSessionData {
  return {
    awaiting: null,
    selectedAccountId: null,
  };
}
