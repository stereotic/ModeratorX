/**
 * Starts X OAuth 2.0 PKCE for a Telegram user.
 * Ensures User + UserSettings exist, stores PKCE state in Redis, returns auth URL.
 */

import type { EnvConfig } from '../../../config/env.config.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { OAuthStateStore } from '../../../infrastructure/twitter/oauth-state.store.js';
import type { TwitterOAuthService } from '../../../infrastructure/twitter/twitter-oauth.service.js';
import { LimitExceededError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('StartOAuthUseCase');

export interface StartOAuthInput {
  readonly telegramId: bigint;
  readonly telegramUsername?: string;
  readonly firstName?: string;
}

export interface StartOAuthResult {
  readonly authorizationUrl: string;
  readonly userId: string;
}

export class StartOAuthUseCase {
  constructor(
    private readonly config: EnvConfig,
    private readonly users: UserRepository,
    private readonly settings: UserSettingsRepository,
    private readonly accounts: TwitterAccountRepository,
    private readonly oauth: TwitterOAuthService,
    private readonly stateStore: OAuthStateStore,
  ) {}

  async execute(input: StartOAuthInput): Promise<StartOAuthResult> {
    const user = await this.users.upsertByTelegramId({
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername,
      firstName: input.firstName,
    });

    await this.settings.getOrCreate(user.id);

    const accountCount = await this.accounts.countByUserId(user.id);

    if (accountCount >= this.config.MAX_TWITTER_ACCOUNTS_PER_USER) {
      throw new LimitExceededError(
        `Maximum of ${this.config.MAX_TWITTER_ACCOUNTS_PER_USER} X accounts per user reached`,
      );
    }

    const { url, state, codeVerifier } = this.oauth.createAuthorizationUrl();

    await this.stateStore.save(state, {
      userId: user.id,
      telegramId: input.telegramId.toString(),
      codeVerifier,
    });

    log.info({ userId: user.id }, 'OAuth flow started');

    return {
      authorizationUrl: url,
      userId: user.id,
    };
  }
}
