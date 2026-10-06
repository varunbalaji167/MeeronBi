import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getHqFacility } from "@/server/facilities/facilityRepository";
import { NotFoundError, ValidationError, ConflictError } from "@/server/http/errors";
import { writeAuditLog } from "@/server/http/audit";
import { enqueueEmail } from "@/server/email/outbox";
import { issueToken } from "@/server/auth/credentialTokens";
import { appUrl } from "@/config/env";
import { GOOGLE_OAUTH_PROVIDER } from "@/domain/auth/googleSignIn";

export interface RequestResearcherAccessInput {
  name: string;
  email: string;
  password: string;
  institution: string;
  purpose: string;
}

function assertPurposeLongEnough(purpose: string): void {
  if (purpose.length < 20) {
    throw new ValidationError(
      "Please describe your research purpose in a bit more detail (at least 20 characters) — this is what the reviewer sees.",
      { purpose: "Please add more detail." }
    );
  }
}

/** Shared core for both the credentials and Google researcher-signup paths: creates the RESEARCHER
 * User (anchored to the HQ facility) plus its PENDING ResearcherProfile. */
async function createResearcherRequest(
  tx: Prisma.TransactionClient,
  hqFacilityId: string,
  input: { name: string; email: string; institution: string; purpose: string; passwordHash: string | null; emailVerifiedAt: Date | null }
) {
  return tx.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      role: "RESEARCHER",
      facilityId: hqFacilityId,
      emailVerifiedAt: input.emailVerifiedAt,
      researcherProfile: {
        create: {
          institution: input.institution.slice(0, 200),
          purpose: input.purpose.slice(0, 2000),
          status: "PENDING",
        },
      },
    },
  });
}

function conflictOnDuplicateEmail(err: unknown): never {
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
    throw new ConflictError("This email is already registered to an account.", {
      email: "Already registered to another account.",
    });
  }
  throw err;
}

/** Public "Request researcher access" entry point: creates a RESEARCHER User with a PENDING profile. Sign-in stays blocked until approved. */
export async function requestResearcherAccess(input: RequestResearcherAccessInput): Promise<{ email: string }> {
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  const institution = input.institution.trim();
  const purpose = input.purpose.trim();

  if (!name || !email || !input.password || !institution || !purpose) {
    throw new ValidationError("All fields are required.");
  }
  if (input.password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters.", { password: "Must be at least 6 characters." });
  }
  assertPurposeLongEnough(purpose);

  const hq = await getHqFacility();
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await createResearcherRequest(tx, hq.id, {
        name,
        email,
        institution,
        purpose,
        passwordHash,
        emailVerifiedAt: null,
      });
      const rawToken = await issueToken(tx, user.id, "EMAIL_VERIFICATION");
      await enqueueEmail(tx, {
        toEmail: user.email,
        payload: {
          template: "researcher-verify-email",
          name: user.name ?? user.email,
          verifyUrl: `${appUrl}/verify-email?token=${rawToken}`,
        },
      });
      return { email: user.email };
    });
  } catch (err) {
    conflictOnDuplicateEmail(err);
  }
}

export interface CreateResearcherRequestFromGoogleInput {
  name: string;
  email: string;
  institution: string;
  purpose: string;
  googleSub: string;
}

/** Google-signup equivalent of `requestResearcherAccess` — Google already proved the email, so the
 * account is created pre-verified with no password, and super admins are notified immediately. */
