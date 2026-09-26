// Typed error hierarchy for the server layer, converted to HTTP responses by withApiErrorHandling.
// `code` is the coarse HTTP-status category; `detail` is an optional namespaced string ("DOMAIN.REASON") for callers that need to branch on a specific failure.

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
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
    // Restores the prototype chain so `instanceof AppError` works after transpilation.
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

export class RateLimitError extends AppError {
  constructor(message = "Too many requests — please slow down and try again shortly.", detail?: string) {
    super(message, 429, "RATE_LIMITED", undefined, detail);
  }
}
