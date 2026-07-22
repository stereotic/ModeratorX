/**
 * GptResponse domain entity.
 * Immutable audit record of one OpenAI analysis call.
 */

import type { Sentiment } from '../enums/index.js';

export interface GptResponseEntity {
  readonly id: string;
  readonly replyId: string;
  readonly sentiment: Sentiment;
  readonly confidence: number | null;
  readonly generatedReply: string | null;
  readonly promptUsed: string;
  readonly model: string;
  readonly tokensUsed: number | null;
  readonly createdAt: Date;
}

/** Data required to create a GPT response audit row */
export interface CreateGptResponseData {
  readonly replyId: string;
  readonly sentiment: Sentiment;
  readonly confidence?: number;
  readonly generatedReply?: string;
  readonly promptUsed: string;
  readonly model: string;
  readonly tokensUsed?: number;
}
