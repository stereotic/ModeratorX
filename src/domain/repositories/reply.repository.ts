/**
 * Reply repository interface.
 * Status-based queries support the processing state machine.
 */

import type { ReplyStatus } from '../enums/index.js';
import type { ReplyEntity, CreateReplyData, UpdateReplyData } from '../entities/reply.entity.js';

export interface ReplyRepository {
  findById(id: string): Promise<ReplyEntity | null>;
  findByReplyTweetId(replyTweetId: string): Promise<ReplyEntity | null>;
  findByTweetId(tweetId: string): Promise<ReplyEntity[]>;
  findByTweetIdAndStatuses(tweetId: string, statuses: readonly ReplyStatus[]): Promise<ReplyEntity[]>;
  findAllByStatuses(statuses: readonly ReplyStatus[]): Promise<ReplyEntity[]>;

  /**
   * Atomically claim a reply for processing (CAS on status).
   * Returns null if another worker already claimed it.
   */
  claimForProcessing(
    id: string,
    fromStatus: ReplyStatus,
    toStatus: ReplyStatus,
  ): Promise<ReplyEntity | null>;

  countBySentimentForUser(userId: string): Promise<{
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>;

  create(data: CreateReplyData): Promise<ReplyEntity>;
  /** Insert ignoring duplicates on replyTweetId (idempotent discovery) */
  createManyIgnoreDuplicates(data: CreateReplyData[]): Promise<number>;
  update(id: string, data: UpdateReplyData): Promise<ReplyEntity>;
}
