// ─────────────────────────────────────────────────────────────────────────
// A typed Result, for domain logic with EXPECTED failure modes a caller
// genuinely needs to branch on — as opposed to throwing, which is for
// exceptional/unexpected failures (see server/http/errors.ts for those).
//
// Analytics is the first real consumer of this (an unknown field ref, or
// picking the same field as both Field and Filter, isn't a bug or an
// infrastructure failure — it's a normal, expected outcome of a flexible
// field-picker UI that a caller needs to handle gracefully), but this is a
// general domain/ utility, not an Analytics-specific one. Prefer this over
// throwing for any new domain function where "it didn't work" is a normal
// possible outcome, not a bug.
//
// Why a Result instead of throwing here specifically: TypeScript's
// exhaustiveness checking can force a caller to handle both `ok` and `err`
// branches (via the `match`/type-narrowing helpers below), which catches
// "forgot to handle the failure case" at compile time. A thrown error has
// no such guarantee — nothing stops a caller from forgetting the `catch`.
// ─────────────────────────────────────────────────────────────────────────

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guards, so `if (isOk(result))` narrows `result.value`'s type without a manual `result.ok === true` check everywhere. */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Transforms the success value, leaving an error untouched — for chaining without unwrapping. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Forces handling of both branches in one expression, instead of an
 * `if (result.ok) { ... } else { ... }` — mainly useful at the boundary
 * where a Result needs to become something else entirely (an HTTP
 * response, a thrown AppError for a route handler, a rendered error
 * message), which is usually every Result's eventual destination anyway.
 */
export function matchResult<T, E, R>(result: Result<T, E>, onOk: (value: T) => R, onErr: (error: E) => R): R {
  return result.ok ? onOk(result.value) : onErr(result.error);
}
