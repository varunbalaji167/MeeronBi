import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/guards";
import { getStoredFieldSelection, saveFieldSelection } from "@/server/patients/fieldPreferenceService";
import { getTabByKey } from "@/domain/tabs";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { NotFoundError } from "@/server/http/errors";

// Admin-only: facility-wide field selection preference for a tab.
export const GET = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { tabKey: string } }) => {
  const session = await requireAdminSession();
  if (!getTabByKey(params.tabKey)) throw new NotFoundError("Unknown tab.");

  const enabledFieldNames = await getStoredFieldSelection(session.user.facilityId, params.tabKey);
  return NextResponse.json({ enabledFieldNames });
});

export const PUT = withApiErrorHandling(async (req: NextRequest, { params }: { params: { tabKey: string } }) => {
  const session = await requireAdminSession();
  if (!getTabByKey(params.tabKey)) throw new NotFoundError("Unknown tab.");

  const body = await req.json().catch(() => ({}));
  const enabledFieldNames = Array.isArray(body?.enabledFieldNames) ? body.enabledFieldNames : [];
  await saveFieldSelection(session.user.facilityId, params.tabKey, enabledFieldNames);
  return NextResponse.json({ ok: true });
});
