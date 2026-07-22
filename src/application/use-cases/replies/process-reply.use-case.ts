import type { ReplyRepository } from '../../../domain/repositories/reply.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { TwitterAccountAuthService } from '../../../infrastructure/twitter/twitter-account-auth.service.js';
import type { TwitterApiService } from '../../../infrastructure/twitter/twitter-api.service.js';
import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type { ReplyEntity } from '../../../domain/entities/reply.entity.js';
import { createLogger } from '../../../shared/logger.js';
import { ClassifyReplyUseCase } from './classify-reply.use-case.js';

const log = createLogger('ProcessReplyUseCase');

export interface ProcessReplyInput {
  readonly replyId: string;
}

export interface ProcessReplyResult {
  readonly reply: ReplyEntity;
  readonly actionTaken: string;
}

export type ModerationNotifier = (event: {
  readonly telegramId: bigint;
  readonly twitterUsername: string;
  readonly actionTaken: string;
  readonly replyText: string;
  readonly sentiment: string;
  readonly confidence: number;
}) => Promise<void>;

export class ProcessReplyUseCase {
  private notifier: ModerationNotifier | null = null;

  constructor(
    private readonly classifyReply: ClassifyReplyUseCase,
    private readonly replies: ReplyRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly users: UserRepository,
    private readonly tweets: TweetRepository,
    private readonly settings: UserSettingsRepository,
    private readonly accountAuth: TwitterAccountAuthService,
    private readonly twitterApi: TwitterApiService,
  ) {}

  setNotifier(notifier: ModerationNotifier): void {
    this.notifier = notifier;
  }

  async execute(input: ProcessReplyInput): Promise<ProcessReplyResult> {
    const classification = await this.classifyReply.execute({
      replyId: input.replyId,
    });

    const reply = classification.reply;
    const tweet = await this.tweets.findById(reply.tweetId);

    if (!tweet) {
      throw new Error(`Tweet ${reply.tweetId} not found for reply ${reply.id}`);
    }

    const settings = await this.settings.getOrCreate(tweet.userId);

    if (settings.moderationMode === 'DRY_RUN') {
      const updated = await this.replies.update(reply.id, {
        status: 'COMPLETED',
        processedAt: new Date(),
      });

      await this.actionLogs.create({
        userId: tweet.userId,
        replyId: reply.id,
        action: 'ANALYSIS_COMPLETED',
        details: {
          sentiment: classification.reply.sentiment,
          confidence: classification.confidence,
          moderationMode: 'DRY_RUN',
        },
      });

      log.info({ replyId: reply.id }, 'Dry-run — no X action taken');

      await this.sendNotification(tweet.userId, 'dry_run', reply, classification.reply.sentiment, classification.confidence);
      return { reply: updated, actionTaken: 'dry_run' };
    }

    if (
      settings.moderationMode === 'NOTIFY_ONLY' ||
      classification.action === 'skip'
    ) {
      const updated = await this.replies.update(reply.id, {
        status: 'COMPLETED',
        processedAt: new Date(),
      });

      await this.actionLogs.create({
        userId: tweet.userId,
        replyId: reply.id,
        action: 'ANALYSIS_COMPLETED',
        details: {
          sentiment: classification.reply.sentiment,
          confidence: classification.confidence,
          action: classification.action,
          moderationMode: settings.moderationMode,
        },
      });

      const actionTaken =
        classification.action === 'skip'
          ? 'skipped'
          : 'notified';

      log.info({ replyId: reply.id, actionTaken }, 'Reply processed without X mutation');

      await this.sendNotification(tweet.userId, actionTaken, reply, classification.reply.sentiment, classification.confidence);
      return { reply: updated, actionTaken };
    }

    const { accessToken } = await this.accountAuth.getValidAccessToken(
      tweet.accountId,
    );

    if (classification.action === 'reply' && classification.generatedReply) {
      try {
        const postedId = await this.twitterApi.postReply({
          accessToken,
          inReplyToTweetId: reply.replyTweetId,
          text: classification.generatedReply,
        });

        const updated = await this.replies.update(reply.id, {
          status: 'COMPLETED',
          wasReplied: true,
          postedReplyId: postedId,
          processedAt: new Date(),
        });

        await this.actionLogs.create({
          userId: tweet.userId,
          replyId: reply.id,
          action: 'REPLY_POSTED',
          details: {
            postedReplyId: postedId,
            replyTweetId: reply.replyTweetId,
          },
        });

        log.info({ replyId: reply.id, postedId }, 'Reply posted on X');

        await this.sendNotification(tweet.userId, 'reply_posted', reply, classification.reply.sentiment, classification.confidence);
        return { reply: updated, actionTaken: 'reply_posted' };
      } catch (error) {
        await this.replies.update(reply.id, {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Failed to post reply',
        });

        throw error;
      }
    }

    if (classification.action === 'hide') {
      let wasHidden = false;

      try {
        await this.twitterApi.hideReply({
          accessToken,
          replyTweetId: reply.replyTweetId,
          hidden: true,
        });
        wasHidden = true;
      } catch (error) {
        log.warn(
          { replyId: reply.id, err: error },
          'Failed to hide reply on X — completing anyway',
        );
      }

      const updated = await this.replies.update(reply.id, {
        status: 'COMPLETED',
        wasHidden,
        processedAt: new Date(),
      });

      await this.actionLogs.create({
        userId: tweet.userId,
        replyId: reply.id,
        action: wasHidden ? 'REPLY_HIDDEN' : 'ANALYSIS_COMPLETED',
        details: {
          replyTweetId: reply.replyTweetId,
          ...(wasHidden ? {} : { note: 'hide action failed — X API permission denied' }),
        },
      });

      const actionTaken = wasHidden ? 'reply_hidden' : 'hide_denied';
      log.info({ replyId: reply.id, actionTaken }, wasHidden ? 'Reply hidden on X' : 'Hide action skipped (API denied)');

      await this.sendNotification(tweet.userId, actionTaken, reply, classification.reply.sentiment, classification.confidence);
      return { reply: updated, actionTaken };
    }

    const updated = await this.replies.update(reply.id, {
      status: 'COMPLETED',
      processedAt: new Date(),
    });

    await this.sendNotification(tweet.userId, 'no_action', reply, classification.reply.sentiment, classification.confidence);
    return { reply: updated, actionTaken: 'no_action' };
  }

  private async sendNotification(
    userId: string,
    actionTaken: string,
    reply: ReplyEntity,
    sentiment: string | null,
    confidence: number,
  ): Promise<void> {
    if (!this.notifier) {
      return;
    }

    try {
      const user = await this.users.findById(userId);

      if (!user) {
        return;
      }

      await this.notifier({
        telegramId: user.telegramId,
        twitterUsername: reply.authorUsername ?? 'unknown',
        actionTaken,
        replyText: reply.text.slice(0, 200),
        sentiment: sentiment ?? 'UNKNOWN',
        confidence,
      });
    } catch (error) {
      log.warn({ err: error, userId }, 'Moderation notification failed');
    }
  }
}
