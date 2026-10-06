import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { writeAuditLog } from "@/server/http/audit";
import { enqueueEmail } from "@/server/email/outbox";
import { issueToken } from "@/server/auth/credentialTokens";
import { appUrl } from "@/config/env";
import { validateFacilityProvisioningInput, type CreateFacilityWithAdminInput } from "./facilityProvisioning";

const INVITE_EXPIRES_IN_DAYS = 7;

// Super-admin-only: creates a facility + its first ADMIN user in one transaction, audit-logged.
// No pending/approved state (unlike the researcher flow) — only a super-admin can reach this.
export async function createFacilityWithAdmin(rawInput: CreateFacilityWithAdminInput, actorUserId: string) {
  const input = validateFacilityProvisioningInput(rawInput);

  return prisma.$transaction(async (tx) => {
    const facility = await tx.facility
      .create({
        data: { name: input.name, slug: input.slug, stateCode: input.stateCode },
      })
      .catch((err) => {
        if (err?.code === "P2002") {
          throw new ConflictError(`A facility with slug "${input.slug}" already exists.`, {
            slug: "Already in use by another facility.",
          });
        }
        throw err;
      });

    const admin = await tx.user
      .create({
        data: {
          email: input.adminEmail,
          passwordHash: null,
          emailVerifiedAt: null,
          name: input.adminName,
          role: "ADMIN",
          facilityId: facility.id,
        },
      })
      .catch((err) => {
        if (err?.code === "P2002") {
          throw new ConflictError("This email is already registered to another account.", {
            adminEmail: "Already registered to another account.",
          });
        }
        throw err;
      });

    await writeAuditLog(tx, {
      facilityId: facility.id,
      actorUserId,
      action: "CREATE",
      entityType: "Facility",
      entityId: facility.id,
      after: { name: facility.name, slug: facility.slug, adminEmail: admin.email },
    });

    const rawToken = await issueToken(tx, admin.id, "ACCOUNT_INVITE");
    await enqueueEmail(tx, {
      toEmail: admin.email,
      payload: {
        template: "facility-admin-invite",
        name: admin.name ?? admin.email,
        facilityName: facility.name,
        setPasswordUrl: `${appUrl}/set-password?token=${rawToken}`,
        expiresInDays: INVITE_EXPIRES_IN_DAYS,
      },
    });

    return { facility, adminEmail: admin.email };
  });
}

/** Invalidates the previous outstanding invite, so only the new link works. */
export async function resendFacilityAdminInvite(userId: string): Promise<{ email: string }> {
  const admin = await prisma.user.findUnique({
    where: { id: userId },
    include: { facility: { select: { name: true } } },
  });
  if (!admin || admin.role !== "ADMIN") throw new NotFoundError("Facility admin not found.");
  if (admin.passwordHash !== null) {
    throw new ValidationError("This admin has already set a password — there's no invite left to resend.");
  }

  return prisma.$transaction(async (tx) => {
    const rawToken = await issueToken(tx, admin.id, "ACCOUNT_INVITE");
    await enqueueEmail(tx, {
      toEmail: admin.email,
      payload: {
        template: "facility-admin-invite",
        name: admin.name ?? admin.email,
        facilityName: admin.facility.name,
        setPasswordUrl: `${appUrl}/set-password?token=${rawToken}`,
        expiresInDays: INVITE_EXPIRES_IN_DAYS,
      },
    });
    return { email: admin.email };
  });
}
