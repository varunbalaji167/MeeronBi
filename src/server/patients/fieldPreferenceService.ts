import { prisma } from "@/server/db/prisma";
import { getTabByKey } from "@/domain/tabs";
import { getCustomizableFields } from "@/domain/fieldVisibility";
import { writeAuditLog } from "@/server/http/audit";

/** Backing store for "Customize fields": one row per (facility, tab) in `tab_field_preferences`. */

export async function getStoredFieldSelection(facilityId: string, tabKey: string): Promise<string[] | null> {
  const row = await prisma.tabFieldPreference.findUnique({ where: { facilityId_tabKey: { facilityId, tabKey } } });
  if (!row) return null;
  return Array.isArray(row.enabledFieldNames) ? (row.enabledFieldNames as string[]) : null;
}

export async function saveFieldSelection(
  facilityId: string,
  tabKey: string,
  enabledFieldNames: string[],
  actorUserId?: string
): Promise<void> {
  const tab = getTabByKey(tabKey);
  if (!tab) throw new Error(`Unknown tab "${tabKey}"`);

  // Only persist names that actually exist on this tab.
  const validNames = new Set(getCustomizableFields(tab).map((f) => f.name));
  const cleaned = enabledFieldNames.filter((name) => validNames.has(name));

  await prisma.$transaction(async (tx) => {
    const before = await tx.tabFieldPreference.findUnique({ where: { facilityId_tabKey: { facilityId, tabKey } } });
    const after = await tx.tabFieldPreference.upsert({
      where: { facilityId_tabKey: { facilityId, tabKey } },
      create: { facilityId, tabKey, enabledFieldNames: cleaned },
      update: { enabledFieldNames: cleaned },
    });
    await writeAuditLog(tx, {
      facilityId,
      actorUserId,
      action: before ? "UPDATE" : "CREATE",
      entityType: "TabFieldPreference",
      entityId: tabKey,
      before,
      after,
    });
  });
}
