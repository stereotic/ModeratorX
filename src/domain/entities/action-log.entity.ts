/**
 * ActionLog domain entity.
 * Append-only audit trail for user-facing and system events.
 */

import type { ActionType } from '../enums/index.js';

export interface ActionLogEntity {
  readonly id: string;
  readonly userId: string;
  readonly replyId: string | null;
  readonly action: ActionType;
  readonly details: Record<string, unknown> | null;
  readonly isSuccess: boolean;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
}

/** Data required to append an action log entry */
export interface CreateActionLogData {
  readonly userId: string;
  readonly replyId?: string;
  readonly action: ActionType;
  readonly details?: Record<string, unknown>;
  readonly isSuccess?: boolean;
  readonly errorMessage?: string;
}
