/**
 * Telegram bot lifecycle: create, start long-polling, stop.
 */

import { Bot, session } from 'grammy';
import type { AppContainer } from '../../container.js';
import {
  createInitialSession,
  type BotContext,
  type BotSessionData,
} from './context.js';
import { createContainerMiddleware } from './middleware/container.middleware.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { createErrorMiddleware } from './middleware/error.middleware.js';
import { createThrottleMiddleware } from './middleware/throttle.middleware.js';
import { registerBotHandlers } from './handlers.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('TelegramBotService');

export class TelegramBotService {
  private readonly bot: Bot<BotContext>;

  constructor(container: AppContainer) {
    this.bot = new Bot<BotContext>(container.config.TELEGRAM_BOT_TOKEN);

    this.bot.use(createErrorMiddleware());
    this.bot.use(createThrottleMiddleware());
    this.bot.use(createContainerMiddleware(container));
    this.bot.use(
      session({
        initial: createInitialSession,
        getSessionKey: (ctx) => {
          const id = ctx.from?.id;
          return id === undefined ? undefined : `tg:${id}`;
        },
      }),
    );
    this.bot.use(createAuthMiddleware());

    registerBotHandlers(this.bot);

    // Wire OAuth success → Telegram DM
    container.useCases.accounts.completeOAuth.setNotifier(async (event) => {
      const verb = event.isReconnect ? 'переподключён' : 'подключён';
      await this.bot.api.sendMessage(
        event.telegramId.toString(),
        `✅ X аккаунт *@${event.twitterUsername}* ${verb}.`,
        { parse_mode: 'Markdown' },
      );
    });

    // Wire moderation results → Telegram DM
    container.useCases.replies.processReply.setNotifier(async (event) => {
      const actionLabels: Record<string, string> = {
        reply_posted: '💬 Ответ опубликован',
        reply_hidden: '🚫 Комментарий скрыт',
        hide_denied:  '⚠️ Не удалось скрыть',
        dry_run:      '🧪 Анализ (dry run)',
        no_action:    '⚪ Без действий',
      };

      const actionLabel = actionLabels[event.actionTaken] ?? `⚪ ${event.actionTaken}`;

      const text =
        `${actionLabel}\n\n` +
        `▸ *От:* @${event.twitterUsername}\n` +
        `▸ *Тон:* ${event.sentiment} (${(event.confidence * 100).toFixed(0)}%)\n\n` +
        `> ${event.replyText.slice(0, 100)}`;

      try {
        await this.bot.api.sendMessage(event.telegramId.toString(), text, {
          parse_mode: 'Markdown',
        });
      } catch (notifyError) {
        log.warn({ err: notifyError }, 'Failed to send moderation notification');
      }
    });
  }

  /** Start long polling */
  async start(): Promise<void> {
    log.info('Starting Telegram bot (long polling)');

    // Drop pending updates from previous runs to avoid replay storms
    await this.bot.api.deleteWebhook({ drop_pending_updates: true });

    void this.bot.start({
      onStart: (info) => {
        log.info({ username: info.username }, 'Telegram bot is running');
      },
    });
  }

  /** Stop polling gracefully */
  async stop(): Promise<void> {
    log.info('Stopping Telegram bot');
    await this.bot.stop();
  }

  /** Expose bot for advanced wiring/tests */
  get instance(): Bot<BotContext> {
    return this.bot;
  }
}

/** Type re-export for session consumers */
export type { BotSessionData };
