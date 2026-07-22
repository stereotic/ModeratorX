/**
 * ActionLog repository interface.
 */

import type { ActionType } from '../enums/index.js';
import type { ActionLogEntity, CreateActionLogData } from '../entities/action-log.entity.js';

export interface ActionLogRepository {
  findRecentByUserId(userId: string, limit?: number): Promise<ActionLogEntity[]>;
  countByActionForUser(userId: string): Promise<Partial<Record<ActionType, number>>>;
  create(data: CreateActionLogData): Promise<ActionLogEntity>;
}
