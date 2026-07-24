import type { TwitterAccountAuthService } from '../../../infrastructure/twitter/twitter-account-auth.service.js';
import type { TwitterApiService } from '../../../infrastructure/twitter/twitter-api.service.js';
import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { ReplyRepository } from '../../../domain/repositories/reply.repository.js';
import type { TweetEntity } from '../../../domain/entities/tweet.entity.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('DiscoverRepliesUseCase');

export interface DiscoverRepliesInput {
  readonly tweetId: string;
}

export interface DiscoverRepliesResult {
  readonly discovered: number;
  readonly tweet: TweetEntity;
  readonly newestId: string | null;
}

export class DiscoverRepliesUseCase {
  constructor(
    private readonly tweets: TweetRepository,
    private readonly replies: ReplyRepository,
    private readonly accountAuth: TwitterAccountAuthService,
    private readonly twitterApi: TwitterApiService,
  ) {}

  async execute(input: DiscoverRepliesInput): Promise<DiscoverRepliesResult> {
    const tweet = await this.tweets.findById(input.tweetId);

    if (tweet?.isMonitoring !== true) {
      throw new Error(`Tweet ${input.tweetId} not found or monitoring is not active`);
    }

    const { accessToken } = await this.accountAuth.getValidAccessToken(tweet.accountId);

    const paginated = await this.twitterApi.fetchConversationReplies({
      accessToken,
      conversationId: tweet.tweetId,
      sinceId: tweet.sinceId,
    });

    let discovered = 0;

    const botRepliedIds = new Set<string>();

    if (paginated.replies.length > 0) {
      const existingReplies = await this.replies.findByTweetId(tweet.id);
      for (const r of existingReplies) {
        if (r.postedReplyId) {
          botRepliedIds.add(r.postedReplyId);
        }
      }
    }

    const filteredReplies = paginated.replies.filter(
      (reply) => !botRepliedIds.has(reply.replyTweetId),
    );

    if (filteredReplies.length > 0) {
      const replyData = filteredReplies.map((reply) => ({
        tweetId: tweet.id,
        replyTweetId: reply.replyTweetId,
        authorId: reply.authorId,
        authorUsername: reply.authorUsername ?? undefined,
        text: reply.text,
        mediaUrls: reply.mediaUrls.length > 0 ? [...reply.mediaUrls] : undefined,
      }));

      discovered = await this.replies.createManyIgnoreDuplicates(replyData);

      if (paginated.newestId) {
        await this.tweets.update(tweet.id, {
          sinceId: paginated.newestId,
          lastCheckedAt: new Date(),
        });
      }

      log.info(
        { tweetId: tweet.tweetId, discovered },
        'New replies discovered',
      );
    } else {
      await this.tweets.update(tweet.id, {
        lastCheckedAt: new Date(),
      });
    }

    return {
      discovered,
      tweet: { ...tweet, sinceId: paginated.newestId ?? tweet.sinceId },
      newestId: paginated.newestId,
    };
  }
}
