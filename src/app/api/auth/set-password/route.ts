import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { setPassword } from "@/server/auth/credentialFlows";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { parseJson } from "@/server/http/parseJson";

const setPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string(),
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await parseJson(req, setPasswordBodySchema);
  const result = await setPassword(body.token, body.password);
  return NextResponse.json({ ok: true, email: result.email });
});
