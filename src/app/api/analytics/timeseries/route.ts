import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsSession } from "@/server/auth/guards";
import { runTimeSeriesAnalytics } from "@/server/analytics/analyticsService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { parseJson } from "@/server/http/parseJson";

const fieldRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stored"), tabKey: z.string(), fieldName: z.string() }),
  z.object({ kind: z.literal("multiselectOption"), tabKey: z.string(), fieldName: z.string(), option: z.string() }),
  z.object({ kind: z.literal("derived"), id: z.enum(["age", "bmi"]) }),
]);

const timeSeriesQuerySchema = z
  .object({
    field: fieldRefSchema,
    patientId: z.string().optional(),
    filter: fieldRefSchema.optional(),
  })
  .refine((query) => !(query.patientId && query.filter), {
    message: "A time-series query can be single-patient or cohort, not both — provide patientId or filter, not both.",
    path: ["filter"],
  });

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const session = await requireAnalyticsSession();

  const query = await parseJson(req, timeSeriesQuerySchema);
  const result = await runTimeSeriesAnalytics(query, session);
  if (!result.ok) throw result.error;

  return NextResponse.json(result.value);
});
