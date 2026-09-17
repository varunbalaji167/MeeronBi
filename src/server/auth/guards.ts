import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "@/server/db/prisma";
import { UnauthorizedError, ForbiddenError } from "@/server/http/errors";

/**
 * Access-control guards used by every API route and server layout. These
 * are the actual security boundary — client-side role checks (AuthContext,
 * middleware redirects) are UX conveniences on top of this, not substitutes
 * for it. Every route handler under src/app/api must call one of the
 * `require*`/`assert*` functions below before touching data.
 *
 * These throw typed errors (see server/http/errors.ts) rather than
 * returning a `{ ok, status, message }` union — combined with
 * `withApiErrorHandling` wrapping every route, a call site just does
 * `const session = await requireAdminSession();` with no branching, and
 * the right HTTP status/JSON shape happens automatically if it throws.
 */

export async function getSession() {
  return getServerSession(authOptions);
}

const STALE_SESSION_MESSAGE =
  "Your session is no longer valid (often caused by a database reset/reseed after you signed in) — please sign out and sign in again.";

/**
 * Sessions here are signed JWTs, not looked up in the database on every
 * request — that's what makes navigation fast and avoids re-prompting for
 * login (see docs/ARCHITECTURE.md). The tradeoff: if the database is reset
 * or reseeded, an already-issued cookie still claims to be a user id that
 * no longer exists. Without this check, that stale session sails through
 * every guard below and only fails much later as a confusing foreign-key
 * violation on write. This catches it right at the guard instead.
 */
async function userExists(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return !!user;
}

/** Require an authenticated ADMIN (hospital staff) session; throws otherwise. */
export async function requireAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError("Admin access only.");
  if (!(await userExists(session.user.id))) throw new UnauthorizedError(STALE_SESSION_MESSAGE);
  return session;
}

/** Require an authenticated PATIENT session; throws otherwise. */
export async function requirePatientSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "PATIENT" || !session.user.patientId) {
    throw new ForbiddenError("Patient access only.");
  }
  if (!(await userExists(session.user.id))) throw new UnauthorizedError(STALE_SESSION_MESSAGE);
  return session;
}

/**
 * A patient record is visible to: any admin, or the patient it belongs to.
 * Used by routes that serve per-tab data, where both roles can GET but only
 * admins can write. Throws if neither condition holds.
 */
export async function assertPatientRecordAccessible(patientId: string): Promise<void> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role === "ADMIN") return;
  if (session.user.role === "PATIENT" && session.user.patientId === patientId) return;
  throw new ForbiddenError();
}
