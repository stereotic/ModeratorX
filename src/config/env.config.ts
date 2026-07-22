/**
 * Environment configuration service.
 *
 * Validates all env vars with Zod at first access (lazy singleton).
 * Fails fast with descriptive errors — never runs with partial config.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),

  // Process role when running a single binary in Docker
  PROCESS_ROLE: z.enum(['bot', 'worker', 'all']).default('all'),

  // HTTP server (OAuth callback)
  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  // Twitter / X API (OAuth 2.0 PKCE)
  TWITTER_CLIENT_ID: z.string().min(1, 'TWITTER_CLIENT_ID is required'),
  TWITTER_CLIENT_SECRET: z.string().min(1, 'TWITTER_CLIENT_SECRET is required'),
  TWITTER_CALLBACK_URL: z.url({ error: 'TWITTER_CALLBACK_URL must be a valid URL' }),

  // OpenAI / OpenRouter
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  /** OAuth PKCE state TTL in Redis (seconds) */
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  /** Refresh access token this many seconds before expiry */
  TOKEN_REFRESH_SKEW_SECONDS: z.coerce.number().int().positive().default(300),

  // Encryption (32-byte key as 64 hex chars)
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must be a valid hex string'),

  // Product limits — tuned for Basic / pay-per-use X API
  DEFAULT_CHECK_INTERVAL: z.coerce.number().int().min(30).default(60),
  MIN_CHECK_INTERVAL: z.coerce.number().int().min(30).default(30),
  MAX_CHECK_INTERVAL: z.coerce.number().int().min(60).default(600),
  MAX_MONITORED_TWEETS_PER_ACCOUNT: z.coerce.number().int().positive().default(20),
  MAX_TWITTER_ACCOUNTS_PER_USER: z.coerce.number().int().min(1).max(10).default(5),
  DEFAULT_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
});

/** Parsed and validated environment configuration */
export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

/**
 * Load and validate environment variables once.
 * Subsequent calls return the cached instance.
 */
export function getConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  if (result.data.NODE_ENV === 'production') {
    const placeholderPatterns = [
      { key: 'TELEGRAM_BOT_TOKEN', pattern: /^your_/ },
      { key: 'TWITTER_CLIENT_ID', pattern: /^your_/ },
      { key: 'TWITTER_CLIENT_SECRET', pattern: /^your_/ },
      { key: 'OPENAI_API_KEY', pattern: /^your_/ },
      { key: 'ENCRYPTION_KEY', pattern: /^(replace_|your_)/ },
    ];

    for (const { key, pattern } of placeholderPatterns) {
      const value: unknown = (result.data as Record<string, unknown>)[key];

      if (typeof value === 'string' && pattern.test(value)) {
        throw new Error(
          `Production startup blocked: ${key} still contains a placeholder value. ` +
          'Set a real value in .env or environment variables before deploying.',
        );
      }
    }
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Reset cached config (test-only helper).
 * Do not use in production code paths.
 */
export function resetConfigForTests(): void {
  cachedConfig = null;
}
