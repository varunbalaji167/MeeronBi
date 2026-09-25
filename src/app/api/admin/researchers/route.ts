import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/server/auth/guards";
import { listResearcherRequests } from "@/server/researchers/researcherAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";

export const GET = withApiErrorHandling(async (req: NextRequest) => {
  await requireSuperAdminSession();

  const status = req.nextUrl.searchParams.get("status");
  const requests = await listResearcherRequests(
    status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? status : undefined
  );

  return NextResponse.json({ requests });
});
