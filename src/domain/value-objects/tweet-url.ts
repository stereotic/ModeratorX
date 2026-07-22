/**
 * TweetUrl value object.
 * Parses common X/Twitter URL forms into a numeric tweet ID.
 */

import { ValidationError } from '../../shared/errors.js';

/** Accepted URL patterns for status posts */
const TWEET_URL_PATTERNS: readonly RegExp[] = [
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i,
  /^https?:\/\/(?:www\.)?(?:mobile\.)?(?:twitter\.com|x\.com)\/[^/]+\/statuses\/(\d+)/i,
];

export class TweetUrl {
  private constructor(
    readonly rawUrl: string,
    readonly tweetId: string,
  ) {}

  /**
   * Parse a user-provided URL (or bare numeric ID) into TweetUrl.
   * @throws ValidationError when the input is not a recognizable tweet link
   */
  static parse(input: string): TweetUrl {
    const trimmed = input.trim();

    if (/^\d{5,25}$/.test(trimmed)) {
      return new TweetUrl(`https://x.com/i/status/${trimmed}`, trimmed);
    }

    for (const pattern of TWEET_URL_PATTERNS) {
      const match = pattern.exec(trimmed);
      const id = match?.[1];

      if (id) {
        return new TweetUrl(trimmed, id);
      }
    }

    throw new ValidationError(
      'Send a valid X/Twitter post URL, e.g. https://x.com/user/status/123456',
      'tweetUrl',
    );
  }
}
