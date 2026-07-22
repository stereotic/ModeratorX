/**
 * Proactively refresh tokens for accounts nearing expiry.
 * Used by the worker on a schedule (Stage 5+).
 */

import type { EnvConfig } from '../../../config/env.config.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { TwitterAccountAuthService } from '../../../infrastructure/twitter/twitter-account-auth.service.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('RefreshExpiringTokensUseCase');

export interface RefreshExpiringTokensResult {
  readonly refreshed: number;
  readonly failed: number;
}

export class RefreshExpiringTokensUseCase {
  constructor(
    private readonly config: EnvConfig,
    private readonly accounts: TwitterAccountRepository,
    private readonly auth: TwitterAccountAuthService,
  ) {}

  async execute(): Promise<RefreshExpiringTokensResult> {
    const beforeDate = new Date(
      Date.now() + this.config.TOKEN_REFRESH_SKEW_SECONDS * 1000,
    );

    const expiring = await this.accounts.findWithExpiringTokens(beforeDate);

    let refreshed = 0;
    let failed = 0;

    for (const account of expiring) {
      try {
        await this.auth.getValidAccessToken(account.id);
        refreshed += 1;
      } catch (error) {
        failed += 1;
        log.error(
          { err: error, accountId: account.id },
          'Failed to refresh Twitter token',
        );
      }
    }

    log.info({ refreshed, failed, candidates: expiring.length }, 'Token refresh sweep done');

    return { refreshed, failed };
  }
}
