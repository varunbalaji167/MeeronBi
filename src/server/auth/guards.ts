import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "@/server/db/prisma";
import { UnauthorizedError, ForbiddenError } from "@/server/http/errors";
import { sessionStaleError, wrongRoleError, researcherNotApprovedError } from "./errors";
import { patientNotFoundInFacilityError } from "@/server/patients/errors";

// Role matrix and tenant-boundary rules: docs/ARCHITECTURE.md § auth.

export async function getSession() {
  return getServerSession(authOptions);
}

// Re-checks `passwordChangedAt` so a password reset actually evicts sessions an attacker already holds (JWTs don't rotate).
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

/** Cross-facility access reports NotFoundError; a patient session reaching another patient reports ForbiddenError. */
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
