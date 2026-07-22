/**
 * List X accounts linked to a user (safe DTO — no tokens).
 */

import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';

export interface AccountListItem {
  readonly id: string;
  readonly twitterUsername: string;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly tokenExpiresAt: Date;
  readonly createdAt: Date;
}

export class ListAccountsUseCase {
  constructor(private readonly accounts: TwitterAccountRepository) {}

  async execute(userId: string): Promise<AccountListItem[]> {
    const rows = await this.accounts.findByUserId(userId);

    return rows.map((account) => ({
      id: account.id,
      twitterUsername: account.twitterUsername,
      displayName: account.displayName,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
      createdAt: account.createdAt,
    }));
  }
}
