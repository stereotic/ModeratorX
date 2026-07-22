/**
 * Add a tweet for monitoring after ownership validation via X API.
 */

import type { EnvConfig } from '../../../config/env.config.js';
import type { TweetEntity } from '../../../domain/entities/tweet.entity.js';
import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { TwitterAccountAuthService } from '../../../infrastructure/twitter/twitter-account-auth.service.js';
import type { TwitterApiService } from '../../../infrastructure/twitter/twitter-api.service.js';
import { TweetUrl } from '../../../domain/value-objects/tweet-url.js';
import {
  ConflictError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('AddTweetUseCase');

export interface AddTweetInput {
  readonly userId: string;
  readonly accountId: string;
  readonly tweetUrlOrId: string;
}

export class AddTweetUseCase {
  constructor(
    private readonly config: EnvConfig,
    private readonly tweets: TweetRepository,
    private readonly accounts: TwitterAccountRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly accountAuth: TwitterAccountAuthService,
    private readonly twitterApi: TwitterApiService,
  ) {}

  async execute(input: AddTweetInput): Promise<TweetEntity> {
    const account = await this.accounts.findById(input.accountId);

    if (account?.userId !== input.userId || !account.isActive) {
      throw new NotFoundError('TwitterAccount', input.accountId);
    }

    const count = await this.tweets.countByAccountId(account.id);

    if (count >= this.config.MAX_MONITORED_TWEETS_PER_ACCOUNT) {
      throw new LimitExceededError(
        `Maximum of ${this.config.MAX_MONITORED_TWEETS_PER_ACCOUNT} tweets per account reached`,
      );
    }

    const parsed = TweetUrl.parse(input.tweetUrlOrId);

    const existing = await this.tweets.findByAccountAndTweetId(account.id, parsed.tweetId);

    if (existing) {
      throw new ConflictError('This tweet is already added for this account');
    }

    const { accessToken } = await this.accountAuth.getValidAccessToken(account.id);
    const remote = await this.twitterApi.getTweet(accessToken, parsed.tweetId);

    if (!remote.authorId || remote.authorId !== account.twitterUserId) {
      throw new ValidationError(
        'You can only monitor posts authored by the connected X account (Hide Reply requires ownership)',
        'tweetUrl',
      );
    }

    const tweet = await this.tweets.create({
      userId: input.userId,
      accountId: account.id,
      tweetId: parsed.tweetId,
      tweetUrl: parsed.rawUrl,
      tweetText: remote.text,
      authorId: remote.authorId,
    });

    await this.actionLogs.create({
      userId: input.userId,
      action: 'TWEET_ADDED',
      details: {
        tweetDbId: tweet.id,
        tweetId: tweet.tweetId,
        accountId: account.id,
      },
    });

    log.info({ userId: input.userId, tweetId: tweet.tweetId }, 'Tweet added');

    return tweet;
  }
}
