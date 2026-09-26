// Draft data shapes for the Analytics feature (see docs/ANALYTICS_PLAN.md). Not yet used by the running app.

/** How a field's values should be summarized. */
export type AnalyticsDataType = "ratio" | "categorical";

/** Points at one piece of analyzable data: a stored field, an exploded multiselect option, or a derived value. */
export type FieldRef =
  | { kind: "stored"; tabKey: string; fieldName: string }
  | { kind: "multiselectOption"; tabKey: string; fieldName: string; option: string }
  | { kind: "derived"; id: "age" | "bmi" };

/** One entry in the field picker's list. */
export interface AnalyticsFieldMeta {
  ref: FieldRef;
  /** Human label for the picker, e.g. "Age of Mother". */
  label: string;
  dataType: AnalyticsDataType;
  /** Unit suffix for display only, e.g. "cm", "kg". */
  unit?: string;
  /** True for a field in a grid/repeating section (multiple values per patient); eligible for time-series mode only. */
  multiValue?: boolean;
  /** Key into STANDARD_SEGMENTS, if this field has a predefined bracket set instead of a histogram. */
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

/** Predefined brackets per field. `tsh` is keyed by trimester since its reference range shifts across pregnancy. */
export const STANDARD_SEGMENTS = {
  age: [
    { label: "20-24 years", min: 20, max: 24 },
    { label: "25-29 years", min: 25, max: 29 },
    { label: "30-34 years", min: 30, max: 34 },
    { label: "35-39 years", min: 35, max: 39 },
    { label: "40-44 years", min: 40, max: 44 },
  ] satisfies SegmentBracket[],

  heightCm: [
    { label: "Very Short / Higher Risk", max: 144.9 },
    { label: "Short / Moderate Risk", min: 145, max: 154.9 },
    { label: "Average", min: 155, max: 159.9 },
    { label: "Average-Tall", min: 160, max: 169.9 },
    { label: "Tall", min: 170 },
  ] satisfies SegmentBracket[],

  // Standard WHO pre-pregnancy BMI bands.
  bmi: [
    { label: "Underweight", max: 18.49 },
    { label: "Normal Weight", min: 18.5, max: 24.9 },
    { label: "Overweight", min: 25, max: 29.9 },
    { label: "Obese (Class I)", min: 30, max: 34.9 },
    { label: "Obese (Class II)", min: 35, max: 39.9 },
    { label: "Obese (Class III / Morbid)", min: 40 },
  ] satisfies SegmentBracket[],

  // Trimester-specific reference ranges; lab/assay-dependent in practice, treat as a default.
  tsh: {
    prePregnancy: { min: 0.4, max: 4.0 },
    t1: { min: 0.1, max: 2.5 },
    t2: { min: 0.2, max: 3.0 },
    t3: { min: 0.3, max: 3.0 },
  },
} as const;

/** Which pregnancy-timeline bucket a dated entry falls into. */
export type TrimesterBucket = "prePregnancy" | "t1" | "t2" | "t3";

/** Canonical display order for TrimesterBucket — shared by aggregation (aggregate.ts) and the time-series chart's X axis. */
export const TRIMESTER_BUCKET_ORDER: TrimesterBucket[] = ["prePregnancy", "t1", "t2", "t3"];

/** Short display label per bucket, same order as TRIMESTER_BUCKET_ORDER. */
export const TRIMESTER_BUCKET_LABELS: Record<TrimesterBucket, string> = {
  prePregnancy: "Pre-pregnancy",
  t1: "Trimester 1",
  t2: "Trimester 2",
  t3: "Trimester 3",
};

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
  /** True when this entry merges multiple small buckets via disclosure-control suppression. */
  suppressed?: boolean;
}

/** A Ratio field's values, bucketed into brackets (Standard Segment or generic histogram). */
export interface SegmentedBreakdown extends CategoricalBreakdown {
  bracket: SegmentBracket;
}

/** Deliberately has no `patientId`: aggregate responses must not carry per-patient identifiers. */
export interface ScatterPoint {
  x: number;
  y: number;
}

/** One cell of a Categorical x Categorical (or Categorical x bucketed-Ratio) cross-tab. */
export interface CrossTabCell {
  filterValue: string;
  value: string;
  count: number;
  percent: number;
  /** Same idea as CategoricalBreakdown.suppressed. */
  suppressed?: boolean;
}

export interface TimeSeriesPoint {
  bucket: TrimesterBucket;
  /** Averaged if this point represents a filter-category cohort rather than a single patient. */
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

// One patient's dated entries for a `multiValue` field, plus `lmp` for trimester bucketing.
// `filterValue` (cohort mode only): `null` means "didn't answer the filter", dropped from grouping.
export interface TimeSeriesPatientData {
  patientId: string;
  lmp: string | null;
  filterValue?: string | null;
  entries: { value: number; date: string }[];
}

export type TimeSeriesDataset = TimeSeriesPatientData[];

export interface AnalyticsQuery {
  field: FieldRef;
  filter?: FieldRef;
}

/** One patient's data across every tab, keyed by tabKey — the unit `resolveValue.ts`'s resolvers operate on. */
export interface CohortPatient {
  patientId: string;
  tabs: Record<string, Record<string, any>>;
}

export type CohortDataset = CohortPatient[];

/** Discriminated union so the UI can pick its chart type off `kind` alone. */
export type AnalyticsResult =
  | { kind: "ratioSummary"; stats: CentralTendencies; buckets: SegmentedBreakdown[] }
  | { kind: "ratioScatter"; points: ScatterPoint[] }
  | { kind: "ratioByCategory"; groups: { value: string; stats: CentralTendencies }[] }
  | { kind: "categorySummary"; breakdown: CategoricalBreakdown[] }
  | { kind: "categoryByCategory"; cells: CrossTabCell[] };
