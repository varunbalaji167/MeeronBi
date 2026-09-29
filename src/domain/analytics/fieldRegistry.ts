// Builds the Analytics field picker's list by walking the tab configs — see docs/ANALYTICS.md
// §3 for the classification rules this implements. Nothing here talks to the database; it only
// reads the static tab configs in domain/tabs, so the registry is always in sync with whatever
// fields the forms actually collect.

import { allTabs, isGridSection, isPlainSection, isRepeatingSection, FieldConfig, FieldType } from "@/domain/tabs";
import { AnalyticsFieldMeta, STANDARD_SEGMENTS } from "./types";

/** Field-name suffix convention already used throughout domain/tabs (heightCm, weightFirstVisitKg, ...). */
function inferUnit(fieldName: string): "cm" | "kg" | undefined {
  if (fieldName.endsWith("Cm")) return "cm";
  if (fieldName.endsWith("Kg")) return "kg";
  return undefined;
}

function standardSegmentKeyFor(fieldName: string): keyof typeof STANDARD_SEGMENTS | undefined {
  return fieldName in STANDARD_SEGMENTS ? (fieldName as keyof typeof STANDARD_SEGMENTS) : undefined;
}

// Dates an entry, not a measurement in its own right — see docs/ANALYTICS.md §3.
const GESTATIONAL_AGE_COMPANION_FIELDS = new Set(["gestAgeWeeks", "pogWeeks"]);

// A section with no date column can't resolve a time-series point — see docs/ANALYTICS.md §3.
function hasDateCompanion(fields: { type: FieldType }[]): boolean {
  return fields.some((f) => f.type === "date");
}

/** One field's picker entries (multiselect explodes into one per option; date/free-text produce none). */
function metaForField(tabKey: string, field: Pick<FieldConfig, "name" | "label" | "type" | "options">, multiValue: boolean): AnalyticsFieldMeta[] {
  switch (field.type as FieldType) {
    case "number":
      return [
        {
          ref: { kind: "stored", tabKey, fieldName: field.name },
          label: field.label,
          dataType: "ratio",
          unit: inferUnit(field.name),
          multiValue: multiValue || undefined,
          standardSegmentKey: standardSegmentKeyFor(field.name),
        },
      ];
    case "select":
    case "radio":
      return [
        {
          ref: { kind: "stored", tabKey, fieldName: field.name },
          label: field.label,
          dataType: "categorical",
          multiValue: multiValue || undefined,
        },
      ];
    case "multiselect":
      // A patient can pick more than one option, so a plain count-per-value would exceed 100% —
      // each option becomes its own boolean-categorical sub-field instead (ANALYTICS.md §3).
      return (field.options ?? []).map((option) => ({
        ref: { kind: "multiselectOption", tabKey, fieldName: field.name, option },
        label: `${field.label} — ${option}`,
        dataType: "categorical",
        multiValue: multiValue || undefined,
      }));
    case "date":
    case "text":
    case "textarea":
    case "phone":
    case "time":
      return [];
  }
}

function derivedFieldsMeta(): AnalyticsFieldMeta[] {
  return [
    { ref: { kind: "derived", id: "age" }, label: "Age", dataType: "ratio", standardSegmentKey: standardSegmentKeyFor("age") },
    { ref: { kind: "derived", id: "bmi" }, label: "BMI", dataType: "ratio", standardSegmentKey: standardSegmentKeyFor("bmi") },
  ];
}

/** Every analyzable field across all 7 tabs, plus the derived fields — the picker UI's data source. */
export function getAnalyticsFieldRegistry(): AnalyticsFieldMeta[] {
  const meta: AnalyticsFieldMeta[] = [];

  for (const tab of allTabs) {
    for (const section of tab.sections) {
      if (isPlainSection(section)) {
        for (const field of section.fields) meta.push(...metaForField(tab.key, field, false));
      } else if (isGridSection(section)) {
        // Storage key convention (see components/forms/sections/GridSection.tsx): `${row.name}__${col.name}`.
        const timeSeriesEligible = hasDateCompanion(section.valueColumns);
        for (const row of section.rows) {
          for (const col of section.valueColumns) {
            if (GESTATIONAL_AGE_COMPANION_FIELDS.has(col.name)) continue;
            meta.push(
              ...metaForField(
                tab.key,
                { name: `${row.name}__${col.name}`, label: `${row.label} — ${col.label}`, type: col.type, options: col.options },
                timeSeriesEligible
              )
            );
          }
        }
      } else if (isRepeatingSection(section)) {
        // Stored as an array of row objects; a patient can have more than one entry (e.g. G1, G2, ...).
        const timeSeriesEligible = hasDateCompanion(section.fields);
        for (const field of section.fields) {
          if (GESTATIONAL_AGE_COMPANION_FIELDS.has(field.name)) continue;
          meta.push(...metaForField(tab.key, field, timeSeriesEligible));
        }
      }
    }
  }

  meta.push(...derivedFieldsMeta());
  return meta;
}
