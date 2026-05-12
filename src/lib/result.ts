/**
 * Result<T> — every server action returns this. UI maps error.code to user-facing text.
 * No bare strings, no { success: false } with no detail.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export type AppError = {
  code: string;
  message: string;
  retryable: boolean;
};

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(code: string, message: string, retryable = false): Result<never> {
  return { ok: false, error: { code, message, retryable } };
}

export function isOk<T>(r: Result<T>): r is { ok: true; data: T } {
  return r.ok;
}

export function isErr<T>(r: Result<T>): r is { ok: false; error: AppError } {
  return !r.ok;
}
