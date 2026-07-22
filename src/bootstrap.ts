/**
 * Shared process bootstrap helpers.
 * Used by bot, worker, and combined "all" entrypoints.
 */

import { getConfig, type EnvConfig } from './config/env.config.js';
import { createContainer, type AppContainer } from './container.js';
import {
  connectDatabase,
  disconnectDatabase,
} from './infrastructure/database/prisma.service.js';
import {
  connectRedis,
  disconnectRedis,
} from './infrastructure/redis/redis.service.js';
import { createLogger, logger } from './shared/logger.js';

const log = createLogger('Bootstrap');

export interface BootstrappedApp {
  readonly config: EnvConfig;
  readonly container: AppContainer;
}

/**
 * Load config, connect DB + Redis, build DI container.
 */
export async function bootstrapInfrastructure(): Promise<BootstrappedApp> {
  const config = getConfig();
  log.info({ env: config.NODE_ENV }, 'Bootstrapping infrastructure');

  const container = createContainer(config);
  await connectDatabase(container.prisma);
  await connectRedis(container.redis);

  return { config, container };
}

/**
 * Register SIGINT/SIGTERM and fatal-error handlers.
 *
 * @param onShutdown - Async cleanup callback (bot stop, workers close, etc.)
 */
export function registerProcessHandlers(
  onShutdown: () => void | Promise<void>,
): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    log.info({ signal }, 'Shutdown signal received');

    try {
      await onShutdown();
      await disconnectRedis();
      await disconnectDatabase();
      log.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });
}
