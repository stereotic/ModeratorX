/**
 * Dependency Injection container — composition root.
 */

import type Redis from 'ioredis';
import type { PrismaClient } from './generated/prisma/client.js';
import type { EnvConfig } from './config/env.config.js';
import { getConfig } from './config/env.config.js';
import { createPrismaClient } from './infrastructure/database/prisma.service.js';
import { createRedisClient } from './infrastructure/redis/redis.service.js';
import { CryptoService } from './shared/crypto.service.js';
import { createLogger } from './shared/logger.js';

import type { UserRepository } from './domain/repositories/user.repository.js';
import type { UserSettingsRepository } from './domain/repositories/user-settings.repository.js';
import type { TwitterAccountRepository } from './domain/repositories/twitter-account.repository.js';
import type { TweetRepository } from './domain/repositories/tweet.repository.js';
import type { ReplyRepository } from './domain/repositories/reply.repository.js';
import type { GptResponseRepository } from './domain/repositories/gpt-response.repository.js';
import type { ActionLogRepository } from './domain/repositories/action-log.repository.js';
import type { MonitoringJobRepository } from './domain/repositories/monitoring-job.repository.js';

import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository.js';
import { PrismaUserSettingsRepository } from './infrastructure/database/repositories/prisma-user-settings.repository.js';
import { PrismaTwitterAccountRepository } from './infrastructure/database/repositories/prisma-twitter-account.repository.js';
import { PrismaTweetRepository } from './infrastructure/database/repositories/prisma-tweet.repository.js';
import { PrismaReplyRepository } from './infrastructure/database/repositories/prisma-reply.repository.js';
import { PrismaGptResponseRepository } from './infrastructure/database/repositories/prisma-gpt-response.repository.js';
import { PrismaActionLogRepository } from './infrastructure/database/repositories/prisma-action-log.repository.js';
import { PrismaMonitoringJobRepository } from './infrastructure/database/repositories/prisma-monitoring-job.repository.js';

import { OAuthStateStore } from './infrastructure/twitter/oauth-state.store.js';
import { TwitterOAuthService } from './infrastructure/twitter/twitter-oauth.service.js';
import { TwitterApiService } from './infrastructure/twitter/twitter-api.service.js';
import { TwitterAccountAuthService } from './infrastructure/twitter/twitter-account-auth.service.js';
import { OpenAiService } from './infrastructure/openai/openai.service.js';
import { RateLimiter } from './infrastructure/rate-limiter/rate-limiter.js';
import { BullQueueService, BullWorkerService, HousekeepingQueue } from './infrastructure/bull/index.js';
import { OAuthHttpServer } from './infrastructure/http/oauth-http.server.js';
import { TelegramBotService } from './infrastructure/telegram/telegram-bot.service.js';

import { StartOAuthUseCase } from './application/use-cases/accounts/start-oauth.use-case.js';
import { CompleteOAuthUseCase } from './application/use-cases/accounts/complete-oauth.use-case.js';
import { DisconnectAccountUseCase } from './application/use-cases/accounts/disconnect-account.use-case.js';
import { ListAccountsUseCase } from './application/use-cases/accounts/list-accounts.use-case.js';
import { RefreshExpiringTokensUseCase } from './application/use-cases/accounts/refresh-expiring-tokens.use-case.js';
import { EnsureUserUseCase } from './application/use-cases/users/ensure-user.use-case.js';
import { AddTweetUseCase } from './application/use-cases/tweets/add-tweet.use-case.js';
import { RemoveTweetUseCase } from './application/use-cases/tweets/remove-tweet.use-case.js';
import { ListTweetsUseCase } from './application/use-cases/tweets/list-tweets.use-case.js';
import { StartMonitoringUseCase } from './application/use-cases/tweets/start-monitoring.use-case.js';
import { StopMonitoringUseCase } from './application/use-cases/tweets/stop-monitoring.use-case.js';
import {
  GetSettingsUseCase,
  UpdateSettingsUseCase,
} from './application/use-cases/settings/settings.use-case.js';
import { GetStatsUseCase } from './application/use-cases/stats/get-stats.use-case.js';
import { GetRecentActionsUseCase } from './application/use-cases/stats/get-recent-actions.use-case.js';
import { DiscoverRepliesUseCase } from './application/use-cases/replies/discover-replies.use-case.js';
import { ClassifyReplyUseCase } from './application/use-cases/replies/classify-reply.use-case.js';
import { ProcessReplyUseCase } from './application/use-cases/replies/process-reply.use-case.js';
import { RetryFailedRepliesUseCase } from './application/use-cases/replies/retry-failed-replies.use-case.js';
import { ReconcileJobsUseCase } from './application/use-cases/monitoring/reconcile-jobs.use-case.js';

