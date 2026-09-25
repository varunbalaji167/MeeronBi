import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { getHqFacility } from "@/server/facilities/facilityRepository";
import { NotFoundError, ValidationError, ConflictError } from "@/server/http/errors";

export interface RequestResearcherAccessInput {
  name: string;
  email: string;
  password: string;
  institution: string;
  purpose: string;
}

/**
 * Public entry point for "Request researcher access" (no session — anyone
 * can submit a request, same as anyone can view a login page). Creates the
 * User row immediately, role RESEARCHER, with a PENDING ResearcherProfile —
 * see that model's comment in schema.prisma for why the account exists
 * before approval rather than only being created afterward. Sign-in itself
 * stays blocked until a SUPER_ADMIN approves (see authOptions.ts's
 * authorize()); this function only ever produces a pending request, never
 * an active session.
 */
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
  if (purpose.length < 20) {
    throw new ValidationError(
      "Please describe your research purpose in a bit more detail (at least 20 characters) — this is what the reviewer sees.",
      { purpose: "Please add more detail." }
    );
  }

  const hq = await getHqFacility();
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "RESEARCHER",
        facilityId: hq.id,
        researcherProfile: {
          create: {
            institution: institution.slice(0, 200),
            purpose: purpose.slice(0, 2000),
            status: "PENDING",
          },
        },
      },
    });
    return { email: user.email };
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new ConflictError("This email is already registered to an account.", {
        email: "Already registered to another account.",
      });
    }
    throw err;
  }
}

export async function listResearcherRequests(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return prisma.researcherProfile.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/** Throws NotFoundError for an unknown userId, or ConflictError if this request was already reviewed — reviewing twice (e.g. two admins clicking Approve at once) should be a clear conflict, not a silent overwrite. */
async function getReviewablePendingRequest(userId: string) {
  const profile = await prisma.researcherProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Researcher request not found.");
  if (profile.status !== "PENDING") {
    throw new ConflictError(`This request was already ${profile.status.toLowerCase()}.`);
  }
  return profile;
}

export async function approveResearcher(userId: string, reviewedById: string) {
  await getReviewablePendingRequest(userId);
  return prisma.researcherProfile.update({
    where: { userId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById },
  });
}

export async function rejectResearcher(userId: string, reviewedById: string, reviewNote?: string) {
  await getReviewablePendingRequest(userId);
  return prisma.researcherProfile.update({
    where: { userId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById, reviewNote: reviewNote?.trim().slice(0, 1000) || null },
  });
}
