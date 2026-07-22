/**
 * Fetch recent action logs for Telegram display.
 */

import type { ActionLogRepository } from '../../../domain/repositories/action-log.repository.js';
import type { ActionLogEntity } from '../../../domain/entities/action-log.entity.js';

export class GetRecentActionsUseCase {
  constructor(private readonly actionLogs: ActionLogRepository) {}

  async execute(userId: string, limit = 15): Promise<ActionLogEntity[]> {
    return this.actionLogs.findRecentByUserId(userId, limit);
  }
}
