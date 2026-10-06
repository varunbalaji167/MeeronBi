// Namespaced `detail` codes for auth/session errors — same pattern as server/analytics/errors.ts.

import { ForbiddenError, UnauthorizedError, ValidationError } from "@/server/http/errors";

export const AUTH_ERROR = {
  SESSION_STALE: "AUTH.SESSION_STALE",
  RESEARCHER_NOT_APPROVED: "AUTH.RESEARCHER_NOT_APPROVED",
  WRONG_ROLE: "AUTH.WRONG_ROLE",
  EMAIL_NOT_VERIFIED: "AUTH.EMAIL_NOT_VERIFIED",
  PASSWORD_NOT_SET: "AUTH.PASSWORD_NOT_SET",
  TOKEN_INVALID: "AUTH.TOKEN_INVALID",
  TOKEN_EXPIRED: "AUTH.TOKEN_EXPIRED",
  TOKEN_WRONG_PURPOSE: "AUTH.TOKEN_WRONG_PURPOSE",
} as const;

/** A session's user id no longer exists — a stale cookie left over from a DB reset/reseed. */
export function sessionStaleError(): UnauthorizedError {
  return new UnauthorizedError(
    "Your session is no longer valid (often caused by a database reset/reseed after you signed in) — please sign out and sign in again.",
    AUTH_ERROR.SESSION_STALE
  );
}

/** The signed-in session's role doesn't have access to the route it's calling. `message` names which role is required. */
export function wrongRoleError(message: string): ForbiddenError {
  return new ForbiddenError(message, AUTH_ERROR.WRONG_ROLE);
}

/** An authenticated RESEARCHER session whose ResearcherProfile isn't (yet) APPROVED. */
export function researcherNotApprovedError(): ForbiddenError {
  return new ForbiddenError("Your researcher access isn't approved.", AUTH_ERROR.RESEARCHER_NOT_APPROVED);
}

/** A RESEARCHER account whose email hasn't been verified yet — thrown from authorize() before the PENDING check. */
export function emailNotVerifiedError(): ForbiddenError {
  return new ForbiddenError(
    "Please verify your email before signing in — check your inbox for the verification link, or request a new one.",
    AUTH_ERROR.EMAIL_NOT_VERIFIED
  );
}

/** An account with no password yet — a provisioned user who hasn't accepted their invite. */
export function passwordNotSetError(): ForbiddenError {
  return new ForbiddenError(
    "You haven't set a password yet — check your email for the set-up link.",
    AUTH_ERROR.PASSWORD_NOT_SET
  );
}

/** A credential token whose hash doesn't match any row, or that otherwise can't be resolved. Also covers wrong-purpose, which is logged specifically but shown generically to the client. */
export function tokenInvalidError(): ValidationError {
  return new ValidationError("This link isn't valid. Request a new one.", undefined, AUTH_ERROR.TOKEN_INVALID);
}

/** A credential token past its expiresAt. */
export function tokenExpiredError(): ValidationError {
  return new ValidationError("This link has expired. Request a new one.", undefined, AUTH_ERROR.TOKEN_EXPIRED);
}

/** Same client message as `tokenInvalidError`; distinct `detail` so this (more serious) case is distinguishable in logs. */
export function tokenWrongPurposeError(): ValidationError {
  return new ValidationError("This link isn't valid. Request a new one.", undefined, AUTH_ERROR.TOKEN_WRONG_PURPOSE);
}
