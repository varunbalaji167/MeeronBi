import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/guards";
import { getStoredFieldSelection, saveFieldSelection } from "@/server/patients/fieldPreferenceService";
import { getTabByKey } from "@/domain/tabs";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";
import { NotFoundError } from "@/server/http/errors";
import { parseJson } from "@/server/http/parseJson";

const fieldSelectionBodySchema = z.object({
  enabledFieldNames: z.array(z.string()),
});

// Admin-only: facility-wide field selection preference for a tab.
// TODO: for SUPER_ADMIN this reads/writes HQ's own field prefs, not a chosen facility's — out of scope for now.
export const GET = withApiErrorHandling(async (_req: NextRequest, { params }: { params: { tabKey: string } }) => {
  const session = await requireAdminSession();
  if (!getTabByKey(params.tabKey)) throw new NotFoundError("Unknown tab.");

  const enabledFieldNames = await getStoredFieldSelection(session.user.facilityId, params.tabKey);
  return NextResponse.json({ enabledFieldNames });
});

export const PUT = withApiErrorHandling(async (req: NextRequest, { params }: { params: { tabKey: string } }) => {
  const session = await requireAdminSession();
  if (!getTabByKey(params.tabKey)) throw new NotFoundError("Unknown tab.");

  const body = await parseJson(req, fieldSelectionBodySchema);
  await saveFieldSelection(session.user.facilityId, params.tabKey, body.enabledFieldNames, session.user.id);
  return NextResponse.json({ ok: true });
});
