import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/server/auth/credentialFlows";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { parseJson } from "@/server/http/parseJson";

const verifyEmailBodySchema = z.object({ token: z.string().min(1) });

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await parseJson(req, verifyEmailBodySchema);
  const result = await verifyEmail(body.token);
  return NextResponse.json({ ok: true, email: result.email });
});
