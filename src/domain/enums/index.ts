/**
 * Domain enums — framework-agnostic vocabulary shared by entities and use-cases.
 * Values mirror Prisma enums 1:1 so mapping stays trivial.
 */

/** GPT sentiment classification */
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

/** Reply processing state machine */
export type ReplyStatus =
  | 'DISCOVERED'
  | 'CLASSIFYING'
  | 'CLASSIFIED'
  | 'ACTION_PENDING'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'FAILED';

/** How the bot acts after classification */
export type ModerationMode = 'AUTO' | 'NOTIFY_ONLY' | 'DRY_RUN';

/** Audit trail action types */
export type ActionType =
  | 'REPLY_POSTED'
  | 'REPLY_HIDDEN'
  | 'ANALYSIS_COMPLETED'
  | 'MONITORING_STARTED'
  | 'MONITORING_STOPPED'
  | 'TOKEN_REFRESHED'
  | 'ACCOUNT_CONNECTED'
  | 'ACCOUNT_DISCONNECTED'
  | 'TWEET_ADDED'
  | 'TWEET_REMOVED'
  | 'SETTINGS_UPDATED'
  | 'ERROR';

/** Valid ReplyStatus transitions (enforced in domain policies later) */
export const REPLY_STATUS_TRANSITIONS: Readonly<Record<ReplyStatus, readonly ReplyStatus[]>> = {
  DISCOVERED: ['CLASSIFYING', 'SKIPPED', 'FAILED'],
  CLASSIFYING: ['CLASSIFIED', 'FAILED'],
  CLASSIFIED: ['ACTION_PENDING', 'SKIPPED', 'COMPLETED', 'FAILED'],
  ACTION_PENDING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  SKIPPED: [],
  FAILED: ['CLASSIFYING', 'ACTION_PENDING'],
};
