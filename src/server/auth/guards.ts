import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "@/server/db/prisma";
import { UnauthorizedError, ForbiddenError } from "@/server/http/errors";
import { sessionStaleError, wrongRoleError, researcherNotApprovedError } from "./errors";
import { patientNotFoundInFacilityError } from "@/server/patients/errors";

/**
 * Access-control guards used by every API route/server layout; throw typed errors instead of returning a result union.
 * Roles: SUPER_ADMIN (all facilities), ADMIN (own facility), PATIENT (own record), RESEARCHER (analytics-only, gated separately).
 * facilityId is the tenant boundary for ADMIN/PATIENT; a cross-facility patient reports NotFoundError, never ForbiddenError.
 * SUPER_ADMIN's facilityId is an administrative home only and bypasses the facility-match check everywhere below.
 * Google authenticates, this database authorizes: Google sign-in can only sign into an account that
 * already exists here, never from the Google profile — see domain/auth/googleSignIn.ts.
 */

export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Confirms the session's user id still exists (catching a stale cookie left over from a DB reset/reseed)
 * and that its passwordChangedAt still matches the DB. Sessions are 30-day JWTs with no rotation, so without
 * this a password reset would not evict a session an attacker already holds — comparing this one extra
 * column (already fetched on every request guards run) makes a reset actually mean something.
 */
async function assertSessionFresh(session: Session): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordChangedAt: true },
  });
  if (!user) throw sessionStaleError();
  const dbValue = user.passwordChangedAt?.toISOString() ?? null;
  if (dbValue !== session.user.passwordChangedAt) throw sessionStaleError();
}

/** Require an authenticated ADMIN or SUPER_ADMIN session; throws otherwise. SUPER_ADMIN is a strict superset of ADMIN — every existing ADMIN-only route should also work for the MeeronBi team without a separate check. */
export async function requireAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw wrongRoleError("Admin access only.");
  }
  await assertSessionFresh(session);
  return session;
}

/** Require an authenticated SUPER_ADMIN session specifically — not just any admin. Used for cross-facility operations (approving/rejecting researcher requests, anything that isn't scoped to one hospital). */
export async function requireSuperAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "SUPER_ADMIN") throw wrongRoleError("Super-admin access only.");
  await assertSessionFresh(session);
  return session;
}

/** Require an authenticated PATIENT session; throws otherwise. */
export async function requirePatientSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "PATIENT" || !session.user.patientId) {
    throw wrongRoleError("Patient access only.");
  }
  await assertSessionFresh(session);
  return session;
}

/** Require an authenticated, APPROVED RESEARCHER session, re-checked fresh from the database (not the cached session cookie). */
export async function requireResearcherSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "RESEARCHER") throw wrongRoleError("Researcher access only.");

  const profile = await prisma.researcherProfile.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });
  if (!profile || profile.status !== "APPROVED") {
    throw researcherNotApprovedError();
  }
  return session;
}

/** `facilityId` omitted (super-admin/unscoped) checks the patient merely exists; given, checks it matches. */
export async function patientBelongsToFacility(patientId: string, facilityId?: string): Promise<boolean> {
  if (facilityId === undefined) {
    const exists = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    return !!exists;
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { facilityId: true } });
  return !!patient && patient.facilityId === facilityId;
}

async function assertPatientBelongsToFacility(patientId: string, facilityId?: string): Promise<void> {
  if (!(await patientBelongsToFacility(patientId, facilityId))) throw patientNotFoundInFacilityError();
}

/** Require an ADMIN/SUPER_ADMIN session where `patientId` belongs to the admin's own facility (skipped for SUPER_ADMIN). Every write path taking a patientId must use this, not `requireAdminSession`. */
export async function requireAdminSessionForPatient(patientId: string): Promise<Session> {
  const session = await requireAdminSession();
  await assertPatientBelongsToFacility(patientId, session.user.role === "SUPER_ADMIN" ? undefined : session.user.facilityId);
  return session;
}

// ADMIN/SUPER_ADMIN, or an APPROVED RESEARCHER (re-checked live, never the cached session status).
export async function requireAnalyticsSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();

  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
    await assertSessionFresh(session);
    return session;
  }

  if (session.user.role === "RESEARCHER") {
    const profile = await prisma.researcherProfile.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    });
    if (!profile || profile.status !== "APPROVED") {
      throw researcherNotApprovedError();
    }
    return session;
  }

  throw wrongRoleError("Analytics access requires admin or approved researcher access.");
}

/**
 * A patient record is visible to an admin at that patient's own facility, any SUPER_ADMIN, or the patient themselves.
 * Throws NotFoundError for a different facility's patient, ForbiddenError for a patient session reaching someone else's record.
 */
export async function assertPatientRecordAccessible(patientId: string): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN") {
    await assertPatientBelongsToFacility(patientId, session.user.role === "SUPER_ADMIN" ? undefined : session.user.facilityId);
    return session;
  }
  if (session.user.role === "PATIENT" && session.user.patientId === patientId) return session;
  throw new ForbiddenError();
}
