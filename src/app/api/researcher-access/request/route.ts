import { NextRequest, NextResponse } from "next/server";
import { requestResearcherAccess } from "@/server/researchers/researcherAccessService";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";

/**
 * Deliberately unauthenticated — this IS the "no account yet, please give
 * me one" entry point, the same way /login is reachable with no session.
 * Never returns anything beyond a bare confirmation; the request itself is
 * reviewed by a SUPER_ADMIN (see /api/admin/researchers), and the account
 * this creates can't sign in until then (see authOptions.ts).
 */
export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));

  const result = await requestResearcherAccess({
    name: String(body?.name ?? ""),
    email: String(body?.email ?? ""),
    password: String(body?.password ?? ""),
    institution: String(body?.institution ?? ""),
    purpose: String(body?.purpose ?? ""),
  });

  return NextResponse.json({ ok: true, email: result.email }, { status: 201 });
});
