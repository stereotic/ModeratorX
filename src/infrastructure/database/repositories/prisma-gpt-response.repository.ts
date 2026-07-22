/**
 * Prisma implementation of GptResponseRepository.
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { GptResponseRepository } from '../../../domain/repositories/gpt-response.repository.js';
import type {
  GptResponseEntity,
  CreateGptResponseData,
} from '../../../domain/entities/gpt-response.entity.js';
import { mapGptResponse } from '../mappers/prisma.mappers.js';

export class PrismaGptResponseRepository implements GptResponseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<GptResponseEntity | null> {
    const row = await this.prisma.gptResponse.findUnique({ where: { id } });
    return row ? mapGptResponse(row) : null;
  }

  async findByReplyId(replyId: string): Promise<GptResponseEntity | null> {
    const row = await this.prisma.gptResponse.findUnique({ where: { replyId } });
    return row ? mapGptResponse(row) : null;
  }

  async create(data: CreateGptResponseData): Promise<GptResponseEntity> {
    const row = await this.prisma.gptResponse.create({
      data: {
        replyId: data.replyId,
        sentiment: data.sentiment,
        confidence: data.confidence ?? null,
        generatedReply: data.generatedReply ?? null,
        promptUsed: data.promptUsed,
        model: data.model,
        tokensUsed: data.tokensUsed ?? null,
      },
    });

    return mapGptResponse(row);
  }

  async upsertByReplyId(data: CreateGptResponseData): Promise<GptResponseEntity> {
    const row = await this.prisma.gptResponse.upsert({
      where: { replyId: data.replyId },
      create: {
        replyId: data.replyId,
        sentiment: data.sentiment,
        confidence: data.confidence ?? null,
        generatedReply: data.generatedReply ?? null,
        promptUsed: data.promptUsed,
        model: data.model,
        tokensUsed: data.tokensUsed ?? null,
      },
      update: {
        sentiment: data.sentiment,
        confidence: data.confidence ?? null,
        generatedReply: data.generatedReply ?? null,
        promptUsed: data.promptUsed,
        model: data.model,
        tokensUsed: data.tokensUsed ?? null,
      },
    });

    return mapGptResponse(row);
  }
}
