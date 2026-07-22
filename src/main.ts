/**
 * Combined process entrypoint (PROCESS_ROLE=all).
 */

import { getConfig } from './config/env.config.js';
import { bootstrapInfrastructure, registerProcessHandlers } from './bootstrap.js';
import { createLogger, logger } from './shared/logger.js';

const log = createLogger('Main');

async function main(): Promise<void> {
  const config = getConfig();

  if (config.PROCESS_ROLE === 'bot') {
    await import('./bot.js');
    return;
  }

  if (config.PROCESS_ROLE === 'worker') {
    await import('./worker.js');
    return;
  }

  const { container } = await bootstrapInfrastructure();
  await container.oauthHttpServer.start();
  await container.telegramBot.start();

  log.info(
    {
      role: 'all',
      httpPort: config.HTTP_PORT,
      callbackUrl: config.TWITTER_CALLBACK_URL,
    },
    'Combined process started (Telegram + OAuth; workers in Stage 5)',
  );

  registerProcessHandlers(async () => {
    await container.telegramBot.stop();
    await container.oauthHttpServer.stop();
    log.info('Combined process shutting down');
  });
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Application failed to start');
  process.exit(1);
});
