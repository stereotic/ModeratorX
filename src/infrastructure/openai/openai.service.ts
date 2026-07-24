import OpenAI from 'openai';
import type { EnvConfig } from '../../config/env.config.js';
import type { Sentiment } from '../../domain/enums/index.js';
import { ExternalApiError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';
import type { RateLimiter } from '../rate-limiter/rate-limiter.js';

const log = createLogger('OpenAiService');

export interface ClassificationInput {
  readonly replyText: string;
  readonly tweetText: string | null;
  readonly customPrompt: string | null;
  readonly imageUrls?: readonly string[];
}

export interface ClassificationOutput {
  readonly sentiment: Sentiment;
  readonly confidence: number;
  readonly generatedReply: string | null;
  readonly model: string;
  readonly tokensUsed: number;
  readonly promptUsed: string;
}

const SYSTEM_PROMPT_DEFAULT =
  'You are a moderation assistant for X (Twitter). ' +
  'Analyze the reply text AND any attached images, then classify the overall sentiment.\n\n' +
  'If images contain:\n' +
  '- Hate symbols, threats, weapons, violence, gore, NSFW content → NEGATIVE\n' +
  '- Insults, rudeness, harassment (in text or on signs in images) → NEGATIVE\n' +
  '- Friendly, funny, supportive, cute content → POSITIVE\n' +
  '- Neutral memes, screenshots, random photos, or unclear content → NEUTRAL\n\n' +
  'If POSITIVE, generate a friendly reply in the same language as the reply to engage with the user. ' +
  'If NEGATIVE, respond with "HIDE" — the reply should be hidden. ' +
  'If NEUTRAL, respond with "SKIP" — no action needed.\n\n' +
  'Match the language of the reply: if the reply is in Russian, respond in Russian; ' +
  'if in English, respond in English; and so on for any other language.\n\n' +
  'Respond ONLY with valid JSON:\n' +
  '{\n' +
  '  "sentiment": "POSITIVE|NEGATIVE|NEUTRAL",\n' +
  '  "confidence": 0.0-1.0,\n' +
  '  "reply": "your reply or HIDE or SKIP"\n' +
  '}';

const RATE_LIMIT_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60_000;

export class OpenAiService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    config: EnvConfig,
    private readonly rateLimiter?: RateLimiter,
  ) {
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
    });
    this.model = config.OPENAI_MODEL;
  }

  async classify(input: ClassificationInput): Promise<ClassificationOutput> {
    await this.rateLimiter?.enforce(
      'openai:classify',
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
      'OpenAI',
    );
    const systemPrompt = input.customPrompt ?? SYSTEM_PROMPT_DEFAULT;
    const userMessage = this.buildUserMessage(input);
    const hasImages = input.imageUrls && input.imageUrls.length > 0;

    let userContent: string | { type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }[] = userMessage;

    if (hasImages) {
      log.debug({ imageUrls: input.imageUrls }, 'Classifying reply with images');
      const dataUris = await Promise.all(
        input.imageUrls.map((url) => this.urlToDataUri(url)),
      );
      userContent = [
        { type: 'text' as const, text: userMessage },
        ...dataUris.map((uri) => ({
          type: 'image_url' as const,
          image_url: { url: uri },
        })),
      ];
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const choice = response.choices[0];
      const content = choice?.message.content;

      if (!content) {
        throw new ExternalApiError('OpenAI', 'Empty response from model');
      }

      const parsed = this.parseResponse(content);
      const usage = response.usage;

      log.debug(
        {
          sentiment: parsed.sentiment,
          confidence: parsed.confidence,
          tokens: usage?.total_tokens,
        },
        'GPT classification completed',
      );

      return {
        sentiment: parsed.sentiment,
        confidence: parsed.confidence,
        generatedReply: parsed.reply,
        model: this.model,
        tokensUsed: usage?.total_tokens ?? 0,
        promptUsed: systemPrompt,
      };
    } catch (error) {
      if (error instanceof ExternalApiError) {
        throw error;
      }

      throw new ExternalApiError(
        'OpenAI',
        `Classification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        error,
      );
    }
  }

  private buildUserMessage(input: ClassificationInput): string {
    const parts: string[] = [];

    if (input.tweetText) {
      parts.push(`Original post: "${input.tweetText}"`);
    }

    parts.push(`Reply: "${input.replyText}"`);
    if (input.imageUrls && input.imageUrls.length > 0) {
      parts.push(`The reply contains ${input.imageUrls.length} image(s). Analyze them for harmful/offensive/NSFW content alongside the text.`);
    }

    parts.push('\nAnalyze the reply sentiment and respond in JSON format.');

    return parts.join('\n');
  }

  private async urlToDataUri(url: string): Promise<string> {
    const response = await fetch(url);
    const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  private parseResponse(content: string): {
    sentiment: Sentiment;
    confidence: number;
    reply: string | null;
  } {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const sentiment = this.normalizeSentiment(parsed.sentiment);
      const confidence = this.normalizeConfidence(parsed.confidence);
      const rawReply = typeof parsed.reply === 'string' ? parsed.reply : null;

      let reply: string | null = rawReply;

      if (rawReply === 'HIDE' || rawReply === 'SKIP' || rawReply === '') {
        reply = null;
      }

      return { sentiment, confidence, reply };
    } catch {
      log.warn({ content }, 'Failed to parse GPT JSON response, falling back to NEUTRAL');
      return { sentiment: 'NEUTRAL', confidence: 0.5, reply: null };
    }
  }

  private normalizeSentiment(value: unknown): Sentiment {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();

      if (upper === 'POSITIVE' || upper === 'NEGATIVE' || upper === 'NEUTRAL') {
        return upper;
      }
    }

    return 'NEUTRAL';
  }

  private normalizeConfidence(value: unknown): number {
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      return value;
    }

    if (typeof value === 'string') {
      const num = Number.parseFloat(value);
      if (!Number.isNaN(num) && num >= 0 && num <= 1) {
        return num;
      }
    }

    return 0.7;
  }
}
