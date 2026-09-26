// A typed Result for domain logic with expected failure modes a caller must branch on,
// as opposed to throwing (for exceptional/unexpected failures).

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guards that narrow `result` to its `ok`/`err` branch. */
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

/** Forces handling of both branches in one expression, instead of an if/else. */
export function matchResult<T, E, R>(result: Result<T, E>, onOk: (value: T) => R, onErr: (error: E) => R): R {
  return result.ok ? onOk(result.value) : onErr(result.error);
}
