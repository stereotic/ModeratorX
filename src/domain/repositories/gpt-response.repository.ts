/**
 * GptResponse repository interface.
 */

import type {
  GptResponseEntity,
  CreateGptResponseData,
} from '../entities/gpt-response.entity.js';

export interface GptResponseRepository {
  findById(id: string): Promise<GptResponseEntity | null>;
  findByReplyId(replyId: string): Promise<GptResponseEntity | null>;
  create(data: CreateGptResponseData): Promise<GptResponseEntity>;
  upsertByReplyId(data: CreateGptResponseData): Promise<GptResponseEntity>;
}
