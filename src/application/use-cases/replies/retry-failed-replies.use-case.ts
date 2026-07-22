import type { ReplyRepository } from '../../../domain/repositories/reply.repository.js';
import type { ReplyEntity } from '../../../domain/entities/reply.entity.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('RetryFailedRepliesUseCase');

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 5 * 60 * 1000;
const BACKOFF_MAX_MS = 2 * 60 * 60 * 1000;

export interface RetryFailedRepliesResult {
  readonly retried: number;
  readonly skipped: number;
}

export class RetryFailedRepliesUseCase {
  constructor(private readonly replies: ReplyRepository) {}

  async execute(): Promise<RetryFailedRepliesResult> {
    const failed = await this.replies.findAllByStatuses(['FAILED']);
    const eligible = failed.filter((r) => r.attempts < MAX_RETRIES);

    let retried = 0;
    let skipped = 0;

    for (const reply of eligible) {
      if (this.isBackoffExpired(reply)) {
        await this.replies.update(reply.id, {
          status: 'DISCOVERED',
          failureReason: null,
        });
        retried += 1;
      } else {
        skipped += 1;
      }
    }

    log.info({ retried, skipped, total: failed.length }, 'Retry sweep done');
    return { retried, skipped };
  }

  private isBackoffExpired(reply: ReplyEntity): boolean {
    const elapsed = Date.now() - reply.updatedAt.getTime();
    const requiredDelay = Math.min(
      BACKOFF_BASE_MS * Math.pow(2, reply.attempts - 1),
      BACKOFF_MAX_MS,
    );
    return elapsed >= requiredDelay;
  }
}
