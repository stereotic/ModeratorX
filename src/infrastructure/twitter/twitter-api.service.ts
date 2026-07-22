/**
 * Twitter API v2 client for user-context operations.
 *
 * All methods accept a plaintext access token (already decrypted / refreshed
 * by TwitterAccountAuthService). Errors are mapped to AppError subclasses.
 */

import { TwitterApi } from 'twitter-api-v2';
import type { PaginatedReplies, TwitterReplyData, TwitterUserProfile } from '../../shared/types.js';
import { createLogger } from '../../shared/logger.js';
import { mapTwitterError } from './twitter-error.mapper.js';
import type { RateLimiter } from '../rate-limiter/rate-limiter.js';

const log = createLogger('TwitterApiService');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const RATE_LIMITS: Record<string, { maxRequests: number }> = {
  getMe: { maxRequests: 75 },
  getTweet: { maxRequests: 300 },
  fetchConversationReplies: { maxRequests: 180 },
  postReply: { maxRequests: 200 },
  hideReply: { maxRequests: 50 },
};

/** Single tweet lookup result */
export interface TweetLookupResult {
  readonly id: string;
  readonly text: string;
  readonly authorId: string;
  readonly conversationId: string | null;
}

export class TwitterApiService {
  constructor(private readonly rateLimiter?: RateLimiter) {}

  private async checkRateLimit(method: string): Promise<void> {
    if (!this.rateLimiter) return;

    const config = RATE_LIMITS[method];
    if (!config) return;

    await this.rateLimiter.enforce(
      `twitter:${method}`,
      config.maxRequests,
      RATE_LIMIT_WINDOW_MS,
      'X API',
    );
  }

  /** Build a user-authenticated client from a plaintext access token */
  createUserClient(accessToken: string): TwitterApi {
    return new TwitterApi(accessToken);
  }

  /** Fetch the authenticated user's profile */
  async getMe(accessToken: string): Promise<TwitterUserProfile> {
    await this.checkRateLimit('getMe');

    try {
      const client = this.createUserClient(accessToken);
      const me = await client.v2.me({
        'user.fields': ['name', 'username'],
      });

      return {
        id: me.data.id,
        username: me.data.username,
        name: me.data.name,
      };
    } catch (error) {
      throw mapTwitterError(error, 'getMe');
    }
  }

  /** Fetch a tweet by ID (used for ownership validation) */
  async getTweet(accessToken: string, tweetId: string): Promise<TweetLookupResult> {
    await this.checkRateLimit('getTweet');

    try {
      const client = this.createUserClient(accessToken);
      const result = await client.v2.singleTweet(tweetId, {
        'tweet.fields': ['author_id', 'conversation_id', 'text'],
      });

      const tweet = result.data;

      return {
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id ?? '',
        conversationId: tweet.conversation_id ?? null,
      };
    } catch (error) {
      throw mapTwitterError(error, 'getTweet');
    }
  }

  /**
   * Fetch recent replies in a conversation newer than `sinceId`.
   * Uses Search Recent with conversation_id operator (≈7-day window).
   */
  async fetchConversationReplies(params: {
    readonly accessToken: string;
    readonly conversationId: string;
    readonly sinceId?: string | null;
    readonly maxResults?: number;
  }): Promise<PaginatedReplies> {
    await this.checkRateLimit('fetchConversationReplies');

    try {
      const client = this.createUserClient(params.accessToken);
      const query = `conversation_id:${params.conversationId} is:reply -is:retweet`;

      const paginator = await client.v2.search(query, {
        max_results: params.maxResults ?? 50,
        ...(params.sinceId ? { since_id: params.sinceId } : {}),
        'tweet.fields': ['author_id', 'text', 'created_at', 'conversation_id'],
        expansions: ['author_id'],
        'user.fields': ['username'],
      });

      const usersById = new Map<string, string>();

      if (paginator.includes?.users) {
        for (const user of paginator.includes.users) {
          usersById.set(user.id, user.username);
        }
      }

      const replies: TwitterReplyData[] = [];
      let newestId: string | null = null;

      const tweetsData = paginator.data?.data;

      if (tweetsData) {
        for (const tweet of tweetsData) {
          if (!newestId || BigInt(tweet.id) > BigInt(newestId)) {
            newestId = tweet.id;
          }

          replies.push({
            replyTweetId: tweet.id,
            authorId: tweet.author_id ?? '',
            authorUsername: tweet.author_id
              ? (usersById.get(tweet.author_id) ?? null)
              : null,
            text: tweet.text,
          });
        }
      }

      log.debug(
        { conversationId: params.conversationId, count: replies.length },
        'Fetched conversation replies',
      );

      return { replies, newestId };
    } catch (error) {
      throw mapTwitterError(error, 'fetchConversationReplies');
    }
  }

  /** Publish a reply under a tweet */
  async postReply(params: {
    readonly accessToken: string;
    readonly inReplyToTweetId: string;
    readonly text: string;
  }): Promise<string> {
    await this.checkRateLimit('postReply');

    try {
      const client = this.createUserClient(params.accessToken);
      const result = await client.v2.reply(params.text, params.inReplyToTweetId);
      const postedId = result.data.id;

      log.info(
        { inReplyTo: params.inReplyToTweetId, postedId },
        'Reply posted on X',
      );

      return postedId;
    } catch (error) {
      throw mapTwitterError(error, 'postReply');
    }
  }

  /** Hide or unhide a reply (requires tweet.moderate.write + ownership) */
  async hideReply(params: {
    readonly accessToken: string;
    readonly replyTweetId: string;
    readonly hidden?: boolean;
  }): Promise<void> {
    await this.checkRateLimit('hideReply');

    try {
      const client = this.createUserClient(params.accessToken);
      await client.v2.hideReply(params.replyTweetId, params.hidden ?? true);

      log.info(
        { replyTweetId: params.replyTweetId, hidden: params.hidden ?? true },
        'Reply hide state updated on X',
      );
    } catch (error) {
      throw mapTwitterError(error, 'hideReply');
    }
  }
}
