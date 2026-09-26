import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requestResearcherAccess } from "@/server/researchers/researcherAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { withRateLimit } from "@/server/http/rateLimit";
import { parseJson } from "@/server/http/parseJson";

// Shape-only check — requestResearcherAccess still owns the business rules
// (password length, purpose length, etc.) per its own field-level errors.
const researcherAccessBodySchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  institution: z.string(),
  purpose: z.string(),
});

// Public by design: account signup entry point, pending SUPER_ADMIN approval.
// Rate-limited per IP.
export const POST = withApiErrorHandling(
  withRateLimit({ key: "researcher-access.request", limit: 3, windowMs: 60 * 60_000, detail: "RATE_LIMIT.RESEARCHER_ACCESS_REQUEST" })(
    async (req: NextRequest) => {
      const body = await parseJson(req, researcherAccessBodySchema);
      const result = await requestResearcherAccess(body);
      return NextResponse.json({ ok: true, email: result.email }, { status: 201 });
    }
  )
);