const log = createLogger('Container');

export interface Repositories {
  readonly user: UserRepository;
  readonly userSettings: UserSettingsRepository;
  readonly twitterAccount: TwitterAccountRepository;
  readonly tweet: TweetRepository;
  readonly reply: ReplyRepository;
  readonly gptResponse: GptResponseRepository;
  readonly actionLog: ActionLogRepository;
  readonly monitoringJob: MonitoringJobRepository;
}

export interface TwitterServices {
  readonly oauth: TwitterOAuthService;
  readonly api: TwitterApiService;
  readonly accountAuth: TwitterAccountAuthService;
  readonly oauthStateStore: OAuthStateStore;
}

export interface AccountUseCases {
  readonly startOAuth: StartOAuthUseCase;
  readonly completeOAuth: CompleteOAuthUseCase;
  readonly disconnectAccount: DisconnectAccountUseCase;
  readonly listAccounts: ListAccountsUseCase;
  readonly refreshExpiringTokens: RefreshExpiringTokensUseCase;
}

export interface TweetUseCases {
  readonly addTweet: AddTweetUseCase;
  readonly removeTweet: RemoveTweetUseCase;
  readonly listTweets: ListTweetsUseCase;
  readonly startMonitoring: StartMonitoringUseCase;
  readonly stopMonitoring: StopMonitoringUseCase;
}

export interface SettingsUseCases {
  readonly getSettings: GetSettingsUseCase;
  readonly updateSettings: UpdateSettingsUseCase;
}

export interface ReplyUseCases {
  readonly discoverReplies: DiscoverRepliesUseCase;
  readonly classifyReply: ClassifyReplyUseCase;
  readonly processReply: ProcessReplyUseCase;
  readonly retryFailed: RetryFailedRepliesUseCase;
}

export interface StatsUseCases {
  readonly getStats: GetStatsUseCase;
  readonly getRecentActions: GetRecentActionsUseCase;
}

export interface MonitoringUseCases {
  readonly reconcileJobs: ReconcileJobsUseCase;
}

export interface AiServices {
  readonly openai: OpenAiService;
}

export interface BullServices {
  readonly queue: BullQueueService;
  readonly worker: BullWorkerService;
  readonly housekeeping: HousekeepingQueue;
}

export interface AppContainer {
  readonly config: EnvConfig;
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly crypto: CryptoService;
  readonly repositories: Repositories;
  readonly twitter: TwitterServices;
  readonly ai: AiServices;
  readonly useCases: {
    readonly users: { readonly ensureUser: EnsureUserUseCase };
    readonly accounts: AccountUseCases;
    readonly tweets: TweetUseCases;
    readonly replies: ReplyUseCases;
    readonly monitoring: MonitoringUseCases;
    readonly settings: SettingsUseCases;
    readonly stats: StatsUseCases;
  };
  readonly bull: BullServices;
  readonly oauthHttpServer: OAuthHttpServer;
  readonly telegramBot: TelegramBotService;
}

