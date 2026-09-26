import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsSession } from "@/server/auth/guards";
import { runCohortAnalytics } from "@/server/analytics/analyticsService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { parseJson } from "@/server/http/parseJson";

const fieldRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stored"), tabKey: z.string(), fieldName: z.string() }),
  z.object({ kind: z.literal("multiselectOption"), tabKey: z.string(), fieldName: z.string(), option: z.string() }),
  z.object({ kind: z.literal("derived"), id: z.enum(["age", "bmi"]) }),
]);

const analyticsQuerySchema = z.object({
  field: fieldRefSchema,
  filter: fieldRefSchema.optional(),
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const session = await requireAnalyticsSession();

  const query = await parseJson(req, analyticsQuerySchema);
  const result = await runCohortAnalytics(query, session);
  if (!result.ok) throw result.error;

  return NextResponse.json(result.value);
});
