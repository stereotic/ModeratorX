/**
 * Maps twitter-api-v2 errors into our domain error hierarchy.
 */

import { ApiResponseError } from 'twitter-api-v2';
import {
  AuthenticationError,
  ExternalApiError,
  RateLimitError,
  type AppError,
} from '../../shared/errors.js';

/**
 * Map X API errors into our domain error hierarchy.
 * Returns an AppError instance — caller must throw it.
 */
export function mapTwitterError(error: unknown, operation: string): AppError {
  if (error instanceof ApiResponseError) {
    if (error.rateLimitError) {
      const resetAt = error.rateLimit?.reset ?? Math.floor(Date.now() / 1000) + 60;
      const retryAfterSeconds = Math.max(1, resetAt - Math.floor(Date.now() / 1000));
      return new RateLimitError('Twitter', retryAfterSeconds);
    }

    if (error.isAuthError || error.code === 401 || error.code === 403) {
      return new AuthenticationError(`Twitter ${operation} failed: ${error.message}`);
    }

    return new ExternalApiError('Twitter', `${operation}: ${error.message}`, error);
  }

  if (error instanceof Error) {
    return new ExternalApiError('Twitter', `${operation}: ${error.message}`, error);
  }

  return new ExternalApiError('Twitter', `${operation}: unknown error`, error);
}
