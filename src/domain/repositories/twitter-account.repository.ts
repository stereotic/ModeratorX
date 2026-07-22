/**
 * TwitterAccount repository interface.
 * Defines data access operations for X account management.
 */

import type {
  TwitterAccountEntity,
  CreateTwitterAccountData,
  UpdateTwitterAccountData,
} from '../entities/twitter-account.entity.js';

export interface TwitterAccountRepository {
  findById(id: string): Promise<TwitterAccountEntity | null>;

  /** Find all accounts belonging to a user */
  findByUserId(userId: string): Promise<TwitterAccountEntity[]>;

  /** Find any account by X user ID (cross-tenant uniqueness check) */
  findByTwitterUserId(twitterUserId: string): Promise<TwitterAccountEntity | null>;

  /** Find account by user ID + Twitter user ID pair */
  findByUserAndTwitterId(userId: string, twitterUserId: string): Promise<TwitterAccountEntity | null>;

  /** Find all accounts with expired or soon-to-expire tokens */
  findWithExpiringTokens(beforeDate: Date): Promise<TwitterAccountEntity[]>;

  /** Count accounts for a specific user */
  countByUserId(userId: string): Promise<number>;

  create(data: CreateTwitterAccountData): Promise<TwitterAccountEntity>;
  update(id: string, data: UpdateTwitterAccountData): Promise<TwitterAccountEntity>;
  delete(id: string): Promise<void>;
}
