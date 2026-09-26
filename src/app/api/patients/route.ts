import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/guards";
import { listPatients, createPatient } from "@/server/patients/patientRepository";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { ValidationError } from "@/server/http/errors";
import { parseJson } from "@/server/http/parseJson";

const createPatientBodySchema = z.object({
  fullName: z.string(),
});

export const GET = withApiErrorHandling(async (req: NextRequest) => {
  const session = await requireAdminSession();

  const result = await listPatients({
    facilityId: session.user.facilityId,
    query: req.nextUrl.searchParams.get("q") ?? undefined,
    page: Number(req.nextUrl.searchParams.get("page")) || undefined,
    pageSize: Number(req.nextUrl.searchParams.get("pageSize")) || undefined,
  });

  return NextResponse.json(result);
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const session = await requireAdminSession();

  const body = await parseJson(req, createPatientBodySchema);
  const fullName = body.fullName.trim();
  if (!fullName) throw new ValidationError("Full name is required.", { fullName: "Full name is required." });

  const patient = await createPatient({
    fullName,
    createdById: session.user.id,
    facilityId: session.user.facilityId,
  });

  return NextResponse.json({ patient }, { status: 201 });
});
