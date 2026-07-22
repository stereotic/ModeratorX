-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('DISCOVERED', 'CLASSIFYING', 'CLASSIFIED', 'ACTION_PENDING', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationMode" AS ENUM ('AUTO', 'NOTIFY_ONLY', 'DRY_RUN');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('REPLY_POSTED', 'REPLY_HIDDEN', 'ANALYSIS_COMPLETED', 'MONITORING_STARTED', 'MONITORING_STOPPED', 'TOKEN_REFRESHED', 'ACCOUNT_CONNECTED', 'ACCOUNT_DISCONNECTED', 'TWEET_ADDED', 'TWEET_REMOVED', 'SETTINGS_UPDATED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "telegramUsername" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gptPrompt" TEXT,
    "checkIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "moderationMode" "ModerationMode" NOT NULL DEFAULT 'AUTO',
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "dailyTokenBudget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twitterUserId" TEXT NOT NULL,
    "twitterUsername" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tweets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "tweetUrl" TEXT NOT NULL,
    "tweetText" TEXT,
    "authorId" TEXT,
    "isMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "sinceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tweets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replies" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "replyTweetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorUsername" TEXT,
    "text" TEXT NOT NULL,
    "status" "ReplyStatus" NOT NULL DEFAULT 'DISCOVERED',
    "sentiment" "Sentiment",
    "confidence" DOUBLE PRECISION,
    "wasReplied" BOOLEAN NOT NULL DEFAULT false,
    "wasHidden" BOOLEAN NOT NULL DEFAULT false,
    "postedReplyId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpt_responses" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "generatedReply" TEXT,
    "promptUsed" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpt_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "replyId" TEXT,
    "action" "ActionType" NOT NULL,
    "details" JSONB,
    "isSuccess" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_jobs" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "bullJobId" TEXT,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "twitter_accounts_userId_idx" ON "twitter_accounts"("userId");

-- CreateIndex
CREATE INDEX "twitter_accounts_tokenExpiresAt_idx" ON "twitter_accounts"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "twitter_accounts_userId_twitterUserId_key" ON "twitter_accounts"("userId", "twitterUserId");

-- CreateIndex
CREATE INDEX "tweets_userId_idx" ON "tweets"("userId");

-- CreateIndex
CREATE INDEX "tweets_isMonitoring_idx" ON "tweets"("isMonitoring");

-- CreateIndex
CREATE UNIQUE INDEX "tweets_accountId_tweetId_key" ON "tweets"("accountId", "tweetId");

-- CreateIndex
CREATE UNIQUE INDEX "replies_replyTweetId_key" ON "replies"("replyTweetId");

-- CreateIndex
CREATE INDEX "replies_tweetId_idx" ON "replies"("tweetId");

-- CreateIndex
CREATE INDEX "replies_status_idx" ON "replies"("status");

-- CreateIndex
CREATE INDEX "replies_tweetId_status_idx" ON "replies"("tweetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gpt_responses_replyId_key" ON "gpt_responses"("replyId");

-- CreateIndex
CREATE INDEX "action_logs_userId_createdAt_idx" ON "action_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "action_logs_action_idx" ON "action_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_jobs_tweetId_key" ON "monitoring_jobs"("tweetId");

-- CreateIndex
CREATE INDEX "monitoring_jobs_isActive_idx" ON "monitoring_jobs"("isActive");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_accounts" ADD CONSTRAINT "twitter_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "twitter_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpt_responses" ADD CONSTRAINT "gpt_responses_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_jobs" ADD CONSTRAINT "monitoring_jobs_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
