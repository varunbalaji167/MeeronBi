import { FieldConfig, GridSectionConfig, RepeatingSectionConfig, TabConfig, isGridSection, isPlainSection, isRepeatingSection } from "./tabs/types";
import { isPhoneValue, validatePhoneValue, sanitizePhoneValue } from "./phone";

/** Validates a single field's value against its `validation` rule (and, for
 * "phone" fields, the international phone-number rule), if any. */
export function validateFieldValue(field: FieldConfig, value: any): string | null {
  if (field.type === "phone") {
    return isPhoneValue(value) ? validatePhoneValue(value) : null;
  }

  const rule = field.validation;
  if (!rule) return null;
  if (value === undefined || value === null || value === "") return null; // emptiness is a "required" concern, not a format one

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

/**
 * Runs every plain-section field's `validation` rule plus the tab's
 * `fieldValidators` (cross-field checks) against the current data, and
 * returns a map of fieldName -> error message. Empty object = all clear.
 * Grid/repeating sections are intentionally not covered — the fields
 * validated here are the small set of "obvious" ones (phone, dates,
 * clinical ranges) called out on the plain-section tabs.
 */
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
 * Server-side normalization applied to EVERY save, draft or complete,
 * regardless of what the client sent — this is the "never trust the
 * client" half of validation. A request built by hand (bypassing the
 * browser entirely, or crafted maliciously) could otherwise write anything
 * at all into a JSON column with no schema of its own: an out-of-list
 * `select` value, a thousand-entry array in a repeating section, a
 * multi-megabyte string in a `textarea`, or payload keys that don't
 * correspond to any field this tab even has. This rebuilds the record from
 * scratch using the tab's OWN field list as an allowlist (rather than
 * patching the client's object in place) — anything not declared on the
 * tab simply isn't carried over — and narrows every kept value down to
 * what its field type could honestly hold. Sanitizing (silently cleaning
 * up a value, or dropping it to null/empty) is intentionally separate from
 * *rejecting* the save — see getIncompleteReasons()/validateAllFields()
 * for the "Mark Complete" gate, which does reject; a draft is never
 * blocked, only ever cleaned.
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
      // Grid cells are flat top-level keys ("<row>__<column>") — see
      // components/forms/sections/GridSection.tsx, which is the other half
      // of this data shape.
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
      // A hand-built request could submit an enormous array purely to
      // bloat storage — cap it generously above any real `maxCount`/
      // sensible visit count rather than trusting the client's array
      // length outright.
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

/** Strips ASCII control characters — no legitimate clinical free text needs them, and they're a classic way to smuggle/obfuscate something through a text box. Textarea keeps newlines and tabs; single-line text fields don't need those either. */
function stripControlChars(s: string, keepNewlines: boolean): string {
  return keepNewlines ? s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") : s.replace(/[\x00-\x1F\x7F]/g, "");
}

/**
 * Narrows one value down to whatever its field type could honestly hold.
 * Never throws — an unexpected shape is dropped to null/empty rather than
 * rejected, so this stays safe to run on every draft save (see
 * sanitizeTabData above for why drafts are never blocked). Shared by plain
 * fields, grid value-columns, and repeating-section row fields, since all
 * three describe a cell the same way (`{ type, options?, allowOther?,
 * maxLength? }`).
 */
function sanitizeValueForType(
  field: { type: FieldConfig["type"]; options?: string[]; allowOther?: boolean; maxLength?: number },
  value: any
): any {
  if (field.type === "multiselect") {
    if (!Array.isArray(value)) return [];
    const allowed = new Set(field.options ?? []);
    const kept = value.filter((v) => typeof v === "string" && allowed.has(v));
    // De-dupe and cap at the number of real options — a hand-built request
    // repeating the same value thousands of times is the same "unbounded
    // array" risk a text length cap solves for free text.
    return Array.from(new Set(kept)).slice(0, allowed.size || kept.length);
  }

  if (value === undefined || value === null) return value; // nothing to sanitize

  switch (field.type) {
    case "phone":
      return isPhoneValue(value) ? sanitizePhoneValue(value) : null;

    case "select":
    case "radio": {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (trimmed === "") return null;
      if (field.options?.includes(trimmed)) return trimmed;
      // Not one of the listed options — only keep it if this field
      // explicitly allows a custom "Other" value (see FieldConfig.allowOther),
      // and even then it's free text now, so cap its length.
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
  if (typeof value === "object" && "number" in value) return !value.number; // PhoneValue
  return false;
}

/**
 * Returns a list of human-readable reasons this tab can't be marked
 * Complete yet (empty array = ready). Draft saves never call this — it only
 * gates the "Mark Complete" action, per tab.requiredFields /
 * tab.validateForComplete.
 */
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

/** Field NAMES (not labels) that are required but currently empty — the
 * per-field counterpart to getIncompleteReasons()'s human-readable list. */
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

/**
 * The single field-name -> message map used to render inline red text
 * under each box AND to decide whether "Mark Complete" is allowed. Combines
 * format/range validation (validateAllFields) with "required but empty"
 * fields, so every reason a tab can't be completed maps to something
 * visibly highlighted on the form — not just a toast the person has to
 * cross-reference against the form by hand. Tabs using a custom
 * `validateForComplete` (Robson) aren't field-mappable the same way; their
 * reasons stay in getIncompleteReasons() instead.
 */
export function getFieldLevelErrors(tab: TabConfig, data: Record<string, any>): Record<string, string> {
  const errors = validateAllFields(tab, data);
  for (const name of getMissingRequiredFieldNames(tab, data)) {
    if (!errors[name]) errors[name] = "This field is required.";
  }
  return errors;
}
