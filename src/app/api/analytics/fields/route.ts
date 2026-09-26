import { NextResponse } from "next/server";
import { requireAnalyticsSession } from "@/server/auth/guards";
import { getAnalyticsFieldRegistry } from "@/domain/analytics/fieldRegistry";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";

export const GET = withApiErrorHandling(async () => {
  await requireAnalyticsSession();

  return NextResponse.json({ fields: getAnalyticsFieldRegistry() });
});
