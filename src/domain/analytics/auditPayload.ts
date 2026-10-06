// Metadata-only audit payload — serialized ref strings and counts, never raw per-patient data.

import { AnalyticsResult, TimeSeriesResult } from "./types";

export interface AnalyticsAuditPayload {
  field: string;
  filter: string | null;
  scope: string;
  count: number;
}

/** Total patient count backing a result, for any `AnalyticsResult` variant — never a raw value. */
export function sampleSizeOf(result: AnalyticsResult): number {
  switch (result.kind) {
    case "ratioSummary":
      return result.stats.count;
    case "ratioScatter":
      return result.points.length;
    case "ratioByCategory":
      return result.groups.reduce((sum, group) => sum + group.stats.count, 0);
    case "categorySummary":
      return result.breakdown.reduce((sum, entry) => sum + entry.count, 0);
    case "categoryByCategory":
      return result.cells.reduce((sum, cell) => sum + cell.count, 0);
  }
}

/** `field`/`filter` must already be serialized via `refKey`/`describeRef` — never raw refs (option values leak). */
export function buildAnalyticsAuditPayload(params: {
  field: string;
  filter: string | null;
  scope: string;
  result: AnalyticsResult;
}): AnalyticsAuditPayload {
  return {
    field: params.field,
    filter: params.filter,
    scope: params.scope,
    count: sampleSizeOf(params.result),
  };
}

/** Total point count across every series of a `TimeSeriesResult` — the time-series analogue of `sampleSizeOf`. */
export function timeSeriesSampleSizeOf(result: TimeSeriesResult): number {
  return result.series.reduce((sum, series) => sum + series.points.length, 0);
}

/** Same idea as `buildAnalyticsAuditPayload`, for a time-series query's result. */
export function buildTimeSeriesAuditPayload(params: {
  field: string;
  filter: string | null;
  scope: string;
  result: TimeSeriesResult;
}): AnalyticsAuditPayload {
  return {
    field: params.field,
    filter: params.filter,
    scope: params.scope,
    count: timeSeriesSampleSizeOf(params.result),
  };
}
