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
 * Four roles (prisma/schema.prisma's `Role` enum): `SUPER_ADMIN` (the
 * MeeronBi team — every facility, no scoping), `ADMIN` (hospital staff —
 * their own facility only), `PATIENT` (their own record only), and
 * `RESEARCHER` (analytics-only, gated separately by
 * `requireResearcherSession` — structurally can never reach the guards
 * below that touch per-patient data, not just denied by a role check that
 * could be loosened by mistake later).
 *
 * Multi-tenancy: a session's `facilityId` is the tenant boundary (see
 * prisma/schema.prisma's Facility model) for `ADMIN`/`PATIENT`. Every guard
 * below that resolves a *specific* patient also confirms that patient
 * belongs to the caller's facility, and reports a facility mismatch as
 * NotFoundError — not ForbiddenError — so a session from one hospital
 * can't even learn that a given id exists at another one.
 * `SUPER_ADMIN` is the one deliberate exception: its `facilityId` (a
 * seeded "HQ" facility — see prisma/seed.ts) is an administrative home,
 * not an access-control boundary, so every guard below bypasses the
 * facility-match check specifically for that role rather than relying on
 * facilityId equality the way ADMIN/PATIENT's checks do.
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

/** Require an authenticated ADMIN or SUPER_ADMIN session; throws otherwise. SUPER_ADMIN is a strict superset of ADMIN — every existing ADMIN-only route should also work for the MeeronBi team without a separate check. */
export async function requireAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Admin access only.");
  }
  if (!(await userExists(session.user.id))) throw new UnauthorizedError(STALE_SESSION_MESSAGE);
  return session;
}

/** Require an authenticated SUPER_ADMIN session specifically — not just any admin. Used for cross-facility operations (approving/rejecting researcher requests, anything that isn't scoped to one hospital). */
export async function requireSuperAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "SUPER_ADMIN") throw new ForbiddenError("Super-admin access only.");
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
 * Require an authenticated, APPROVED RESEARCHER session. Always re-checks
 * approval status fresh from the database rather than trusting the
 * session cookie's cached `researcherStatus` — that field exists only for
 * display convenience (e.g. an "access pending" banner without an extra
 * fetch); the actual gate has to reflect an approval getting revoked
 * *today*, not whenever a 30-day JWT happens to expire. No Analytics
 * routes exist yet (see docs/ANALYTICS_PLAN.md) — this is here so
 * whichever route is built first has a correct guard to call from day
 * one, the same reasoning as building disclosureControl.ts before any
 * aggregation function existed.
 */
export async function requireResearcherSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "RESEARCHER") throw new ForbiddenError("Researcher access only.");

  const profile = await prisma.researcherProfile.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });
  if (!profile || profile.status !== "APPROVED") {
    throw new ForbiddenError("Your researcher access isn't approved.");
  }
  return session;
}

/**
 * Require an authenticated ADMIN/SUPER_ADMIN session, AND that `patientId`
 * belongs to that admin's own facility (skipped for SUPER_ADMIN — see the
 * module comment on why that role bypasses facility-matching everywhere).
 * Every write path that takes a patient id (saving/deleting a tab record,
 * deleting a patient, setting up portal access) needs this, not the plain
 * `requireAdminSession()` above, or an admin at one facility could act on
 * another facility's patient just by knowing/guessing its id. A
 * cross-facility id reports as NotFoundError, same reasoning as
 * `assertPatientRecordAccessible` below.
 */
export async function requireAdminSessionForPatient(patientId: string): Promise<Session> {
  const session = await requireAdminSession();
  if (session.user.role === "SUPER_ADMIN") {
    const exists = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!exists) throw new NotFoundError("Patient not found.");
    return session;
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { facilityId: true } });
  if (!patient || patient.facilityId !== session.user.facilityId) {
    throw new NotFoundError("Patient not found.");
  }
  return session;
}

/**
 * A patient record is visible to: any admin **at that patient's own
 * facility** (or any SUPER_ADMIN, at any facility), or the patient it
 * belongs to. Used by routes that serve per-tab data, where both roles can
 * GET but only admins can write (which additionally needs
 * `requireAdminSessionForPatient` above, not just this). Returns the
 * session on success (so the caller doesn't need a second `getSession()`
 * call to get at `facilityId` etc.) and throws otherwise — NotFoundError
 * for a real patient at a different facility (don't confirm it exists),
 * ForbiddenError for a patient session trying to reach someone else's
 * record.
 */
export async function assertPatientRecordAccessible(patientId: string): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role === "SUPER_ADMIN") {
    const exists = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!exists) throw new NotFoundError("Patient not found.");
    return session;
  }
  if (session.user.role === "ADMIN") {
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { facilityId: true } });
    if (!patient || patient.facilityId !== session.user.facilityId) throw new NotFoundError("Patient not found.");
    return session;
  }
  if (session.user.role === "PATIENT" && session.user.patientId === patientId) return session;
  throw new ForbiddenError();
}
