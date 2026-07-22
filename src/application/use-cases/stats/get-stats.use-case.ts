/**
 * Aggregate user statistics for the Telegram dashboard.
 */

import type { TweetRepository } from '../../../domain/repositories/tweet.repository.js';
import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { ReplyRepository } from '../../../domain/repositories/reply.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { MonitoringJobRepository } from '../../../domain/repositories/monitoring-job.repository.js';
import type { UserStatistics } from '../../../shared/types.js';

export class GetStatsUseCase {
  constructor(
    private readonly tweets: TweetRepository,
    private readonly accounts: TwitterAccountRepository,
    private readonly replies: ReplyRepository,
    private readonly actionLogs: ActionLogRepository,
    private readonly monitoringJobs: MonitoringJobRepository,
  ) {}

  async execute(userId: string): Promise<UserStatistics> {
    const [userTweets, connectedAccounts, sentiment, actions, activeJobs] =
      await Promise.all([
        this.tweets.findByUserId(userId),
        this.accounts.countByUserId(userId),
        this.replies.countBySentimentForUser(userId),
        this.actionLogs.countByActionForUser(userId),
        this.monitoringJobs.findAllActive(),
      ]);

    const userTweetIds = new Set(userTweets.map((tweet) => tweet.id));
    const activeMonitoringJobs = activeJobs.filter((job) =>
      userTweetIds.has(job.tweetId),
    ).length;

    return {
      totalMonitoredTweets: userTweets.length,
      activeMonitoringJobs,
      totalRepliesAnalyzed: sentiment.total,
      totalPositive: sentiment.positive,
      totalNegative: sentiment.negative,
      totalNeutral: sentiment.neutral,
      totalRepliesPosted: actions.REPLY_POSTED ?? 0,
      totalRepliesHidden: actions.REPLY_HIDDEN ?? 0,
      connectedAccounts,
    };
  }
}
