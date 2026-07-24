import type { OpenAiService } from '../../../infrastructure/openai/openai.service.js';
import type { ReplyRepository } from '../../../domain/repositories/reply.repository.js';
import type { GptResponseRepository } from '../../../domain/repositories/gpt-response.repository.js';
import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { UserSettingsRepository } from '../../../domain/repositories/user-settings.repository.js';
import type { ReplyEntity } from '../../../domain/entities/reply.entity.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('ClassifyReplyUseCase');

export interface ClassifyReplyInput {
  readonly replyId: string;
}

export interface ClassifyReplyResult {
  readonly reply: ReplyEntity;
  readonly action: 'reply' | 'hide' | 'skip';
  readonly generatedReply: string | null;
  readonly confidence: number;
}

export class ClassifyReplyUseCase {
  constructor(
    private readonly replies: ReplyRepository,
    private readonly gptResponses: GptResponseRepository,
    private readonly tweets: TweetRepository,
    private readonly settings: UserSettingsRepository,
    private readonly openai: OpenAiService,
  ) {}

  async execute(input: ClassifyReplyInput): Promise<ClassifyReplyResult> {
    const claimed = await this.replies.claimForProcessing(
      input.replyId,
      'DISCOVERED',
      'CLASSIFYING',
    );

    if (!claimed) {
      const existing = await this.replies.findById(input.replyId);

      if (!existing) {
        throw new Error(`Reply ${input.replyId} not found`);
      }

      if (
        existing.status === 'CLASSIFYING' ||
        existing.status === 'CLASSIFIED'
      ) {
        const gptRecord = await this.gptResponses.findByReplyId(existing.id);

        if (!existing.sentiment) {
          throw new Error(`Reply ${existing.id} has no sentiment set after classification`);
        }

        const action = this.determineAction(
          existing.sentiment,
          existing.confidence ?? 0.5,
        );

        return {
          reply: existing,
          action,
          generatedReply: gptRecord?.generatedReply ?? null,
          confidence: existing.confidence ?? 0.5,
        };
      }

      throw new Error(
        `Reply ${input.replyId} is in status ${existing.status}, cannot classify`,
      );
    }

    const tweet = await this.tweets.findById(claimed.tweetId);
    const settings = tweet
      ? await this.settings.getOrCreate(tweet.userId)
      : null;

    try {
      const result = await this.openai.classify({
        replyText: claimed.text,
        tweetText: tweet?.tweetText ?? null,
        customPrompt: settings?.gptPrompt ?? null,
        imageUrls: claimed.mediaUrls.length > 0 ? claimed.mediaUrls : undefined,
      });

      await this.gptResponses.upsertByReplyId({
        replyId: claimed.id,
        sentiment: result.sentiment,
        confidence: result.confidence,
        generatedReply: result.generatedReply ?? undefined,
        promptUsed: result.promptUsed,
        model: result.model,
        tokensUsed: result.tokensUsed,
      });

      const updated = await this.replies.update(claimed.id, {
        status: 'CLASSIFIED',
        sentiment: result.sentiment,
        confidence: result.confidence,
      });

      const action = this.determineAction(
        result.sentiment,
        result.confidence,
        settings?.confidenceThreshold ?? undefined,
      );

      log.info(
        {
          replyId: claimed.id,
          sentiment: result.sentiment,
          confidence: result.confidence,
          action,
        },
        'Reply classified',
      );

      return {
        reply: updated,
        action,
        generatedReply: result.generatedReply,
        confidence: result.confidence,
      };
    } catch (error) {
      await this.replies.update(claimed.id, {
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Classification failed',
      });

      throw error;
    }
  }

  private determineAction(
    sentiment: string,
    confidence: number,
    threshold = 0.75,
  ): 'reply' | 'hide' | 'skip' {
    if (confidence < threshold) {
      return 'skip';
    }

    if (sentiment === 'POSITIVE') {
      return 'reply';
    }

    if (sentiment === 'NEGATIVE') {
      return 'hide';
    }

    return 'skip';
  }
}
