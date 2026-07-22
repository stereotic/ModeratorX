/**
 * Tweet repository interface.
 * Defines data access operations for monitored tweets.
 */

import type { TweetEntity, CreateTweetData, UpdateTweetData } from '../entities/tweet.entity.js';

export interface TweetRepository {
  findById(id: string): Promise<TweetEntity | null>;
  findByUserId(userId: string): Promise<TweetEntity[]>;
  findByAccountId(accountId: string): Promise<TweetEntity[]>;

  /** Find tweet by account + X tweet ID pair (unique constraint) */
  findByAccountAndTweetId(accountId: string, tweetId: string): Promise<TweetEntity | null>;

  /** Find all tweets currently being monitored */
  findActivelyMonitored(): Promise<TweetEntity[]>;

  /** Count monitored tweets for a specific account */
  countByAccountId(accountId: string): Promise<number>;

  create(data: CreateTweetData): Promise<TweetEntity>;
  update(id: string, data: UpdateTweetData): Promise<TweetEntity>;
  delete(id: string): Promise<void>;
}
