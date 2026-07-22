/**
 * Disconnect (delete) a linked X account belonging to the user.
 */

import type { TwitterAccountRepository } from '../../../domain/repositories/twitter-account.repository.js';
import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import { NotFoundError } from '../../../shared/errors.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('DisconnectAccountUseCase');

export interface DisconnectAccountInput {
  readonly userId: string;
  readonly accountId: string;
}

export class DisconnectAccountUseCase {
  constructor(
    private readonly accounts: TwitterAccountRepository,
    private readonly actionLogs: ActionLogRepository,
  ) {}

  async execute(input: DisconnectAccountInput): Promise<void> {
    const account = await this.accounts.findById(input.accountId);

    if (account?.userId !== input.userId) {
      throw new NotFoundError('TwitterAccount', input.accountId);
    }

    await this.accounts.delete(account.id);

    await this.actionLogs.create({
      userId: input.userId,
      action: 'ACCOUNT_DISCONNECTED',
      details: {
        accountId: account.id,
        twitterUsername: account.twitterUsername,
      },
    });

    log.info(
      { userId: input.userId, accountId: account.id },
      'X account disconnected',
    );
  }
}
