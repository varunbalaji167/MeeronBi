import { prisma } from "@/server/db/prisma";
import { getTabByKey } from "@/domain/tabs";
import { getCustomizableFields } from "@/domain/fieldVisibility";

/**
 * Backing store for "Customize fields" (see domain/fieldVisibility.ts for
 * the resolution rules this data feeds into). One row per tab in the
 * `tab_field_preferences` table; this service is the only thing that reads
 * or writes it. Resolving a stored selection into an actual visible-field
 * set (which also needs a specific record's data) happens client-side in
 * TabRecordView.tsx via domain/fieldVisibility.ts directly.
 */

export async function getStoredFieldSelection(tabKey: string): Promise<string[] | null> {
  const row = await prisma.tabFieldPreference.findUnique({ where: { tabKey } });
  if (!row) return null;
  return Array.isArray(row.enabledFieldNames) ? (row.enabledFieldNames as string[]) : null;
}

export async function saveFieldSelection(tabKey: string, enabledFieldNames: string[]): Promise<void> {
  const tab = getTabByKey(tabKey);
  if (!tab) throw new Error(`Unknown tab "${tabKey}"`);

  // Only ever persist names that actually exist on this tab — defends
  // against stale/typo'd names accumulating in storage over time.
  const validNames = new Set(getCustomizableFields(tab).map((f) => f.name));
  const cleaned = enabledFieldNames.filter((name) => validNames.has(name));

  await prisma.tabFieldPreference.upsert({
    where: { tabKey },
    create: { tabKey, enabledFieldNames: cleaned },
    update: { enabledFieldNames: cleaned },
  });
}
