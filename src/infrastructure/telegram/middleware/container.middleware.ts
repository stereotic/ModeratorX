/**
 * Injects AppContainer into every update context.
 */

import type { MiddlewareFn } from 'grammy';
import type { AppContainer } from '../../../container.js';
import type { BotContext } from '../context.js';

export function createContainerMiddleware(
  container: AppContainer,
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    Object.assign(ctx, { container });
    await next();
  };
}
