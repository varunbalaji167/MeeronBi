import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { assertPatientRecordAccessible, requireAdminSessionForPatient } from "@/server/auth/guards";
import { getPatientById, deletePatient } from "@/server/patients/patientRepository";
import { setPatientPortalAccess } from "@/server/patients/portalAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { patientNotFoundInFacilityError } from "@/server/patients/errors";
import { parseJson } from "@/server/http/parseJson";

const portalAccessBodySchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const GET = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await assertPatientRecordAccessible(params.id);

  // SUPER_ADMIN isn't facility-scoped; access was already verified above.
  const patient = await getPatientById(
    params.id,
    session.user.role === "SUPER_ADMIN" ? undefined : session.user.facilityId
  );
  if (!patient) throw patientNotFoundInFacilityError();

  return NextResponse.json({ patient });
});

export const DELETE = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAdminSessionForPatient(params.id);

  await deletePatient(params.id, session.user.id);
  return NextResponse.json({ ok: true });
});

/** Create/replace this patient's portal login. Body: { email, password }. */
export const POST = withApiErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireAdminSessionForPatient(params.id);

  const body = await parseJson(req, portalAccessBodySchema);
  const result = await setPatientPortalAccess(params.id, body.email, body.password, session.user.id);

  return NextResponse.json({ ok: true, email: result.email });
});
