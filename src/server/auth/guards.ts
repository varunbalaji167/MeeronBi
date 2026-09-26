import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "@/server/db/prisma";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/server/http/errors";

/**
 * Access-control guards used by every API route/server layout; throw typed errors instead of returning a result union.
 * Roles: SUPER_ADMIN (all facilities), ADMIN (own facility), PATIENT (own record), RESEARCHER (analytics-only, gated separately).
 * facilityId is the tenant boundary for ADMIN/PATIENT; a cross-facility patient reports NotFoundError, never ForbiddenError.
 * SUPER_ADMIN's facilityId is an administrative home only and bypasses the facility-match check everywhere below.
 */

export async function getSession() {
  return getServerSession(authOptions);
}

const STALE_SESSION_MESSAGE =
  "Your session is no longer valid (often caused by a database reset/reseed after you signed in) — please sign out and sign in again.";

/** Confirms the session's user id still exists, catching a stale cookie left over from a DB reset/reseed. */
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

/** Require an authenticated, APPROVED RESEARCHER session, re-checked fresh from the database (not the cached session cookie). */
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

/** Require an ADMIN/SUPER_ADMIN session where `patientId` belongs to the admin's own facility (skipped for SUPER_ADMIN). Every write path taking a patientId must use this, not `requireAdminSession`. */
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
 * A patient record is visible to an admin at that patient's own facility, any SUPER_ADMIN, or the patient themselves.
 * Throws NotFoundError for a different facility's patient, ForbiddenError for a patient session reaching someone else's record.
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
