import { createHash } from "crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { resendVerificationEmail } from "@/server/auth/credentialFlows";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { consumeToken as consumeRateLimitToken, getClientIp } from "@/server/http/rateLimit";
import { RateLimitError } from "@/server/http/errors";
import { parseJson } from "@/server/http/parseJson";

const RATE_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

const requestBodySchema = z.object({ email: z.string() });

// Public (unverified users have no session); always 200, no-enumeration — same rule as password-reset/request.
export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await parseJson(req, requestBodySchema);
  const email = body.email.toLowerCase().trim();

  const ip = getClientIp(req);
  const emailKey = createHash("sha256").update(email).digest("hex");
  const ipAllowed = consumeRateLimitToken(`verify-email-resend.ip:${ip}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  const emailAllowed = consumeRateLimitToken(`verify-email-resend.email:${emailKey}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!ipAllowed || !emailAllowed) {
    throw new RateLimitError(undefined, "RATE_LIMIT.VERIFY_EMAIL_RESEND");
  }

  await resendVerificationEmail(email);
  return NextResponse.json({ ok: true });
});
