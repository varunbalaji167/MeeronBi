import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/server/auth/guards";
import { resendFacilityAdminInvite } from "@/server/facilities/facilityProvisioningService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";

// Super-admin-only: re-sends a facility admin's set-password invite — for a bounced or expired link.
export const POST = withApiErrorHandling(async (_req, { params }: { params: { userId: string } }) => {
  await requireSuperAdminSession();

  const result = await resendFacilityAdminInvite(params.userId);
  return NextResponse.json({ ok: true, email: result.email });
});
