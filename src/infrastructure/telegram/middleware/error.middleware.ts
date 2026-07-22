/**
 * Catches handler errors and replies with a safe user-facing message.
 */

import type { MiddlewareFn } from 'grammy';
import type { BotContext } from '../context.js';
import { formatError } from '../formatters.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('ErrorMiddleware');

export function createErrorMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      log.error({ err: error, updateId: ctx.update.update_id }, 'Handler error');

      try {
        await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
      } catch (replyError) {
        log.error({ err: replyError }, 'Failed to send error reply');
      }
    }
  };
}
