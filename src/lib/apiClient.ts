// ─────────────────────────────────────────────────────────────────────────
// Client-side counterpart to server/http/errors.ts. The server already
// throws typed AppErrors and withApiErrorHandling turns them into
// `{ error, code, fieldErrors }` JSON — this is the one place on the client
// that reads that shape back out, so every fetch call site can react to
// *why* a request failed (expired session vs. no permission vs. a genuine
// server problem) instead of showing one generic "failed, try again" toast
// for everything. See docs/ARCHITECTURE.md's "Typed errors instead of
// string messages" section for the server-side half of this.
// ─────────────────────────────────────────────────────────────────────────

import type { ErrorCode } from "@/server/http/errors";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  /** Namespaced specific-reason code, e.g. "ANALYTICS.UNKNOWN_FIELD" — see server/http/errors.ts. Most errors don't have one; only check this when you genuinely need to branch on the specific reason, not just the coarse `code`. */
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, code?: ErrorCode, fieldErrors?: Record<string, string>, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.detail = detail;
  }
}

/**
 * Reads a fetch Response that came back !ok into an ApiError. Never assumes
 * the body is valid JSON — a proxy error or a crashed server can return an
 * empty/HTML body, and calling .json() on that would throw a confusing
 * "Unexpected end of JSON input" instead of a catchable error.
 */
export async function toApiError(res: Response, fallbackMessage = "Something went wrong."): Promise<ApiError> {
  const json = await res.json().catch(() => null);
  return new ApiError(json?.error || fallbackMessage, res.status, json?.code, json?.fieldErrors, json?.detail);
}

/**
 * Maps a caught error to a short, actionable toast message. Distinguishes
 * the handful of situations a person can actually act on — "sign in again",
 * "you don't have access", "check your connection" — from a genuine server
 * failure, instead of one generic "failed to save" for every case. Falls
 * back to the caller-supplied message for anything it doesn't specifically
 * recognize (including a plain `Error` that isn't an ApiError at all).
 */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "UNAUTHORIZED":
        return "Your session has expired — please sign out and sign in again.";
      case "FORBIDDEN":
        return err.message || "You don't have permission to do this.";
      case "NOT_FOUND":
        return err.message || "That record couldn't be found — it may have been deleted.";
      case "VALIDATION_ERROR":
      case "CONFLICT":
        // These already carry a specific, person-readable message from the
        // server (e.g. "This CR No./MRD is already used by another
        // patient") — showing it as-is is more useful than a generic line.
        return err.message || fallback;
      case "INTERNAL_ERROR":
        return "Something went wrong on our end — please try again.";
      default:
        return err.message || fallback;
    }
  }
  // fetch() itself rejects with a TypeError when the request never reaches
  // the server at all (offline, DNS failure, the dev server not running).
  if (err instanceof TypeError) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return fallback;
}
