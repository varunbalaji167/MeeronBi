import { createHash } from "crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/server/auth/credentialFlows";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { consumeToken as consumeRateLimitToken, getClientIp } from "@/server/http/rateLimit";
import { RateLimitError } from "@/server/http/errors";
import { parseJson } from "@/server/http/parseJson";

const RATE_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

const requestBodySchema = z.object({ email: z.string() });

// Public (locked-out users have no session); always 200 with identical body — anything else is an enumeration oracle.
export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await parseJson(req, requestBodySchema);
  const email = body.email.toLowerCase().trim();

  const ip = getClientIp(req);
  const emailKey = createHash("sha256").update(email).digest("hex");
  const ipAllowed = consumeRateLimitToken(`pwreset.ip:${ip}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  const emailAllowed = consumeRateLimitToken(`pwreset.email:${emailKey}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!ipAllowed || !emailAllowed) {
    throw new RateLimitError(undefined, "RATE_LIMIT.PASSWORD_RESET_REQUEST");
  }

  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
});
