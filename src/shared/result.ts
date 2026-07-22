/**
 * Discriminated Result type for explicit success/failure without throwing.
 * Prefer for domain/application boundaries; keep exceptions for infra faults.
 */

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Create a successful Result */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Create a failed Result */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guard for successful Result */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/** Type guard for failed Result */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
