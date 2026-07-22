/**
 * Custom error hierarchy for the application.
 *
 * Operational errors (isOperational=true) are expected and safe to surface.
 * Programmer errors should remain isOperational=false and trigger alerts.
 */

/** Base application error with HTTP-like status codes */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Resource not found */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier "${identifier}" not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

/** Validation error for invalid input data */
export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

/** Conflict error for duplicate resources */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/** Business rule / limit exceeded (e.g. max 5 accounts) */
export class LimitExceededError extends AppError {
  constructor(message: string) {
    super(message, 403, 'LIMIT_EXCEEDED');
  }
}

/** Rate limit exceeded on external API */
export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;
  public readonly apiName: string;

  constructor(apiName: string, retryAfterSeconds: number) {
    super(`${apiName} rate limit exceeded. Retry after ${retryAfterSeconds}s`, 429, 'RATE_LIMIT');
    this.retryAfterSeconds = retryAfterSeconds;
    this.apiName = apiName;
  }
}

/** External API returned an error */
export class ExternalApiError extends AppError {
  public readonly apiName: string;
  public readonly originalError?: unknown;

  constructor(apiName: string, message: string, originalError?: unknown) {
    super(`${apiName} API error: ${message}`, 502, 'EXTERNAL_API_ERROR');
    this.apiName = apiName;
    this.originalError = originalError;
  }
}

/** Authentication error (invalid/expired tokens) */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/** Encryption/decryption failure */
export class CryptoError extends AppError {
  constructor(message: string) {
    super(message, 500, 'CRYPTO_ERROR', false);
  }
}

/** Type guard for AppError */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
