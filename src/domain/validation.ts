import { FieldConfig, TabConfig } from "./tabs/types";
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
    if (!("fields" in section)) continue;
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
 * browser entirely) could otherwise write a malformed phone number
 * straight into the database; this brings any phone-type field back in
 * line with its country's length rule before it's ever persisted.
 * Sanitizing (trimming to a valid shape) is intentionally separate from
 * *rejecting* the save — see getIncompleteReasons()/validateAllFields()
 * for the "Mark Complete" gate, which does reject.
 */
export function sanitizeTabData(tab: TabConfig, data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...data };
  for (const section of tab.sections) {
    if (!("fields" in section)) continue;
    for (const field of section.fields) {
      if (field.type === "phone" && isPhoneValue(result[field.name])) {
        result[field.name] = sanitizePhoneValue(result[field.name]);
      }
    }
  }
  return result;
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
    if (!("fields" in section)) continue; // skip grid/repeating sections
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
    if (!("fields" in section)) continue;
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
