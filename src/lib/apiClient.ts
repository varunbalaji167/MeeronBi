// Parses the `{ error, code, fieldErrors }` JSON shape from server/http/errors.ts.
import type { ErrorCode } from "@/server/http/errors";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  /** Namespaced specific-reason code, e.g. "ANALYTICS.UNKNOWN_FIELD". */
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string>;
  /** Correlation id for looking up this request in server logs/Sentry. */
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code?: ErrorCode,
    fieldErrors?: Record<string, string>,
    detail?: string,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.detail = detail;
    this.requestId = requestId;
  }
}

/** Reads a non-ok fetch Response into an ApiError; tolerates a non-JSON body. */
export async function toApiError(res: Response, fallbackMessage = "Something went wrong."): Promise<ApiError> {
  const json = await res.json().catch(() => null);
  const requestId = json?.requestId || res.headers.get("x-request-id") || undefined;
  return new ApiError(json?.error || fallbackMessage, res.status, json?.code, json?.fieldErrors, json?.detail, requestId);
}

/** Namespaced `detail` codes that need a distinctly different message than their `code`'s generic one. */
const DETAIL_MESSAGES: Partial<Record<string, string>> = {
  "AUTH.SESSION_STALE":
    "Your session is no longer valid (often caused by a database reset/reseed after you signed in) — please sign out and sign in again.",
};

/** Maps a caught error to a short, actionable toast message. */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.detail && DETAIL_MESSAGES[err.detail]) return DETAIL_MESSAGES[err.detail]!;

    // Append the request id on 5xx so it can be traced in server logs/Sentry.
    const ref = err.status >= 500 && err.requestId ? ` (ref: ${err.requestId})` : "";
    switch (err.code) {
      case "UNAUTHORIZED":
        return "Your session has expired — please sign out and sign in again.";
      case "FORBIDDEN":
        return err.message || "You don't have permission to do this.";
      case "NOT_FOUND":
        return err.message || "That record couldn't be found — it may have been deleted.";
      case "VALIDATION_ERROR":
      case "CONFLICT":
        return err.message || fallback;
      case "RATE_LIMITED":
        return err.message || "Too many requests — please slow down and try again shortly.";
      case "INTERNAL_ERROR":
        return `Something went wrong on our end — please try again.${ref}`;
      default:
        return `${err.message || fallback}${ref}`;
    }
  }
  // fetch() rejects with TypeError when the request never reaches the server.
  if (err instanceof TypeError) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return fallback;
}
