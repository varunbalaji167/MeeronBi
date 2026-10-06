import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyResearcherSignupToken, GOOGLE_RESEARCHER_SIGNUP_COOKIE } from "@/server/auth/googleResearcherSignupToken";
import { createResearcherRequestFromGoogle } from "@/server/researchers/researcherAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { withRateLimit } from "@/server/http/rateLimit";
import { parseJson } from "@/server/http/parseJson";
import { ValidationError } from "@/server/http/errors";

const bodySchema = z.object({
  name: z.string(),
  institution: z.string(),
  purpose: z.string(),
});

// Public by design: the account doesn't exist until this call creates it. Identity is proven by the
// httpOnly cookie set in google-start, never by anything the client sends directly.
export const POST = withApiErrorHandling(
  withRateLimit({ key: "researcher-access.google-complete", limit: 5, windowMs: 60 * 60_000, detail: "RATE_LIMIT.RESEARCHER_ACCESS_GOOGLE_COMPLETE" })(
    async (req: NextRequest) => {
      const body = await parseJson(req, bodySchema);

      const token = cookies().get(GOOGLE_RESEARCHER_SIGNUP_COOKIE)?.value;
      if (!token) {
        throw new ValidationError("This Google sign-up link has expired. Please start again.");
      }
      const claims = await verifyResearcherSignupToken(token);

      const result = await createResearcherRequestFromGoogle({
        name: body.name,
        email: claims.email,
        institution: body.institution,
        purpose: body.purpose,
        googleSub: claims.sub,
      });

      cookies().set(GOOGLE_RESEARCHER_SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });

      return NextResponse.json({ ok: true, email: result.email }, { status: 201 });
    }
  )
);
