// Computes which tab fields are visible per hospital's "Customize fields" choice.
// Storage of that choice lives in server/patients; this module only computes visibility.

import { FieldConfig, TabConfig, isPlainSection } from "./tabs/types";

/** Every field on a tab that field-visibility customization applies to. */
export function getCustomizableFields(tab: TabConfig): FieldConfig[] {
  return tab.sections.filter(isPlainSection).flatMap((s) => s.fields);
}

/** True only if a tab has at least one non-core (customizable) field. */
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
    return !!(value as any).number;
  }
  return true;
}

/** Field names the staff data-entry view should render: the hospital's saved selection, or core defaults if unset. */
export function resolveVisibleFieldNames(tab: TabConfig, storedSelection: string[] | null): Set<string> {
  return new Set(storedSelection ?? getDefaultEnabledFieldNames(tab));
}

/** Field names with an actual value in `data`, regardless of current visibility config (used for the patient's read-only view). */
export function getFieldsWithData(tab: TabConfig, data: Record<string, any>): Set<string> {
  const result = new Set<string>();
  for (const field of getCustomizableFields(tab)) {
    if (hasValue(data[field.name])) result.add(field.name);
  }
  return result;
}
