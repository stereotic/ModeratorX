/**
 * Shared cross-cutting types used by application and infrastructure layers.
 * Domain enums live in domain/enums — do not duplicate them here.
 */

import type { Sentiment } from '../domain/enums/index.js';

/** Result of GPT sentiment analysis + optional reply text */
export interface SentimentAnalysisResult {
  readonly sentiment: Sentiment;
  readonly confidence: number;
  readonly generatedReply: string | null;
}

/** Twitter reply payload fetched from X API */
export interface TwitterReplyData {
  readonly replyTweetId: string;
  readonly authorId: string;
  readonly authorUsername: string | null;
  readonly text: string;
  readonly mediaUrls: readonly string[];
}

/** OAuth token pair returned from X API */
export interface OAuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

/** Twitter user profile from X API */
export interface TwitterUserProfile {
  readonly id: string;
  readonly username: string;
  readonly name: string;
}

/** Pagination result for fetching replies */
export interface PaginatedReplies {
  readonly replies: readonly TwitterReplyData[];
  readonly newestId: string | null;
}

/** Statistics summary for Telegram dashboard */
export interface UserStatistics {
  readonly totalMonitoredTweets: number;
  readonly activeMonitoringJobs: number;
  readonly totalRepliesAnalyzed: number;
  readonly totalPositive: number;
  readonly totalNegative: number;
  readonly totalNeutral: number;
  readonly totalRepliesPosted: number;
  readonly totalRepliesHidden: number;
  readonly connectedAccounts: number;
}

/** Process role for multi-process deployment */
export type ProcessRole = 'bot' | 'worker' | 'all';
