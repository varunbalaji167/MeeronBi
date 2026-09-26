import { NextRequest, NextResponse } from "next/server";
import { getPublicTrends } from "@/server/trends/trendsRepository";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { withRateLimit } from "@/server/http/rateLimit";

// Public by design: returns aggregate counts only, never patient rows.
// Rate-limited against differencing attacks.
export const GET = withApiErrorHandling(
  withRateLimit({ key: "public.trends", limit: 30, windowMs: 60_000, detail: "RATE_LIMIT.PUBLIC_TRENDS" })(
    async (_req: NextRequest) => {
      const trends = await getPublicTrends();
      return NextResponse.json(trends);
    }
  )
);
