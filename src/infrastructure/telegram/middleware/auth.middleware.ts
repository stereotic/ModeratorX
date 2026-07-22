/**
 * Ensures the Telegram user exists in DB and attaches ctx.dbUser.
 */

import type { MiddlewareFn } from 'grammy';
import type { BotContext } from '../context.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('AuthMiddleware');

export function createAuthMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const from = ctx.from;

    if (!from) {
      return;
    }

    const result = await ctx.container.useCases.users.ensureUser.execute({
      telegramId: BigInt(from.id),
      telegramUsername: from.username,
      firstName: from.first_name,
    });

    Object.assign(ctx, { dbUser: result.user });
    log.debug({ userId: result.user.id, telegramId: from.id }, 'User authenticated');

    await next();
  };
}
