import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/server/auth/guards";
import { listFacilities } from "@/server/facilities/facilityRepository";
import { createFacilityWithAdmin } from "@/server/facilities/facilityProvisioningService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { parseJson } from "@/server/http/parseJson";

// Super-admin-only: lists real facilities for the cross-facility filter dropdown.
export const GET = withApiErrorHandling(async () => {
  await requireSuperAdminSession();

  const facilities = await listFacilities();
  return NextResponse.json({ facilities });
});

const createFacilityBodySchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  stateCode: z.string().optional(),
  adminName: z.string().optional(),
  adminEmail: z.string(),
});

// Super-admin-only: creates a new facility and hands it its first ADMIN login, in one step.
export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const session = await requireSuperAdminSession();

  const body = await parseJson(req, createFacilityBodySchema);
  const { facility, adminEmail } = await createFacilityWithAdmin(body, session.user.id);

  return NextResponse.json({ facility, adminEmail }, { status: 201 });
});
