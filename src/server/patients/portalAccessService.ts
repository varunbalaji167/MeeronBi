import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError, ConflictError } from "@/server/http/errors";

/**
 * Creates or replaces a patient's portal login. A patient has at most one login: if they already have one, updates it in place;
 * refuses if the requested email already belongs to someone else.
 */
export async function setPatientPortalAccess(
  patientId: string,
  rawEmail: string,
  password: string
): Promise<{ email: string }> {
  const email = rawEmail.toLowerCase().trim();
  if (!email || !password) {
    throw new ValidationError("Email and password are required.");
  }
  if (password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters.", { password: "Must be at least 6 characters." });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, userId: true, facilityId: true },
  });
  if (!patient) throw new NotFoundError("Patient not found.");

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

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = patient.userId
      ? await prisma.user.update({
          where: { id: patient.userId },
          data: { email, passwordHash, role: "PATIENT" },
        })
      : await prisma.user.create({
          // The login's facilityId always matches the patient's own facility.
          data: { email, passwordHash, role: "PATIENT", facilityId: patient.facilityId, patient: { connect: { id: patient.id } } },
        });

    return { email: user.email };
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new ConflictError("This email is already registered to another account.", {
        email: "Already registered to another account.",
      });
    }
    throw err;
  }
}
