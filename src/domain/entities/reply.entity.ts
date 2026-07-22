/**
 * Reply domain entity.
 *
 * replyTweetId is the global idempotency key.
 * status drives the processing pipeline (never rely on booleans alone).
 */

import type { ReplyStatus, Sentiment } from '../enums/index.js';

export interface ReplyEntity {
  readonly id: string;
  readonly tweetId: string;
  readonly replyTweetId: string;
  readonly authorId: string;
  readonly authorUsername: string | null;
  readonly text: string;
  readonly status: ReplyStatus;
  readonly sentiment: Sentiment | null;
  readonly confidence: number | null;
  readonly wasReplied: boolean;
  readonly wasHidden: boolean;
  readonly postedReplyId: string | null;
  readonly attempts: number;
  readonly failureReason: string | null;
  readonly processedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data required to persist a newly discovered reply */
export interface CreateReplyData {
  readonly tweetId: string;
  readonly replyTweetId: string;
  readonly authorId: string;
  readonly authorUsername?: string;
  readonly text: string;
}

/** Fields that can be updated during pipeline processing */
export interface UpdateReplyData {
  readonly status?: ReplyStatus;
  readonly sentiment?: Sentiment;
  readonly confidence?: number;
  readonly wasReplied?: boolean;
  readonly wasHidden?: boolean;
  readonly postedReplyId?: string;
  readonly attempts?: number;
  readonly failureReason?: string | null;
  readonly processedAt?: Date | null;
}
