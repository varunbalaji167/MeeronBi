// Pure data & types describing what a "tab" is. No framework imports.

import type { GestationalWindow } from "../gestationalAge";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "time"
  | "select"
  | "multiselect"
  | "textarea"
  | "radio"
  | "phone";

export interface FieldValidation {
  pattern?: RegExp;
  min?: number;
  max?: number;
  /** Custom message; otherwise a sensible default is generated. */
  message?: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  helpText?: string;
  /** Lightweight inline validation, checked on blur (never blocks Save as Draft). */
  validation?: FieldValidation;
  /** Small icon shown inside the input — see components/forms/FieldInput.tsx for the icon map. */
  icon?: "phone" | "email" | "location" | "user";
  /** Hard cap on character count, enforced via HTML `maxlength`. */
  maxLength?: number;
  /** `select`/`radio` only: adds an "Other (please specify)" choice with a free-text box. */
  allowOther?: boolean;
  /** Whether this field is shown by default before a hospital customizes its field list (see domain/fieldVisibility.ts). */
  core?: boolean;
}

export interface SectionConfig {
  title?: string;
  columns?: 2 | 3 | 4; // grid layout hint
  fields: FieldConfig[];
  /** A textbook gestational-age window this section's data is normally collected in; advisory only, computed from LMP. */
  recommendedWindow?: GestationalWindow | GestationalWindow[];
}

// A "grid" section is a fixed set of named rows sharing the same value columns (e.g. Thyroid tests).
// Not covered by field-visibility customization.
export interface GridSectionConfig {
  kind: "grid";
  title: string;
  rowLabelHeader?: string;
  valueColumns: { name: string; label: string; type: FieldType; options?: string[] }[];
  rows: { name: string; label: string }[];
  /** See SectionConfig.recommendedWindow. */
  recommendedWindow?: GestationalWindow | GestationalWindow[];
}

export interface RepeatingSectionConfig {
  kind: "repeating";
  name: string;
  title: string;
  columnLabelPrefix?: string;
  /** One column per entry (e.g. Obstetric History's G1, G2, ...) instead of one row. */
  transposed?: boolean;
  /** Always-shown entry count; new entries can be added up to `maxCount`, existing ones are never truncated. */
  minCount?: number;
  maxCount?: number;
  addRowLabel?: string;
  fields: FieldConfig[];
}

export type AnySectionConfig = SectionConfig | GridSectionConfig | RepeatingSectionConfig;

export interface TabConfig {
  key: string;
  label: string;
  route: string;
  sections: AnySectionConfig[];
  /** Field names that must be filled in before this tab can be marked Complete. Drafts are never validated. */
  requiredFields?: string[];
  /** Escape hatch for a custom "is this complete" check; takes priority over requiredFields. Empty array = OK. */
  validateForComplete?: (data: Record<string, any>) => string[];
  /** Cross-field checks (e.g. "EDD must be after LMP"), keyed by the field the error attaches to. */
  fieldValidators?: Record<string, (data: Record<string, any>) => string | null>;
}

/** Type guards, shared by anything that walks a tab's sections. */
export function isGridSection(s: AnySectionConfig): s is GridSectionConfig {
  return (s as any).kind === "grid";
}
export function isRepeatingSection(s: AnySectionConfig): s is RepeatingSectionConfig {
  return (s as any).kind === "repeating";
}
export function isPlainSection(s: AnySectionConfig): s is SectionConfig {
  return !isGridSection(s) && !isRepeatingSection(s);
}
