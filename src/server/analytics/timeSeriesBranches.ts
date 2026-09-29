// Time-series mode's two branches (docs/ANALYTICS.md §5), split out of aggregate.ts's dispatch.

import {
  AnalyticsFieldMeta,
  STANDARD_SEGMENTS,
  TimeSeriesDataset,
  TimeSeriesPoint,
  TimeSeriesResult,
  TRIMESTER_BUCKET_ORDER,
  TrimesterBucket,
} from "@/domain/analytics/types";
import { DisclosureAudience, meetsMinimumSampleSize } from "@/domain/analytics/disclosureControl";
import { bucketTrimester } from "@/domain/analytics/derivedFields";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Attaches STANDARD_SEGMENTS.tsh's per-trimester reference band, only for the field this Standard Segment belongs to. */
function attachTshReferenceBand(point: TimeSeriesPoint, field: AnalyticsFieldMeta, bucket: TrimesterBucket): TimeSeriesPoint {
  if (field.standardSegmentKey !== "tsh") return point;
  const band = STANDARD_SEGMENTS.tsh[bucket];
  return { ...point, referenceLow: band.min, referenceHigh: band.max };
}

// One series, one point per trimester bucket with an entry; multiple entries in a bucket are
// averaged, and `date` is only kept when exactly one entry backs the point.
export function singlePatientTimeSeries(field: AnalyticsFieldMeta, data: TimeSeriesDataset): TimeSeriesResult {
  const patient = data[0];
  if (!patient) return { series: [] };

  const byBucket = new Map<TrimesterBucket, { value: number; date: string }[]>();
  for (const entry of patient.entries) {
    const bucket = bucketTrimester(patient.lmp, entry.date);
    if (!bucket) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push(entry);
    byBucket.set(bucket, list);
  }

  const points: TimeSeriesPoint[] = [];
  for (const bucket of TRIMESTER_BUCKET_ORDER) {
    const entries = byBucket.get(bucket);
    if (!entries || entries.length === 0) continue;

    let point: TimeSeriesPoint = { bucket, value: round1(average(entries.map((e) => e.value))) };
    if (entries.length === 1) point.date = entries[0].date;
    point = attachTshReferenceBand(point, field, bucket);
    points.push(point);
  }

  return { series: [{ label: field.label, points }] };
}

// One series per distinct `filterValue`; gated at two levels via `meetsMinimumSampleSize` — a
// whole category is dropped if too few patients contribute, and so is an individual bucket point.
export function cohortTimeSeries(field: AnalyticsFieldMeta, data: TimeSeriesDataset, audience: DisclosureAudience): TimeSeriesResult {
  const byCategory = new Map<string, TimeSeriesDataset>();
  for (const patient of data) {
    if (patient.filterValue === null || patient.filterValue === undefined) continue;
    const list = byCategory.get(patient.filterValue) ?? [];
    list.push(patient);
    byCategory.set(patient.filterValue, list);
  }

  const series: { label: string; points: TimeSeriesPoint[] }[] = [];
  for (const [category, patients] of byCategory) {
    if (!meetsMinimumSampleSize(patients.length, audience)) continue;

    const points: TimeSeriesPoint[] = [];
    for (const bucket of TRIMESTER_BUCKET_ORDER) {
      const perPatientAverages: number[] = [];
      for (const patient of patients) {
        const bucketEntries = patient.entries.filter((e) => bucketTrimester(patient.lmp, e.date) === bucket);
        if (bucketEntries.length === 0) continue;
        perPatientAverages.push(average(bucketEntries.map((e) => e.value)));
      }
      if (!meetsMinimumSampleSize(perPatientAverages.length, audience)) continue;

      let point: TimeSeriesPoint = { bucket, value: round1(average(perPatientAverages)) };
      point = attachTshReferenceBand(point, field, bucket);
      points.push(point);
    }

    if (points.length > 0) series.push({ label: category, points });
  }

  return { series };
}
