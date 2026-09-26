import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { ConflictError } from "@/server/http/errors";
import { writeAuditLog } from "@/server/http/audit";
import { validateFacilityProvisioningInput, type CreateFacilityWithAdminInput } from "./facilityProvisioning";

// Super-admin-only: creates a facility + its first ADMIN user in one transaction, audit-logged.
// No pending/approved state (unlike the researcher flow) — only a super-admin can reach this.
export async function createFacilityWithAdmin(rawInput: CreateFacilityWithAdminInput, actorUserId: string) {
  const input = validateFacilityProvisioningInput(rawInput);
  const passwordHash = await bcrypt.hash(input.adminPassword, 10);

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
          passwordHash,
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

    return { facility, adminEmail: admin.email };
  });
}
