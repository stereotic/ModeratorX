/**
 * OAuth PKCE state store backed by Redis.
 *
 * state → { userId, telegramId, codeVerifier } with short TTL.
 * Prevents CSRF and binds the callback to the Telegram user who started OAuth.
 */

import type Redis from 'ioredis';
import { AuthenticationError } from '../../shared/errors.js';

const KEY_PREFIX = 'oauth:twitter:';

/** Payload stored for one in-flight OAuth authorization */
export interface OAuthStatePayload {
  readonly userId: string;
  readonly telegramId: string;
  readonly codeVerifier: string;
}

export class OAuthStateStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  /** Persist PKCE verifier + user binding for `state` */
  async save(state: string, payload: OAuthStatePayload): Promise<void> {
    await this.redis.set(
      this.key(state),
      JSON.stringify(payload),
      'EX',
      this.ttlSeconds,
    );
  }

  /**
   * Load and delete state (one-time use).
   * Throws AuthenticationError if missing/expired.
   */
  async consume(state: string): Promise<OAuthStatePayload> {
    const key = this.key(state);
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new AuthenticationError('OAuth state expired or invalid. Please try again.');
    }

    await this.redis.del(key);

    const parsed: unknown = JSON.parse(raw);

    if (!isOAuthStatePayload(parsed)) {
      throw new AuthenticationError('OAuth state payload is corrupted.');
    }

    return parsed;
  }

  private key(state: string): string {
    return `${KEY_PREFIX}${state}`;
  }
}

function isOAuthStatePayload(value: unknown): value is OAuthStatePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.userId === 'string' &&
    typeof record.telegramId === 'string' &&
    typeof record.codeVerifier === 'string'
  );
}