export function createContainer(config: EnvConfig = getConfig()): AppContainer {
  log.info('Assembling DI container');

  const prisma = createPrismaClient(config);
  const redis = createRedisClient(config);
  const crypto = new CryptoService(config.ENCRYPTION_KEY);

  const repositories: Repositories = {
    user: new PrismaUserRepository(prisma),
    userSettings: new PrismaUserSettingsRepository(prisma),
    twitterAccount: new PrismaTwitterAccountRepository(prisma),
    tweet: new PrismaTweetRepository(prisma),
    reply: new PrismaReplyRepository(prisma),
    gptResponse: new PrismaGptResponseRepository(prisma),
    actionLog: new PrismaActionLogRepository(prisma),
    monitoringJob: new PrismaMonitoringJobRepository(prisma),
  };

  const twitterRateLimiter = new RateLimiter(redis, 'tw');
  const openaiRateLimiter = new RateLimiter(redis, 'oai');

  const openai = new OpenAiService(config, openaiRateLimiter);

  const oauth = new TwitterOAuthService(config);
  const api = new TwitterApiService(twitterRateLimiter);
  const oauthStateStore = new OAuthStateStore(redis, config.OAUTH_STATE_TTL_SECONDS);
  const accountAuth = new TwitterAccountAuthService(
    config,
    crypto,
    oauth,
    repositories.twitterAccount,
    repositories.actionLog,
  );

  const twitter: TwitterServices = {
    oauth,
    api,
    accountAuth,
    oauthStateStore,
  };

  const ai: AiServices = {
    openai,
  };

  const bullQueue = new BullQueueService(redis);

  const processReply = new ProcessReplyUseCase(
    new ClassifyReplyUseCase(
      repositories.reply, repositories.gptResponse, repositories.tweet, repositories.userSettings, openai,
    ),
    repositories.reply, repositories.actionLog, repositories.user,
    repositories.tweet, repositories.userSettings, accountAuth, api,
  );

  const retryFailed = new RetryFailedRepliesUseCase(repositories.reply);

  const bullWorker = new BullWorkerService(
    redis,
    new DiscoverRepliesUseCase(repositories.tweet, repositories.reply, accountAuth, api),
    processReply,
    retryFailed,
    new RefreshExpiringTokensUseCase(config, repositories.twitterAccount, accountAuth),
    repositories.reply,
  );

  const housekeeping = new HousekeepingQueue(redis);

  const bull: BullServices = { queue: bullQueue, worker: bullWorker, housekeeping };

  const completeOAuth = new CompleteOAuthUseCase(
    config,
    repositories.twitterAccount,
    repositories.actionLog,
    oauth,
    oauthStateStore,
    crypto,
  );

  const classifyReply = new ClassifyReplyUseCase(
    repositories.reply,
    repositories.gptResponse,
    repositories.tweet,
    repositories.userSettings,
    openai,
  );

  const useCases = {
    users: {
      ensureUser: new EnsureUserUseCase(repositories.user, repositories.userSettings),
    },
    accounts: {
      startOAuth: new StartOAuthUseCase(
        config,
        repositories.user,
        repositories.userSettings,
        repositories.twitterAccount,
        oauth,
        oauthStateStore,
      ),
      completeOAuth,
      disconnectAccount: new DisconnectAccountUseCase(
        repositories.twitterAccount,
        repositories.actionLog,
      ),
      listAccounts: new ListAccountsUseCase(repositories.twitterAccount),
      refreshExpiringTokens: new RefreshExpiringTokensUseCase(
        config,
        repositories.twitterAccount,
        accountAuth,
      ),
    } satisfies AccountUseCases,
    tweets: {
      addTweet: new AddTweetUseCase(
        config,
        repositories.tweet,
        repositories.twitterAccount,
        repositories.actionLog,
        accountAuth,
        api,
      ),
      removeTweet: new RemoveTweetUseCase(
        repositories.tweet,
        repositories.monitoringJob,
        repositories.actionLog,
        bullQueue,
      ),
      listTweets: new ListTweetsUseCase(repositories.tweet, repositories.twitterAccount),
      startMonitoring: new StartMonitoringUseCase(
        repositories.tweet,
        repositories.monitoringJob,
        repositories.userSettings,
        repositories.actionLog,
        bullQueue,
      ),
      stopMonitoring: new StopMonitoringUseCase(
        repositories.tweet,
        repositories.monitoringJob,
        repositories.actionLog,
        bullQueue,
      ),
    } satisfies TweetUseCases,
    settings: {
      getSettings: new GetSettingsUseCase(repositories.userSettings),
      updateSettings: new UpdateSettingsUseCase(
        config,
        repositories.userSettings,
        repositories.actionLog,
      ),
    } satisfies SettingsUseCases,
    replies: {
      discoverReplies: new DiscoverRepliesUseCase(
        repositories.tweet,
        repositories.reply,
        accountAuth,
        api,
      ),
      classifyReply,
      processReply,
      retryFailed,
    } satisfies ReplyUseCases,
    monitoring: {
      reconcileJobs: new ReconcileJobsUseCase(repositories.monitoringJob, bullQueue),
    } satisfies MonitoringUseCases,
    stats: {
      getStats: new GetStatsUseCase(
        repositories.tweet,
        repositories.twitterAccount,
        repositories.reply,
        repositories.actionLog,
        repositories.monitoringJob,
      ),
      getRecentActions: new GetRecentActionsUseCase(repositories.actionLog),
    } satisfies StatsUseCases,
  };

  const oauthHttpServer = new OAuthHttpServer(config, completeOAuth);

  // Build container ref without telegramBot first (circular reference)
  const containerRef: AppContainer = {
    config,
    prisma,
    redis,
    crypto,
    repositories,
    twitter,
    ai,
    bull,
    useCases,
    oauthHttpServer,
    telegramBot: undefined as unknown as TelegramBotService,
  };

  Object.assign(containerRef, { telegramBot: new TelegramBotService(containerRef) });

  log.info('DI container assembled');

  return containerRef;
}