export async function createResearcherRequestFromGoogle(
  input: CreateResearcherRequestFromGoogleInput
): Promise<{ userId: string; email: string }> {
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  const institution = input.institution.trim();
  const purpose = input.purpose.trim();

  if (!name || !email || !institution || !purpose) {
    throw new ValidationError("All fields are required.");
  }
  assertPurposeLongEnough(purpose);

  const hq = await getHqFacility();

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await createResearcherRequest(tx, hq.id, {
        name,
        email,
        institution,
        purpose,
        passwordHash: null,
        emailVerifiedAt: new Date(),
      });
      await tx.oAuthAccount.create({
        data: { provider: GOOGLE_OAUTH_PROVIDER, providerAccountId: input.googleSub, userId: user.id },
      });
      await notifySuperAdminsOfResearcherRequest(tx, user.id);
      return { userId: user.id, email: user.email };
    });
  } catch (err) {
    conflictOnDuplicateEmail(err);
  }
}

/** Fires only after email verification, never at signup, so junk/typo'd addresses never reach the review queue. */
export async function notifySuperAdminsOfResearcherRequest(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true, researcherProfile: { select: { institution: true, purpose: true } } },
  });
  if (!user || user.role !== "RESEARCHER" || !user.researcherProfile) return;

  const admins = await tx.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true, email: true } });
  for (const admin of admins) {
    await enqueueEmail(tx, {
      toEmail: admin.email,
      payload: {
        template: "researcher-request-submitted",
        researcherName: user.name ?? user.email,
        researcherEmail: user.email,
        institution: user.researcherProfile.institution,
        purpose: user.researcherProfile.purpose,
        reviewUrl: `${appUrl}/admin/researchers`,
      },
      idempotencyKey: `researcher-submitted:${userId}:${admin.id}`,
    });
  }
}

export async function listResearcherRequests(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return prisma.researcherProfile.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true, emailVerifiedAt: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/** Throws NotFoundError for an unknown userId, or ConflictError if already reviewed. */
async function getReviewablePendingRequest(userId: string) {
  const profile = await prisma.researcherProfile.findUnique({
    where: { userId },
    include: { user: { select: { facilityId: true, email: true, name: true, emailVerifiedAt: true } } },
  });
  if (!profile) throw new NotFoundError("Researcher request not found.");
  if (profile.status !== "PENDING") {
    throw new ConflictError(`This request was already ${profile.status.toLowerCase()}.`);
  }
  return profile;
}

export async function approveResearcher(userId: string, reviewedById: string) {
  const { user, ...before } = await getReviewablePendingRequest(userId);
  if (!user.emailVerifiedAt) {
    throw new ValidationError(
      "This researcher hasn't verified their email address yet, so their request can't be approved."
    );
  }
  return prisma.$transaction(async (tx) => {
    const after = await tx.researcherProfile.update({
      where: { userId },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById },
    });
    await writeAuditLog(tx, {
      facilityId: user.facilityId,
      actorUserId: reviewedById,
      action: "APPROVE",
      entityType: "ResearcherProfile",
      entityId: userId,
      before,
      after,
    });
    await enqueueEmail(tx, {
      toEmail: user.email,
      payload: {
        template: "researcher-approved",
        name: user.name ?? user.email,
        signInUrl: `${appUrl}/login?role=researcher`,
      },
      idempotencyKey: `researcher-approved:${userId}`,
    });
    return after;
  });
}

export async function rejectResearcher(userId: string, reviewedById: string, reviewNote?: string) {
  const { user, ...before } = await getReviewablePendingRequest(userId);
  const trimmedNote = reviewNote?.trim().slice(0, 1000) || null;
  return prisma.$transaction(async (tx) => {
    const after = await tx.researcherProfile.update({
      where: { userId },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedById, reviewNote: trimmedNote },
    });
    await writeAuditLog(tx, {
      facilityId: user.facilityId,
      actorUserId: reviewedById,
      action: "REJECT",
      entityType: "ResearcherProfile",
      entityId: userId,
      before,
      after,
    });
    await enqueueEmail(tx, {
      toEmail: user.email,
      payload: {
        template: "researcher-rejected",
        name: user.name ?? user.email,
        reviewNote: trimmedNote ?? undefined,
      },
      idempotencyKey: `researcher-rejected:${userId}`,
    });
    return after;
  });
}
