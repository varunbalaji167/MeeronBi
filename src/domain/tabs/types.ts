// ─────────────────────────────────────────────────────────────────────────
// Domain layer: pure data & types describing what a "tab" is. No React, no
// Next.js, no Prisma — this file (and the rest of src/domain/) should be
// importable from a plain Node script or a unit test with zero framework
// setup. That's what keeps it easy to reason about and to extend safely.
// ─────────────────────────────────────────────────────────────────────────

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
  /**
   * Hard cap on character count, enforced at the DOM level (HTML
   * `maxlength`) so invalid-length input can't even be typed/pasted in the
   * first place — not just flagged after the fact. Use this for things like
   * postal codes; for digit-only limits (e.g. phone numbers) see the
   * dedicated "phone" field type instead.
   */
  maxLength?: number;
  /**
   * `select`/`radio` only: adds an "Other (please specify)" choice that
   * reveals a free-text box when picked, instead of forcing every value
   * into a closed list. Use this for fields that have a well-known, mostly
   * complete set of options where you still don't want to hard-block a
   * genuine outlier (e.g. Religion, Profession) — not for a field with a
   * truly authoritative, complete list (e.g. this app's tab keys), and not
   * as a substitute for `multiselect`. See domain/validation.ts's
   * sanitizeTabData for how the server allows the custom value through.
   */
  allowOther?: boolean;
  /**
   * Whether this field is shown by default before a hospital has customized
   * its field list for this tab (see domain/fieldVisibility.ts). Most of
   * the 137-field prototype is genuinely optional for any given hospital —
   * only a deliberately small "core" subset per tab ships enabled
   * out of the box; everything else is opt-in via "Customize fields".
   */
  core?: boolean;
}

export interface SectionConfig {
  title?: string;
  columns?: 2 | 3 | 4; // grid layout hint
  fields: FieldConfig[];
  /**
   * A textbook gestational-age window this section's data is normally
   * collected in (e.g. the NT scan's 11w0d-13w6d), shown as an informational
   * badge next to the title and computed live from the Personal tab's LMP.
   * See domain/gestationalAge.ts — this is advisory only, never a
   * hide/disable.
   */
  recommendedWindow?: GestationalWindow | GestationalWindow[];
}

// A "grid" section is for tables like the Thyroid tests or Echo Doppler
// tables: a fixed set of named rows, each sharing the same set of value
// columns. Grid/repeating sections are NOT covered by field-visibility
// customization (see domain/fieldVisibility.ts) — they're already compact,
// and toggling individual cells of a table adds a lot of UI complexity for
// little benefit. This is a deliberate, documented scope boundary.
export interface GridSectionConfig {
  kind: "grid";
  title: string;
  rowLabelHeader?: string;
  valueColumns: { name: string; label: string; type: FieldType; options?: string[] }[];
  rows: { name: string; label: string }[];
  /** See SectionConfig.recommendedWindow — same idea, for a grid-shaped section. */
  recommendedWindow?: GestationalWindow | GestationalWindow[];
}

// A "repeating" section is for open-ended repeated groups where the number
// of entries can vary (Treatments' visit/course rows, History's Obstetric
// History table). Two layouts:
//  - default (no `transposed`): one row per entry, one column per field —
//    e.g. Treatments' "Add visit" table.
//  - `transposed: true`: one COLUMN per entry, one row per field — e.g.
//    Obstetric History's G1, G2, ... columns, per the source spec's page 2
//    ("From G2 to G6 or G10, allow users to add by allowing users to click
//    an 'Add Gravida' button"). `minCount` entries are always shown (G1 is
//    mandatory/default per that page's red dot on the G1 column header);
//    `maxCount` caps how many the Add button can create. Existing data with
//    more rows than `minCount` is never truncated — only new additions are
//    capped.
export interface RepeatingSectionConfig {
  kind: "repeating";
  name: string;
  title: string;
  columnLabelPrefix?: string; // e.g. "G" -> G1, G2, ...
  transposed?: boolean;
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
  /**
   * Field `name`s (from top-level, non-repeating sections only) that must
   * be filled in before this tab can be marked Complete. Drafts are never
   * validated — this only gates the "Mark Complete" action.
   */
  requiredFields?: string[];
  /**
   * Escape hatch for tabs whose "is this complete" check isn't just a list
   * of non-empty fields (e.g. Robson, which is complete once it classifies
   * to a group). Returns a list of human-readable problems; empty = OK.
   * Takes priority over requiredFields when present.
   */
  validateForComplete?: (data: Record<string, any>) => string[];
  /**
   * Cross-field checks (e.g. "EDD must be after LMP") that a single field's
   * own `validation` can't express. Keyed by the field the error should be
   * attached to.
   */
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
