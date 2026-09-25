// ─────────────────────────────────────────────────────────────────────────
// A small typed-error hierarchy for the server layer, instead of throwing
// generic `Error("some message")` or returning ad-hoc `{ ok, status,
// message }` shapes from every function that can fail differently.
//
// Why this matters: a caller (a route handler, or a guard's caller) can
// `catch` and `instanceof`-check for a SPECIFIC failure mode — "was this a
// permissions problem? a not-found? a conflict with existing data?" —
// instead of pattern-matching on a string message, which breaks silently
// the moment someone rewords the message. `withApiErrorHandling`
// (server/http/withApiErrorHandling.ts) is the ONE place that converts
// these into HTTP responses, so every route gets consistent status codes
// and JSON shape for free just by throwing the right error type.
//
// Two dimensions, not one: `code` is the coarse HTTP-status-aligned
// category (is this a 401? a 404? a 409?) — fine for "should the client
// retry" / "should it redirect to login" branching, but not specific
// enough once there are dozens of distinct business rules across a
// growing field registry and multiple regions. `detail` is an optional,
// namespaced, stable string for the SPECIFIC reason within that category
// — "<DOMAIN>.<SPECIFIC_REASON>", e.g. "PATIENT.MRD_DUPLICATE" or
// "ANALYTICS.UNKNOWN_FIELD". Add a `detail` once a caller (or a future
// i18n message catalog mapping code -> localized text) genuinely needs to
// branch on/localize THIS specific failure, not just "was it a 404" —
// most errors are fine identified by `code` + `message` alone, so don't
// invent a `detail` for every error out of habit. Each domain module that
// needs one defines its own constants near where it throws (see
// server/analytics/errors.ts for the first example) rather than
// centralizing every possible code into one giant enum here.
// ─────────────────────────────────────────────────────────────────────────

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  /** Namespaced specific-reason code — see the module comment above. Optional; most errors don't need one. */
  readonly detail?: string;
  /** Field-name -> message pairs, for errors that map to a specific form field (validation/conflict). */
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, statusCode: number, code: ErrorCode, fieldErrors?: Record<string, string>, detail?: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.detail = detail;
    // Restores the correct prototype chain when compiled down (TS/ES5
    // interop quirk with extending built-ins like Error) — without this,
    // `instanceof AppError` can fail after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not signed in.", detail?: string) {
    super(message, 401, "UNAUTHORIZED", undefined, detail);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this.", detail?: string) {
    super(message, 403, "FORBIDDEN", undefined, detail);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.", detail?: string) {
    super(message, 404, "NOT_FOUND", undefined, detail);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>, detail?: string) {
    super(message, 400, "VALIDATION_ERROR", fieldErrors, detail);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>, detail?: string) {
    super(message, 409, "CONFLICT", fieldErrors, detail);
  }
}
