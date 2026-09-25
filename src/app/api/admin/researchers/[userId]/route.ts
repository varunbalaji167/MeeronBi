import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/server/auth/guards";
import { approveResearcher, rejectResearcher } from "@/server/researchers/researcherAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { ValidationError } from "@/server/http/errors";

/** Body: { action: "approve" | "reject", reviewNote?: string } */
export const PATCH = withApiErrorHandling(async (req: NextRequest, { params }: { params: { userId: string } }) => {
  const session = await requireSuperAdminSession();

  const body = await req.json().catch(() => ({}));
  if (body?.action === "approve") {
    const profile = await approveResearcher(params.userId, session.user.id);
    return NextResponse.json({ profile });
  }
  if (body?.action === "reject") {
    const profile = await rejectResearcher(params.userId, session.user.id, body?.reviewNote);
    return NextResponse.json({ profile });
  }
  throw new ValidationError('"action" must be "approve" or "reject".');
});
