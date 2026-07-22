/**
 * Tweet domain entity.
 * Represents a post owned by a linked X account and optionally monitored.
 */

export interface TweetEntity {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly tweetId: string;
  readonly tweetUrl: string;
  readonly tweetText: string | null;
  readonly authorId: string | null;
  readonly isMonitoring: boolean;
  readonly lastCheckedAt: Date | null;
  readonly sinceId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data required to register a tweet for (possible) monitoring */
export interface CreateTweetData {
  readonly userId: string;
  readonly accountId: string;
  readonly tweetId: string;
  readonly tweetUrl: string;
  readonly tweetText?: string;
  readonly authorId?: string;
}

/** Fields that can be updated on a tweet */
export interface UpdateTweetData {
  readonly isMonitoring?: boolean;
  readonly lastCheckedAt?: Date;
  readonly sinceId?: string | null;
  readonly tweetText?: string;
  readonly authorId?: string;
}
