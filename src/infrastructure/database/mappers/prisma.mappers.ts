/**
 * Prisma model → domain entity mappers.
 *
 * Keeps persistence types out of the domain layer.
 * All mapping is centralized here to avoid duplication across repositories.
 */

import type {
  User,
  UserSettings,
  TwitterAccount,
  Tweet,
  Reply,
  GptResponse,
  ActionLog,
  MonitoringJob,
  Prisma,
} from '../../../generated/prisma/client.js';
import type { UserEntity } from '../../../domain/entities/user.entity.js';
import type { UserSettingsEntity } from '../../../domain/entities/user-settings.entity.js';
import type { TwitterAccountEntity } from '../../../domain/entities/twitter-account.entity.js';
import type { TweetEntity } from '../../../domain/entities/tweet.entity.js';
import type { ReplyEntity } from '../../../domain/entities/reply.entity.js';
import type { GptResponseEntity } from '../../../domain/entities/gpt-response.entity.js';
import type { ActionLogEntity } from '../../../domain/entities/action-log.entity.js';
import type { MonitoringJobEntity } from '../../../domain/entities/monitoring-job.entity.js';

/** Map Prisma User → UserEntity */
export function mapUser(row: User): UserEntity {
  return {
    id: row.id,
    telegramId: row.telegramId,
    telegramUsername: row.telegramUsername,
    firstName: row.firstName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Map Prisma UserSettings → UserSettingsEntity */
export function mapUserSettings(row: UserSettings): UserSettingsEntity {
  return {
    id: row.id,
    userId: row.userId,
    gptPrompt: row.gptPrompt,
    checkIntervalSec: row.checkIntervalSec,
    moderationMode: row.moderationMode,
    confidenceThreshold: row.confidenceThreshold,
    dailyTokenBudget: row.dailyTokenBudget,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Map Prisma TwitterAccount → TwitterAccountEntity */
export function mapTwitterAccount(row: TwitterAccount): TwitterAccountEntity {
  return {
    id: row.id,
    userId: row.userId,
    twitterUserId: row.twitterUserId,
    twitterUsername: row.twitterUsername,
    displayName: row.displayName,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    tokenExpiresAt: row.tokenExpiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Map Prisma Tweet → TweetEntity */
export function mapTweet(row: Tweet): TweetEntity {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    tweetId: row.tweetId,
    tweetUrl: row.tweetUrl,
    tweetText: row.tweetText,
    authorId: row.authorId,
    isMonitoring: row.isMonitoring,
    lastCheckedAt: row.lastCheckedAt,
    sinceId: row.sinceId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Map Prisma Reply → ReplyEntity */
export function mapReply(row: Reply): ReplyEntity {
  return {
    id: row.id,
    tweetId: row.tweetId,
    replyTweetId: row.replyTweetId,
    authorId: row.authorId,
    authorUsername: row.authorUsername,
    text: row.text,
    mediaUrls: toMediaUrls(row.mediaUrls),
    status: row.status,
    sentiment: row.sentiment,
    confidence: row.confidence,
    wasReplied: row.wasReplied,
    wasHidden: row.wasHidden,
    postedReplyId: row.postedReplyId,
    attempts: row.attempts,
    failureReason: row.failureReason,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Map Prisma GptResponse → GptResponseEntity */
export function mapGptResponse(row: GptResponse): GptResponseEntity {
  return {
    id: row.id,
    replyId: row.replyId,
    sentiment: row.sentiment,
    confidence: row.confidence,
    generatedReply: row.generatedReply,
    promptUsed: row.promptUsed,
    model: row.model,
    tokensUsed: row.tokensUsed,
    createdAt: row.createdAt,
  };
}

/** Map Prisma ActionLog → ActionLogEntity */
export function mapActionLog(row: ActionLog): ActionLogEntity {
  return {
    id: row.id,
    userId: row.userId,
    replyId: row.replyId,
    action: row.action,
    details: toPlainRecord(row.details),
    isSuccess: row.isSuccess,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

/** Map Prisma MonitoringJob → MonitoringJobEntity */
export function mapMonitoringJob(row: MonitoringJob): MonitoringJobEntity {
  return {
    id: row.id,
    tweetId: row.tweetId,
    bullJobId: row.bullJobId,
    intervalSeconds: row.intervalSeconds,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Convert Prisma JsonValue to a plain record (or null).
 * Rejects arrays/primitives for ActionLog.details contract.
 */
function toPlainRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return null;
}

/**
 * Convert Prisma JsonValue (string array) → readonly string[].
 */
function toMediaUrls(value: Prisma.JsonValue | null): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
