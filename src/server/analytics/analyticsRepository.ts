// Fetches completed tab rows and merges them into the in-memory shape aggregate.ts computes over.
// No Prisma types leak past this file — everything downstream deals in CohortDataset/TimeSeriesDataset only.

import { prisma } from "@/server/db/prisma";
import { allTabs, isGridSection, isRepeatingSection } from "@/domain/tabs";
import { resolveCategoricalValue } from "@/domain/analytics/resolveValue";
import { patientBelongsToFacility } from "@/server/auth/guards";
import {
  AnalyticsQuery,
  AnalyticsFieldMeta,
  CohortDataset,
  CohortPatient,
  FieldRef,
  TimeSeriesDataset,
  TimeSeriesPatientData,
} from "@/domain/analytics/types";

/** Maps a tab's string key to its Prisma model delegate — copied from tabRecordRepository.ts's TAB_MODEL_MAP. */
const TAB_MODEL_MAP: Record<string, keyof typeof prisma> = {
  personal: "personalInfo",
  history: "obstetricHistory",
  investigation: "investigation",
  ultrasound: "ultrasound",
  delivery: "delivery",
  robson: "robsonClassification",
  treatments: "treatment",
};

function getDelegate(tabKey: string) {
  const modelKey = TAB_MODEL_MAP[tabKey];
  if (!modelKey) return null;
  const delegates = prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<{ patientId: string; data: Record<string, any> }[]> }>;
  return delegates[modelKey as string] ?? null;
}

// Loads every COMPLETE row across `tabKeys` (drafts excluded — see docs/ANALYTICS_PLAN.md §7/§8),
// scoped to `facilityId` (omitted = every facility) and optionally one `patientId`.
export async function loadCohortDataset({
  facilityId,
  patientId,
  tabKeys,
}: {
  facilityId?: string;
  patientId?: string;
  tabKeys: string[];
}): Promise<CohortDataset> {
  const patients = new Map<string, CohortPatient>();

  for (const tabKey of tabKeys) {
    const delegate = getDelegate(tabKey);
    if (!delegate) continue;

    const rows = await delegate.findMany({
      where: {
        status: "COMPLETE",
        ...(facilityId ? { patient: { facilityId } } : {}),
        ...(patientId ? { patientId } : {}),
      },
      select: { patientId: true, data: true },
    });

    for (const row of rows) {
      let patient = patients.get(row.patientId);
      if (!patient) {
        patient = { patientId: row.patientId, tabs: {} };
        patients.set(row.patientId, patient);
      }
      patient.tabs[tabKey] = row.data;
    }
  }

  return [...patients.values()];
}

// Which tabs a query needs fetched, deduped; `_registry` is unused but kept for signature symmetry
// with `validateCohortQuery`.
export function tabKeysForQuery(query: AnalyticsQuery, _registry: AnalyticsFieldMeta[]): string[] {
  const tabKeys = new Set<string>();

  function addRef(ref: FieldRef) {
    if (ref.kind === "stored" || ref.kind === "multiselectOption") {
      tabKeys.add(ref.tabKey);
    } else if (ref.kind === "derived") {
      tabKeys.add("personal");
      if (ref.id === "age") tabKeys.add("delivery");
    }
  }

  addRef(query.field);
  if (query.filter) addRef(query.filter);

  return [...tabKeys];
}

/** Where a `multiValue` field's value + its companion date live within a patient's tab data. */
type GridEntryLocation = { kind: "grid"; rowName: string; valueColumnName: string; dateColumnName: string };
type RepeatingEntryLocation = { kind: "repeating"; sectionName: string; valueFieldName: string; dateFieldName: string };
type MultiValueLocation = GridEntryLocation | RepeatingEntryLocation;

