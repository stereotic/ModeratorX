/**
 * List tweets for a user with account handle for display.
 */

import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { TweetEntity } from '../../../domain/entities/tweet.entity.js';

export interface TweetListItem {
  readonly tweet: TweetEntity;
  readonly accountUsername: string;
}

export class ListTweetsUseCase {
  constructor(
    private readonly tweets: TweetRepository,
    private readonly accounts: TwitterAccountRepository,
  ) {}

  async execute(userId: string): Promise<TweetListItem[]> {
    const tweets = await this.tweets.findByUserId(userId);
    const accounts = await this.accounts.findByUserId(userId);
    const usernameByAccountId = new Map(
      accounts.map((account) => [account.id, account.twitterUsername] as const),
    );

    return tweets.map((tweet) => ({
      tweet,
      accountUsername: usernameByAccountId.get(tweet.accountId) ?? 'unknown',
    }));
  }
}
