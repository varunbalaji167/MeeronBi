// ─────────────────────────────────────────────────────────────────────────
// "Customize fields" — most hospitals won't want to collect all 137 fields
// from the original prototype. Each tab's plain-section fields can be
// individually shown/hidden per deployment; grid/repeating sections are
// always shown in full (see domain/tabs/types.ts for why that's excluded).
//
// The *storage* of a hospital's choice lives in server/patients (a Prisma
// model), deliberately kept out of this file — this module only knows how
// to compute "what should be visible," not where that choice is persisted.
// ─────────────────────────────────────────────────────────────────────────

import { FieldConfig, TabConfig, isPlainSection } from "./tabs/types";

/** Every field on a tab that field-visibility customization applies to. */
export function getCustomizableFields(tab: TabConfig): FieldConfig[] {
  return tab.sections.filter(isPlainSection).flatMap((s) => s.fields);
}

/** True only if a tab has at least one customizable field — Robson (all core) and
 * Treatments (no plain fields) don't get a "Customize fields" control at all. */
export function isCustomizable(tab: TabConfig): boolean {
  return getCustomizableFields(tab).some((f) => !f.core) || false;
}

/** Field names shown before a hospital has ever customized this tab. */
export function getDefaultEnabledFieldNames(tab: TabConfig): string[] {
  return getCustomizableFields(tab)
    .filter((f) => f.core)
    .map((f) => f.name);
}

export function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && value !== null && "number" in (value as any)) {
    return !!(value as any).number; // PhoneValue
  }
  return true;
}

/**
 * Which field names the DATA-ENTRY (staff) view should render for this tab.
 *
 * Strictly the hospital's saved choice (`storedSelection`), or the `core`
 * defaults if it's never been configured — nothing more. Unchecking a field
 * in the customizer hides it here, full stop, even if it already has data;
 * that data isn't deleted, it just isn't shown in this editing view anymore
 * (the patient's own read-only view is unaffected — see
 * `getFieldsWithData` below, which is a deliberately separate concern).
 */
export function resolveVisibleFieldNames(tab: TabConfig, storedSelection: string[] | null): Set<string> {
  return new Set(storedSelection ?? getDefaultEnabledFieldNames(tab));
}

/**
 * Which field names have an actual value in `data`, regardless of the
 * hospital's current field-visibility configuration. Used for the
 * patient's READ-ONLY view: an empty optional field isn't useful to read,
 * and a field the hospital has since stopped collecting shouldn't
 * disappear from a patient's own historical record.
 */
export function getFieldsWithData(tab: TabConfig, data: Record<string, any>): Set<string> {
  const result = new Set<string>();
  for (const field of getCustomizableFields(tab)) {
    if (hasValue(data[field.name])) result.add(field.name);
  }
  return result;
}
