import type { MiddlewareFn } from 'grammy';
import type { BotContext } from '../context.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('ThrottleMiddleware');

const THROTTLE_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

const userRequestCounts = new Map<number, { count: number; resetAt: number }>();

export function createThrottleMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const fromId = ctx.from?.id;

    if (fromId === undefined) {
      await next();
      return;
    }

    const now = Date.now();
    const record = userRequestCounts.get(fromId);

    if (record && now < record.resetAt) {
      record.count += 1;

      if (record.count > MAX_REQUESTS_PER_WINDOW) {
        log.warn({ userId: fromId }, 'User throttled');

        try {
          await ctx.answerCallbackQuery({
            text: 'Пожалуйста, подожди секунду перед следующим действием.',
          });
        } catch {
          // callback query may not exist
        }

        return;
      }
    } else {
      userRequestCounts.set(fromId, { count: 1, resetAt: now + THROTTLE_WINDOW_MS });
    }

    await next();
  };
}

export function resetThrottle(): void {
  userRequestCounts.clear();
}
