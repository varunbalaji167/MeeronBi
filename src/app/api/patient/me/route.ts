import { NextResponse } from "next/server";
import { requirePatientSession } from "@/server/auth/guards";
import { getFullPatientRecord } from "@/server/patients/patientRepository";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { NotFoundError } from "@/server/http/errors";

export const GET = withApiErrorHandling(async () => {
  const session = await requirePatientSession();

  const patient = await getFullPatientRecord(session.user.patientId!, session.user.facilityId);
  if (!patient) throw new NotFoundError("No record found.");

  return NextResponse.json({ patient });
});
