import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { log } from "@/server/http/logger";

// Public, unauthenticated by design: a load balancer / uptime monitor has no session to send, and
// this endpoint reports only DB connectivity — no patient/user/facility data, nothing to leak.

// Declared, not inferred: a prerendered health check would freeze its answer at build time and
// report "ok" against a dead database, which would also blind the deploy's rollback gate.
export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  const version = process.env.npm_package_version;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", checks: { db: "ok" }, version, timestamp });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, "Health check: database unreachable");
    return NextResponse.json({ status: "down", checks: { db: "down" }, version, timestamp }, { status: 503 });
  }
}
