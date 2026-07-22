/**
 * Ensures a TwitterAccount has a valid (non-expired) access token.
 *
 * Decrypts tokens, refreshes when within skew window, re-encrypts and persists.
 */

import type { EnvConfig } from '../../config/env.config.js';
import type { TwitterAccountEntity } from '../../domain/entities/twitter-account.entity.js';
import type { TwitterAccountRepository } from '../../domain/repositories/twitter-account.repository.js';
import type { ActionLogRepository } from '../../domain/repositories/action-log.repository.js';
import type { CryptoService } from '../../shared/crypto.service.js';
import { AuthenticationError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';
import type { TwitterOAuthService } from './twitter-oauth.service.js';

const log = createLogger('TwitterAccountAuthService');

export interface AuthenticatedAccountSession {
  readonly account: TwitterAccountEntity;
  readonly accessToken: string;
}

export class TwitterAccountAuthService {
  constructor(
    private readonly config: EnvConfig,
    private readonly crypto: CryptoService,
    private readonly oauth: TwitterOAuthService,
    private readonly accounts: TwitterAccountRepository,
    private readonly actionLogs: ActionLogRepository,
  ) {}

  /**
   * Return a plaintext access token for the account, refreshing if needed.
   */
  async getValidAccessToken(accountId: string): Promise<AuthenticatedAccountSession> {
    const account = await this.accounts.findById(accountId);

    if (!account?.isActive) {
      throw new AuthenticationError(`Twitter account ${accountId} is missing or inactive`);
    }

    const now = Date.now();
    const refreshThreshold =
      account.tokenExpiresAt.getTime() - this.config.TOKEN_REFRESH_SKEW_SECONDS * 1000;

    if (now < refreshThreshold) {
      const accessToken = this.crypto.decrypt(account.accessToken);
      return {
        account,
        accessToken,
      };
    }

    log.info({ accountId }, 'Access token near expiry — refreshing');

    let plaintextRefresh: string | null = null;
    try {
      plaintextRefresh = this.crypto.decrypt(account.refreshToken);
      const refreshed = await this.oauth.refreshTokens(plaintextRefresh);

      const updated = await this.accounts.update(accountId, {
        accessToken: this.crypto.encrypt(refreshed.accessToken),
        refreshToken: this.crypto.encrypt(refreshed.refreshToken),
        tokenExpiresAt: refreshed.expiresAt,
      });

      await this.actionLogs.create({
        userId: account.userId,
        action: 'TOKEN_REFRESHED',
        details: { accountId, twitterUserId: account.twitterUserId },
      });

      return {
        account: updated,
        accessToken: refreshed.accessToken,
      };
    } finally {
      plaintextRefresh = null;
    }
  }
}
