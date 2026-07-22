/**
 * Telegram bot process entrypoint.
 *
 * Owns OAuth HTTP callback server + grammY long polling.
 */

import { bootstrapInfrastructure, registerProcessHandlers } from './bootstrap.js';
import { createLogger, logger } from './shared/logger.js';

const log = createLogger('BotProcess');

async function main(): Promise<void> {
  const { config, container } = await bootstrapInfrastructure();

  await container.oauthHttpServer.start();
  await container.telegramBot.start();

  log.info(
    {
      role: 'bot',
      httpPort: config.HTTP_PORT,
      callbackUrl: config.TWITTER_CALLBACK_URL,
    },
    'Bot process started (Telegram + OAuth HTTP)',
  );

  registerProcessHandlers(async () => {
    await container.telegramBot.stop();
    await container.oauthHttpServer.stop();
    log.info('Bot process shutting down');
  });
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Bot process failed to start');
  process.exit(1);
});
