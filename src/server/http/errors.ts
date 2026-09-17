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
  /** Field-name -> message pairs, for errors that map to a specific form field (validation/conflict). */
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, statusCode: number, code: ErrorCode, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    // Restores the correct prototype chain when compiled down (TS/ES5
    // interop quirk with extending built-ins like Error) — without this,
    // `instanceof AppError` can fail after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not signed in.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, 400, "VALIDATION_ERROR", fieldErrors);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, 409, "CONFLICT", fieldErrors);
  }
}
