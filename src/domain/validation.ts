import { FieldConfig, GridSectionConfig, RepeatingSectionConfig, TabConfig, isGridSection, isPlainSection, isRepeatingSection } from "./tabs/types";
import { isPhoneValue, validatePhoneValue, sanitizePhoneValue } from "./phone";

/** Validates a single field's value against its `validation` rule, or the phone-number rule for "phone" fields. */
export function validateFieldValue(field: FieldConfig, value: any): string | null {
  if (field.type === "phone") {
    return isPhoneValue(value) ? validatePhoneValue(value) : null;
  }

  const rule = field.validation;
  if (!rule) return null;
  if (value === undefined || value === null || value === "") return null;

  if (rule.pattern && typeof value === "string" && !rule.pattern.test(value)) {
    return rule.message || `Enter a valid ${field.label.replace(/^\d+\.?\s*/, "").toLowerCase()}.`;
  }
  if (typeof value === "number") {
    if (rule.min !== undefined && value < rule.min) {
      return rule.message || `${field.label.replace(/^\d+\.?\s*/, "")} should be at least ${rule.min}.`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return rule.message || `${field.label.replace(/^\d+\.?\s*/, "")} should be at most ${rule.max}.`;
    }
  }
  return null;
}

/** Runs plain-section field validation plus the tab's fieldValidators; returns fieldName -> error message. Grid/repeating sections are not covered. */
export function validateAllFields(tab: TabConfig, data: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const section of tab.sections) {
    if (!isPlainSection(section)) continue;
    for (const field of section.fields) {
      const err = validateFieldValue(field, data[field.name]);
      if (err) errors[field.name] = err;
    }
  }

  if (tab.fieldValidators) {
    for (const [name, check] of Object.entries(tab.fieldValidators)) {
      const err = check(data);
      if (err) errors[name] = err;
    }
  }

  return errors;
}

/**
 * Server-side normalization applied to every save. Rebuilds the record from the tab's own field
 * list as an allowlist and narrows each value to what its field type can hold; never rejects a save, only cleans it.
 */
export function sanitizeTabData(tab: TabConfig, data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const section of tab.sections) {
    if (isPlainSection(section)) {
      for (const field of section.fields) {
        if (!(field.name in data)) continue;
        result[field.name] = sanitizeValueForType(field, data[field.name]);
      }
    } else if (isGridSection(section)) {
      // Grid cells are flat top-level keys ("<row>__<column>").
      for (const row of (section as GridSectionConfig).rows) {
        for (const col of (section as GridSectionConfig).valueColumns) {
          const key = `${row.name}__${col.name}`;
          if (!(key in data)) continue;
          result[key] = sanitizeValueForType(col, data[key]);
        }
      }
    } else if (isRepeatingSection(section)) {
      const repeating = section as RepeatingSectionConfig;
      const rows: any[] = Array.isArray(data[repeating.name]) ? data[repeating.name] : [];
      // Cap generously above any real maxCount, rather than trusting the client's array length.
      const cap = repeating.maxCount ?? 60;
      result[repeating.name] = rows.slice(0, cap).map((row) => {
        const cleanRow: Record<string, any> = {};
        if (row && typeof row === "object") {
          for (const field of repeating.fields) {
            if (!(field.name in row)) continue;
            cleanRow[field.name] = sanitizeValueForType(field, row[field.name]);
          }
        }
        return cleanRow;
      });
    }
  }

  return result;
}

const DEFAULT_MAX_LENGTH: Partial<Record<FieldConfig["type"], number>> = {
  text: 300,
  textarea: 3000,
};

/** Strips ASCII control characters; textarea keeps newlines/tabs, single-line text fields don't. */
function stripControlChars(s: string, keepNewlines: boolean): string {
  return keepNewlines ? s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") : s.replace(/[\x00-\x1F\x7F]/g, "");
}

/** Narrows one value to whatever its field type can hold; never throws, drops unexpected shapes to null/empty. */
function sanitizeValueForType(
  field: { type: FieldConfig["type"]; options?: string[]; allowOther?: boolean; maxLength?: number },
  value: any
): any {
  if (field.type === "multiselect") {
    if (!Array.isArray(value)) return [];
    const allowed = new Set(field.options ?? []);
    const kept = value.filter((v) => typeof v === "string" && allowed.has(v));
    // De-dupe and cap at the number of real options, guarding against an unbounded array.
    return Array.from(new Set(kept)).slice(0, allowed.size || kept.length);
  }

  if (value === undefined || value === null) return value;

  switch (field.type) {
    case "phone":
      return isPhoneValue(value) ? sanitizePhoneValue(value) : null;

    case "select":
    case "radio": {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (trimmed === "") return null;
      if (field.options?.includes(trimmed)) return trimmed;
      // Not a listed option: keep only if allowOther is set, capped as free text.
      return field.allowOther ? trimmed.slice(0, 120) : null;
    }

    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;

    case "date":
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
      return Number.isNaN(new Date(value).getTime()) ? null : value;

    case "time":
      return typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? value : null;

    case "textarea":
    case "text":
    default: {
      if (typeof value !== "string") return null;
      const cap = field.maxLength ?? DEFAULT_MAX_LENGTH[field.type] ?? 300;
      return stripControlChars(value, field.type === "textarea").slice(0, cap).trim();
    }
  }
}

function isEmptyValue(value: any): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && "number" in value) return !value.number;
  return false;
}

/** Human-readable reasons this tab can't be marked Complete yet (empty = ready). Only used for "Mark Complete", never draft saves. */
export function getIncompleteReasons(tab: TabConfig, data: Record<string, any>): string[] {
  if (tab.validateForComplete) return tab.validateForComplete(data);

  const required = tab.requiredFields ?? [];
  if (required.length === 0) return [];

  const missing: string[] = [];
  for (const section of tab.sections) {
    if (!isPlainSection(section)) continue; // skip grid/repeating sections
    for (const field of section.fields) {
      if (!required.includes(field.name)) continue;
      if (isEmptyValue(data[field.name])) missing.push(field.label);
    }
  }
  return missing;
}

/** Field names (not labels) that are required but currently empty. */
export function getMissingRequiredFieldNames(tab: TabConfig, data: Record<string, any>): string[] {
  const required = tab.requiredFields ?? [];
  if (required.length === 0) return [];

  const missing: string[] = [];
  for (const section of tab.sections) {
    if (!isPlainSection(section)) continue;
    for (const field of section.fields) {
      if (!required.includes(field.name)) continue;
      if (isEmptyValue(data[field.name])) missing.push(field.name);
    }
  }
  return missing;
}

/** Field-name -> message map combining format/range validation with "required but empty" fields, for inline form errors. */
export function getFieldLevelErrors(tab: TabConfig, data: Record<string, any>): Record<string, string> {
  const errors = validateAllFields(tab, data);
  for (const name of getMissingRequiredFieldNames(tab, data)) {
    if (!errors[name]) errors[name] = "This field is required.";
  }
  return errors;
}
