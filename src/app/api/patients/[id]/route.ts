import { NextRequest, NextResponse } from "next/server";
import { assertPatientRecordAccessible, requireAdminSessionForPatient } from "@/server/auth/guards";
import { getPatientById, deletePatient } from "@/server/patients/patientRepository";
import { setPatientPortalAccess } from "@/server/patients/portalAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { NotFoundError } from "@/server/http/errors";

export const GET = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await assertPatientRecordAccessible(params.id);

  const patient = await getPatientById(params.id, session.user.facilityId);
  if (!patient) throw new NotFoundError("Patient not found.");

  return NextResponse.json({ patient });
});

export const DELETE = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireAdminSessionForPatient(params.id);

  await deletePatient(params.id);
  return NextResponse.json({ ok: true });
});

/** Create/replace this patient's portal login. Body: { email, password }. */
export const POST = withApiErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireAdminSessionForPatient(params.id);

  const body = await req.json().catch(() => ({}));
  const result = await setPatientPortalAccess(params.id, String(body?.email ?? ""), String(body?.password ?? ""));

  return NextResponse.json({ ok: true, email: result.email });
});
