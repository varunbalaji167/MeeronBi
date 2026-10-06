import { requireAdminSession } from "@/server/auth/guards";
import { getTabByKey } from "@/domain/tabs";
import { isCustomizable } from "@/domain/fieldVisibility";
import { getTabRecord } from "./tabRecordRepository";
import { getStoredFieldSelection } from "./fieldPreferenceService";

/** Caller must sit under `[id]/layout.tsx`, which has already proven patient access. */
export async function loadAdminTabPageData(tabKey: string, patientId: string) {
  const tab = getTabByKey(tabKey);
  const session = await requireAdminSession();

  const [record, fieldSelection, personal] = await Promise.all([
    getTabRecord(tabKey, patientId),
    tab && isCustomizable(tab) ? getStoredFieldSelection(session.user.facilityId, tabKey) : undefined,
    tabKey === "ultrasound" ? getTabRecord("personal", patientId) : undefined,
  ]);

  return {
    initialRecord: record ? { data: record.data, status: record.status } : undefined,
    initialFieldSelection: fieldSelection,
    initialPersonalLmp: personal ? ((personal.data.lmp as string | undefined) ?? null) : undefined,
  };
}
