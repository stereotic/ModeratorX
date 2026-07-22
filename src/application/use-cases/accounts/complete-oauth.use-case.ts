/**
 * Completes X OAuth after callback: exchange code, encrypt tokens, persist account.
 */

import type { EnvConfig } from '../../../config/env.config.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { TwitterAccountEntity } from '../../../domain/entities/twitter-account.entity.js';
import type { OAuthStateStore } from '../../../infrastructure/twitter/oauth-state.store.js';
import type { TwitterOAuthService } from '../../../infrastructure/twitter/twitter-oauth.service.js';
import type { CryptoService } from '../../../shared/crypto.service.js';
import { ConflictError, LimitExceededError, ValidationError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('CompleteOAuthUseCase');

export interface CompleteOAuthInput {
  readonly state: string;
  readonly code: string;
}

export interface CompleteOAuthResult {
  readonly account: TwitterAccountEntity;
  readonly telegramId: bigint;
  readonly isReconnect: boolean;
}

/** Optional hook for Telegram notification (wired in Stage 4) */
export type AccountConnectedNotifier = (event: {
  readonly telegramId: bigint;
  readonly twitterUsername: string;
  readonly isReconnect: boolean;
}) => Promise<void>;

export class CompleteOAuthUseCase {
  private notifier: AccountConnectedNotifier | null = null;

  constructor(
    private readonly config: EnvConfig,
    private readonly accounts: TwitterAccountRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly oauth: TwitterOAuthService,
    private readonly stateStore: OAuthStateStore,
    private readonly crypto: CryptoService,
  ) {}

  /** Register a notifier (bot process sets this to send Telegram messages) */
  setNotifier(notifier: AccountConnectedNotifier): void {
    this.notifier = notifier;
  }

  async execute(input: CompleteOAuthInput): Promise<CompleteOAuthResult> {
    if (!input.state || !input.code) {
      throw new ValidationError('Missing OAuth state or code', 'oauth');
    }

    const oauthState = await this.stateStore.consume(input.state);
    const { tokens, profile } = await this.oauth.exchangeCode({
      code: input.code,
      codeVerifier: oauthState.codeVerifier,
    });

    const existingGlobal = await this.accounts.findByTwitterUserId(profile.id);

    if (existingGlobal && existingGlobal.userId !== oauthState.userId) {
      throw new ConflictError(
        `X account @${profile.username} is already linked to another Telegram user`,
      );
    }

    const existingForUser = await this.accounts.findByUserAndTwitterId(
      oauthState.userId,
      profile.id,
    );

    const encryptedAccess = this.crypto.encrypt(tokens.accessToken);
    const encryptedRefresh = this.crypto.encrypt(tokens.refreshToken);

    let account: TwitterAccountEntity;
    let isReconnect = false;

    if (existingForUser) {
      account = await this.accounts.update(existingForUser.id, {
        twitterUsername: profile.username,
        displayName: profile.name,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        isActive: true,
      });
      isReconnect = true;
    } else {
      const count = await this.accounts.countByUserId(oauthState.userId);

      if (count >= this.config.MAX_TWITTER_ACCOUNTS_PER_USER) {
        throw new LimitExceededError(
          `Maximum of ${this.config.MAX_TWITTER_ACCOUNTS_PER_USER} X accounts per user reached`,
        );
      }

      account = await this.accounts.create({
        userId: oauthState.userId,
        twitterUserId: profile.id,
        twitterUsername: profile.username,
        displayName: profile.name,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
      });
    }

    await this.actionLogs.create({
      userId: oauthState.userId,
      action: 'ACCOUNT_CONNECTED',
      details: {
        accountId: account.id,
        twitterUserId: profile.id,
        twitterUsername: profile.username,
        isReconnect,
      },
    });

    const telegramId = BigInt(oauthState.telegramId);

    if (this.notifier) {
      try {
        await this.notifier({
          telegramId,
          twitterUsername: profile.username,
          isReconnect,
        });
      } catch (error) {
        log.warn({ err: error }, 'Account connected notifier failed');
      }
    }

    log.info(
      { userId: oauthState.userId, accountId: account.id, isReconnect },
      'X account connected',
    );

    return { account, telegramId, isReconnect };
  }
}
