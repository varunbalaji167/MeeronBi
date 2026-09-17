import { NextResponse } from "next/server";
import { getPublicTrends } from "@/server/trends/trendsRepository";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";

// Deliberately unauthenticated — see trendsRepository.ts for the "aggregate
// counts only, never patient rows" invariant that makes this safe.
export const GET = withApiErrorHandling(async () => {
  const trends = await getPublicTrends();
  return NextResponse.json(trends);
});
