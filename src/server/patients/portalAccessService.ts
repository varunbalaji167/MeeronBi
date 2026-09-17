import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError, ConflictError } from "@/server/http/errors";

/**
 * Creates or replaces a patient's portal login. Business rule: a patient
 * has AT MOST ONE login, ever. If they already have one, this updates that
 * same User row in place (email + password) instead of creating a second
 * account — and refuses outright if the requested email already belongs to
 * someone else (another patient, or a staff account), rather than silently
 * reassigning it. See docs/ARCHITECTURE.md's "Patient portal login" section
 * for the incident this was written to prevent.
 *
 * Throws (rather than returning a result union) so the route handler can
 * stay a plain `await` with no branching — see server/http/errors.ts.
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
    select: { id: true, userId: true },
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
          data: { email, passwordHash, role: "PATIENT", patient: { connect: { id: patient.id } } },
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
