import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { ValidationError, ConflictError } from "@/server/http/errors";
import { writeAuditLog } from "@/server/http/audit";
import { enqueueEmail } from "@/server/email/outbox";
import { issueToken } from "@/server/auth/credentialTokens";
import { appUrl } from "@/config/env";
import { patientNotFoundInFacilityError } from "./errors";

const INVITE_EXPIRES_IN_DAYS = 7;

export type PatientPortalAccessMethod = { kind: "password"; password: string } | { kind: "invite" };

/** `password`: in-person handover, no email (addresses may be placeholders). `invite`: email an ACCOUNT_INVITE link, no password typed. */
export async function setPatientPortalAccess(
  patientId: string,
  rawEmail: string,
  method: PatientPortalAccessMethod,
  actorUserId?: string
): Promise<{ email: string }> {
  const email = rawEmail.toLowerCase().trim();
  if (!email) {
    throw new ValidationError("Email is required.", { email: "Required." });
  }
  if (method.kind === "password" && method.password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters.", { password: "Must be at least 6 characters." });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, userId: true, facilityId: true, fullName: true, facility: { select: { name: true } } },
  });
  if (!patient) throw patientNotFoundInFacilityError();

  const existingUserWithEmail = await prisma.user.findUnique({
    where: { email },
    include: { patient: { select: { id: true, fullName: true } } },
  });

  if (existingUserWithEmail && existingUserWithEmail.id !== patient.userId) {
    if (existingUserWithEmail.role !== "PATIENT") {
      throw new ConflictError("This email is already used by a staff account.", {
        email: "Already used by a staff account.",
      });
    }
    if (existingUserWithEmail.patient && existingUserWithEmail.patient.id !== patient.id) {
      const message = `This email is already the portal login for ${existingUserWithEmail.patient.fullName}.`;
      throw new ConflictError(message, { email: message });
    }
    throw new ConflictError("This email is already registered to another account.", {
      email: "Already registered to another account.",
    });
  }

  const passwordHash = method.kind === "password" ? await bcrypt.hash(method.password, 10) : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const user = patient.userId
        ? await tx.user.update({
            where: { id: patient.userId },
            data: { email, passwordHash, role: "PATIENT", emailVerifiedAt: method.kind === "invite" ? null : undefined },
          })
        : await tx.user.create({
            // The login's facilityId always matches the patient's own facility.
            data: {
              email,
              passwordHash,
              role: "PATIENT",
              facilityId: patient.facilityId,
              emailVerifiedAt: method.kind === "invite" ? null : undefined,
              patient: { connect: { id: patient.id } },
            },
          });

      await writeAuditLog(tx, {
        facilityId: patient.facilityId,
        actorUserId,
        action: "PORTAL_ACCESS_SET",
        entityType: "Patient",
        entityId: patient.id,
        after: { email: user.email },
      });

      if (method.kind === "invite") {
        const rawToken = await issueToken(tx, user.id, "ACCOUNT_INVITE");
        await enqueueEmail(tx, {
          toEmail: user.email,
          payload: {
            template: "patient-portal-invite",
            name: patient.fullName,
            facilityName: patient.facility.name,
            setPasswordUrl: `${appUrl}/set-password?token=${rawToken}`,
            expiresInDays: INVITE_EXPIRES_IN_DAYS,
          },
        });
      }

      return { email: user.email };
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new ConflictError("This email is already registered to another account.", {
        email: "Already registered to another account.",
      });
    }
    throw err;
  }
}
