// ─────────────────────────────────────────────────────────────────────────
// DRAFT — see docs/ANALYTICS_PLAN.md. Nothing in this file is imported by
// the running app yet. It exists to pin down the shape of the Analytics
// feature (field types, query/result shapes, standard segments) before any
// aggregation, API, or UI code is written against it.
//
// Once implementation starts, this should behave like the rest of
// domain/tabs/types.ts: pure data shapes, no framework/DB imports, safe to
// unit-test in isolation.
// ─────────────────────────────────────────────────────────────────────────

/** How a field's values should be summarized. See ANALYTICS_PLAN.md §3 for the FieldConfig.type -> this mapping. */
export type AnalyticsDataType = "ratio" | "categorical";

/**
 * Points at one piece of analyzable data — either a field that's really
 * stored (on some tab, or one exploded option of a multiselect field), or
 * one of the derived values in ANALYTICS_PLAN.md §4 that's computed at
 * query time rather than read off a column.
 */
export type FieldRef =
  | { kind: "stored"; tabKey: string; fieldName: string }
  | { kind: "multiselectOption"; tabKey: string; fieldName: string; option: string }
  | { kind: "derived"; id: "age" | "bmi" };

/** One entry in the field picker's list — what the registry (ANALYTICS_PLAN.md §9) produces for every analyzable field. */
export interface AnalyticsFieldMeta {
  ref: FieldRef;
  /** Human label for the picker, e.g. "Age of Mother", "13. NT (mm)", "Medical History: Bronchial Asthma". */
  label: string;
  dataType: AnalyticsDataType;
  /** Unit suffix for display only, e.g. "cm", "kg", "mU/L" — cosmetic, not used in computation. */
  unit?: string;
  /** True for a field living inside a grid/repeating section (can have more than one value per patient) — eligible for time-series mode only, not the simple cohort single-value path. See ANALYTICS_PLAN.md §3. */
  multiValue?: boolean;
  /** Key into STANDARD_SEGMENTS below, if this field has a predefined bracket set instead of falling back to a histogram. */
  standardSegmentKey?: keyof typeof STANDARD_SEGMENTS;
}

/** A single named bracket within a Standard Segment (or a generated histogram bin). */
export interface SegmentBracket {
  label: string;
  /** Inclusive lower bound. Omit for an open-ended "and below" bracket. */
  min?: number;
  /** Inclusive upper bound. Omit for an open-ended "and above" bracket. */
  max?: number;
}

/**
 * Appendix A's predefined brackets (ANALYTICS_PLAN.md §6), corrected where
 * the source PDF was internally inconsistent or garbled — see that
 * section for what changed and why. `tsh` is keyed by trimester bucket
 * since the reference range itself shifts across the pregnancy, unlike
 * the other three which are static per-patient.
 */
export const STANDARD_SEGMENTS = {
  age: [
    { label: "20-24 years", min: 20, max: 24 },
    { label: "25-29 years", min: 25, max: 29 },
    { label: "30-34 years", min: 30, max: 34 },
    { label: "35-39 years", min: 35, max: 39 },
    { label: "40-44 years", min: 40, max: 44 },
  ] satisfies SegmentBracket[],

  // Source spec's ">145" ("Below 5 feet") almost certainly meant "<145" —
  // as literally written it leaves 145.0-149.9 uncovered. Closed here.
  heightCm: [
    { label: "Very Short / Higher Risk", max: 144.9 },
    { label: "Short / Moderate Risk", min: 145, max: 154.9 },
    { label: "Average", min: 155, max: 159.9 },
    { label: "Average-Tall", min: 160, max: 169.9 },
    { label: "Tall", min: 170 },
  ] satisfies SegmentBracket[],

  // Standard WHO pre-pregnancy BMI bands. The source PDF's table was
  // corrupted (IOM gestational-weight-gain figures bled into the BMI
  // cutoffs — see ANALYTICS_PLAN.md §6) — these are the clean values.
  bmi: [
    { label: "Underweight", max: 18.49 },
    { label: "Normal Weight", min: 18.5, max: 24.9 },
    { label: "Overweight", min: 25, max: 29.9 },
    { label: "Obese (Class I)", min: 30, max: 34.9 },
    { label: "Obese (Class II)", min: 35, max: 39.9 },
    { label: "Obese (Class III / Morbid)", min: 40 },
  ] satisfies SegmentBracket[],

  // Trimester-specific reference ranges, as given in the source spec.
  // Flagged in ANALYTICS_PLAN.md §6 as lab/assay-dependent in real
  // practice — treat as a default, not a hardcoded clinical fact, once
  // this is hospital-configurable.
  tsh: {
    prePregnancy: { min: 0.4, max: 4.0 },
    t1: { min: 0.1, max: 2.5 },
    t2: { min: 0.2, max: 3.0 },
    t3: { min: 0.3, max: 3.0 },
  },
} as const;

/** Which pregnancy-timeline bucket a dated entry (a lab draw, a weight measurement, ...) falls into — see ANALYTICS_PLAN.md §5. */
export type TrimesterBucket = "prePregnancy" | "t1" | "t2" | "t3";

export interface CentralTendencies {
  count: number;
  average: number;
  max: number;
  min: number;
  /** Most frequent value. `null` if every value is equally frequent (no meaningful mode). */
  mode: number | null;
  standardDeviation: number;
}

export interface CategoricalBreakdown {
  value: string;
  count: number;
  percent: number;
}

/** A Ratio field's values, bucketed into brackets (Standard Segment or generic histogram) — the fallback described in ANALYTICS_PLAN.md §6. */
export interface SegmentedBreakdown extends CategoricalBreakdown {
  bracket: SegmentBracket;
}

export interface ScatterPoint {
  x: number;
  y: number;
  patientId: string;
}

/** One cell of a Categorical x Categorical (or Categorical x bucketed-Ratio) cross-tab. */
export interface CrossTabCell {
  filterValue: string;
  value: string;
  count: number;
  percent: number;
}

export interface TimeSeriesPoint {
  bucket: TrimesterBucket;
  /** Averaged if this point represents a filter-category cohort rather than a single patient — see ANALYTICS_PLAN.md §5. */
  value: number;
  /** Present only in single-patient mode. */
  date?: string;
  referenceLow?: number;
  referenceHigh?: number;
}

export interface TimeSeriesQuery {
  field: FieldRef;
  /** Single-patient mode. Mutually exclusive with `filter` (cohort mode). */
  patientId?: string;
  /** Cohort mode: one line per distinct value of this (categorical) field. */
  filter?: FieldRef;
}

export interface TimeSeriesResult {
  /** One series per patient (single-patient mode: length 1) or per filter category (cohort mode). */
  series: { label: string; points: TimeSeriesPoint[] }[];
}

export interface AnalyticsQuery {
  field: FieldRef;
  filter?: FieldRef;
}

/**
 * Discriminated union covering the six branches in ANALYTICS_PLAN.md §2,
 * so the UI can pick its chart type (§9: bar/pie/scatter/grouped-bar, all
 * already covered by the recharts dependency already in package.json) off
 * `kind` alone rather than re-deriving the same field-type logic twice.
 */
export type AnalyticsResult =
  | { kind: "ratioSummary"; stats: CentralTendencies; buckets: SegmentedBreakdown[] }
  | { kind: "ratioScatter"; points: ScatterPoint[] }
  | { kind: "ratioByCategory"; groups: { value: string; stats: CentralTendencies }[] }
  | { kind: "categorySummary"; breakdown: CategoricalBreakdown[] }
  | { kind: "categoryByCategory"; cells: CrossTabCell[] };
