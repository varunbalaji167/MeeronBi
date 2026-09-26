import { prisma } from "@/server/db/prisma";
import { computeRobsonGroup, getTabByKey } from "@/domain/tabs";
import { sanitizeTabData } from "@/domain/validation";

export type TabRecordStatus = "DRAFT" | "COMPLETE";

/** Maps a tab's string key to its Prisma model delegate; the one place to update if a tab's table is renamed. */
const TAB_MODEL_MAP: Record<string, keyof typeof prisma> = {
  personal: "personalInfo",
  history: "obstetricHistory",
  investigation: "investigation",
  ultrasound: "ultrasound",
  delivery: "delivery",
  robson: "robsonClassification",
  treatments: "treatment",
};

export function isKnownTabKey(tabKey: string): boolean {
  return tabKey in TAB_MODEL_MAP;
}

function getDelegate(tabKey: string) {
  const modelKey = TAB_MODEL_MAP[tabKey];
  if (!modelKey) return null;

  const client = prisma as unknown as Record<string, {
    findUnique: (args: unknown) => Promise<any>;
    upsert: (args: unknown) => Promise<any>;
    deleteMany: (args: unknown) => Promise<any>;
  }>;

  return client[modelKey as string] ?? null;
}

/** Promotes a few fields from the JSON blob into typed columns so public trends can run cheap SQL aggregations. */
function deriveExtraColumns(tabKey: string, data: Record<string, any>) {
  if (tabKey === "delivery") {
    return {
      admissionType: data.admissionType ?? null,
      deliveryMode: data.deliveryMode ?? null,
      babyWeightKg: typeof data.babyWeightKg === "number" ? data.babyWeightKg : null,
    };
  }
  if (tabKey === "robson") {
    return { groupNumber: computeRobsonGroup(data) };
  }
  return {};
}

export interface TabRecordResult {
  data: Record<string, any>;
  status: TabRecordStatus;
  updatedAt: Date | null;
}

export async function getTabRecord(tabKey: string, patientId: string): Promise<TabRecordResult | null> {
  const delegate = getDelegate(tabKey);
  if (!delegate) return null;

  const record = await delegate.findUnique({ where: { patientId } });
  return {
    data: record?.data ?? {},
    status: record?.status ?? "DRAFT",
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function saveTabRecord(
  tabKey: string,
  patientId: string,
  data: Record<string, any>,
  status: TabRecordStatus
): Promise<TabRecordResult> {
  const delegate = getDelegate(tabKey);
  if (!delegate) throw new Error(`Unknown tab "${tabKey}"`);

  // Defense in depth: always normalize server-side, never trust client-side sanitization alone.
  const tab = getTabByKey(tabKey);
  const cleanData = tab ? sanitizeTabData(tab, data) : data;

  const extra = deriveExtraColumns(tabKey, cleanData);
  const record = await delegate.upsert({
    where: { patientId },
    create: { patientId, data: cleanData, status, ...extra },
    update: { data: cleanData, status, ...extra },
  });

  return { data: record.data, status: record.status, updatedAt: record.updatedAt };
}

export async function deleteTabRecord(tabKey: string, patientId: string): Promise<void> {
  const delegate = getDelegate(tabKey);
  if (!delegate) throw new Error(`Unknown tab "${tabKey}"`);
  await delegate.deleteMany({ where: { patientId } });
}