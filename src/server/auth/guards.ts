import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "@/server/db/prisma";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/server/http/errors";

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
 *
 * Multi-tenancy: a session's `facilityId` is the tenant boundary (see
 * prisma/schema.prisma's Facility model). Every guard below that resolves
 * a *specific* patient also confirms that patient belongs to the caller's
 * facility, and reports a facility mismatch as NotFoundError — not
 * ForbiddenError — so a session from one hospital can't even learn that a
 * given id exists at another one. Role checks alone are NOT enough once
 * more than one facility exists.
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
 * Require an authenticated ADMIN session, AND that `patientId` belongs to
 * that admin's own facility — every write path that takes a patient id
 * (saving/deleting a tab record, deleting a patient, setting up portal
 * access) needs this, not the plain `requireAdminSession()` above, or an
 * admin at one facility could act on another facility's patient just by
 * knowing/guessing its id. A cross-facility id reports as NotFoundError,
 * same reasoning as `assertPatientRecordAccessible` below.
 */
export async function requireAdminSessionForPatient(patientId: string): Promise<Session> {
  const session = await requireAdminSession();
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { facilityId: true } });
  if (!patient || patient.facilityId !== session.user.facilityId) {
    throw new NotFoundError("Patient not found.");
  }
  return session;
}

/**
 * A patient record is visible to: any admin **at that patient's own
 * facility**, or the patient it belongs to. Used by routes that serve
 * per-tab data, where both roles can GET but only admins can write (which
 * additionally needs `requireAdminSessionForPatient` above, not just this).
 * Returns the session on success (so the caller doesn't need a second
 * `getSession()` call to get at `facilityId` etc.) and throws otherwise —
 * NotFoundError for a real patient at a different facility (don't confirm
 * it exists), ForbiddenError for a patient session trying to reach someone
 * else's record.
 */
export async function assertPatientRecordAccessible(patientId: string): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role === "ADMIN") {
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { facilityId: true } });
    if (!patient || patient.facilityId !== session.user.facilityId) throw new NotFoundError("Patient not found.");
    return session;
  }
  if (session.user.role === "PATIENT" && session.user.patientId === patientId) return session;
  throw new ForbiddenError();
}