// Locates a `stored` multiValue ref's value + companion date column within `allTabs`; `null` if
// the ref isn't a grid/repeating field or its section has no date column to bucket by.
function findMultiValueLocation(ref: FieldRef): MultiValueLocation | null {
  if (ref.kind !== "stored") return null;
  const tab = allTabs.find((t) => t.key === ref.tabKey);
  if (!tab) return null;

  for (const section of tab.sections) {
    if (isGridSection(section)) {
      for (const row of section.rows) {
        for (const col of section.valueColumns) {
          if (`${row.name}__${col.name}` !== ref.fieldName) continue;
          const dateCol = section.valueColumns.find((c) => c.type === "date");
          if (!dateCol) return null;
          return { kind: "grid", rowName: row.name, valueColumnName: col.name, dateColumnName: dateCol.name };
        }
      }
    } else if (isRepeatingSection(section)) {
      const valueField = section.fields.find((f) => f.name === ref.fieldName);
      if (!valueField) continue;
      const dateField = section.fields.find((f) => f.type === "date");
      if (!dateField) return null;
      return { kind: "repeating", sectionName: section.name, valueFieldName: valueField.name, dateFieldName: dateField.name };
    }
  }
  return null;
}

/** Reads one patient's dated entries for a multiValue field out of that tab's raw JSON `data`, per `location`. */
function extractDatedEntries(location: MultiValueLocation, tabData: Record<string, any> | undefined): { value: number; date: string }[] {
  if (!tabData) return [];

  function toEntry(rawValue: unknown, rawDate: unknown): { value: number; date: string } | null {
    const value = Number(rawValue);
    if (rawValue === null || rawValue === undefined || rawValue === "" || !Number.isFinite(value)) return null;
    if (typeof rawDate !== "string" || !rawDate) return null;
    return { value, date: rawDate };
  }

  if (location.kind === "grid") {
    const entry = toEntry(tabData[`${location.rowName}__${location.valueColumnName}`], tabData[`${location.rowName}__${location.dateColumnName}`]);
    return entry ? [entry] : [];
  }

  const rows = tabData[location.sectionName];
  if (!Array.isArray(rows)) return [];

  const entries: { value: number; date: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const entry = toEntry(row[location.valueFieldName], row[location.dateFieldName]);
    if (entry) entries.push(entry);
  }
  return entries;
}

// Single-patient time-series loader. `null` only for an unlocatable field (validation-layer bug);
// no data still returns an empty-entries result, not an error. `facilityId` is defense-in-depth.
export async function loadPatientTimeSeriesData({
  patientId,
  field,
  facilityId,
}: {
  patientId: string;
  field: FieldRef;
  facilityId?: string;
}): Promise<TimeSeriesPatientData | null> {
  const location = findMultiValueLocation(field);
  if (!location || field.kind !== "stored") return null;

  if (facilityId && !(await patientBelongsToFacility(patientId, facilityId))) return null;

  const dataset = await loadCohortDataset({ patientId, tabKeys: [field.tabKey, "personal"] });
  const patient = dataset.find((p) => p.patientId === patientId);
  const personal = patient?.tabs["personal"];

  return {
    patientId,
    lmp: typeof personal?.lmp === "string" ? personal.lmp : null,
    entries: patient ? extractDatedEntries(location, patient.tabs[field.tabKey]) : [],
  };
}

// Cohort time-series loader: every patient with ≥1 dated entry for `field`, grouped by `filter`
// (or one implicit "All patients" category without it). Zero-entry patients are excluded outright.
export async function loadCohortTimeSeriesData({
  field,
  filter,
  facilityId,
}: {
  field: FieldRef;
  filter?: FieldRef;
  facilityId?: string;
}): Promise<TimeSeriesDataset> {
  const location = findMultiValueLocation(field);
  if (!location || field.kind !== "stored") return [];

  const tabKeys = new Set<string>([field.tabKey, "personal"]);
  if (filter && (filter.kind === "stored" || filter.kind === "multiselectOption")) tabKeys.add(filter.tabKey);

  const dataset = await loadCohortDataset({ facilityId, tabKeys: [...tabKeys] });

  const result: TimeSeriesDataset = [];
  for (const patient of dataset) {
    const entries = extractDatedEntries(location, patient.tabs[field.tabKey]);
    if (entries.length === 0) continue;

    const personal = patient.tabs["personal"];
    const filterValue = filter ? resolveCategoricalValue(filter, patient.tabs) : "All patients";

    result.push({
      patientId: patient.patientId,
      lmp: typeof personal?.lmp === "string" ? personal.lmp : null,
      filterValue,
      entries,
    });
  }

  return result;
}
