// Namespaced `detail` codes for auth/session errors — same pattern as server/analytics/errors.ts.

import { ForbiddenError, UnauthorizedError } from "@/server/http/errors";

export const AUTH_ERROR = {
  SESSION_STALE: "AUTH.SESSION_STALE",
  RESEARCHER_NOT_APPROVED: "AUTH.RESEARCHER_NOT_APPROVED",
  WRONG_ROLE: "AUTH.WRONG_ROLE",
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
