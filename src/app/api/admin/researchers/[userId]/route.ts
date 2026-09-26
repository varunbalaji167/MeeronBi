import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/server/auth/guards";
import { approveResearcher, rejectResearcher } from "@/server/researchers/researcherAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { parseJson } from "@/server/http/parseJson";

const reviewBodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().optional(),
});

export const PATCH = withApiErrorHandling(async (req: NextRequest, { params }: { params: { userId: string } }) => {
  const session = await requireSuperAdminSession();

  const body = await parseJson(req, reviewBodySchema);
  if (body.action === "approve") {
    const profile = await approveResearcher(params.userId, session.user.id);
    return NextResponse.json({ profile });
  }
  const profile = await rejectResearcher(params.userId, session.user.id, body.reviewNote);
  return NextResponse.json({ profile });
});
