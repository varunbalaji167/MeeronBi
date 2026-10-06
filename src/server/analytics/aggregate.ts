// Query validation + dispatch; branch logic lives in cohortBranches.ts and timeSeriesBranches.ts.

import { Result, ok, err } from "@/domain/result";
import {
  AnalyticsFieldMeta,
  AnalyticsQuery,
  AnalyticsResult,
  CohortDataset,
  FieldRef,
  TimeSeriesDataset,
  TimeSeriesQuery,
  TimeSeriesResult,
} from "@/domain/analytics/types";
import { DisclosureAudience } from "@/domain/analytics/disclosureControl";
import { ValidationError } from "@/server/http/errors";
import {
  fieldNotAnalyzableError,
  sameFieldAsFilterError,
  timeSeriesModeConflictError,
  unknownFieldError,
  unknownFilterError,
} from "./errors";
import {
  categoryByCategory,
  categoryByRatio,
  categoryNoFilter,
  ratioByCategory,
  ratioByRatio,
  ratioNoFilter,
} from "./cohortBranches";
import { cohortTimeSeries, singlePatientTimeSeries } from "./timeSeriesBranches";

export function refKey(ref: FieldRef): string {
  switch (ref.kind) {
    case "stored":
      return `stored:${ref.tabKey}.${ref.fieldName}`;
    case "multiselectOption":
      return `multiselectOption:${ref.tabKey}.${ref.fieldName}.${ref.option}`;
    case "derived":
      return `derived:${ref.id}`;
  }
}

/** Human-readable name for a ref an error can quote, even one that turned out not to be in the registry. */
export function describeRef(ref: FieldRef): string {
  switch (ref.kind) {
    case "stored":
      return ref.fieldName;
    case "multiselectOption":
      return `${ref.fieldName}:${ref.option}`;
    case "derived":
      return ref.id;
  }
}

function findFieldMeta(registry: AnalyticsFieldMeta[], ref: FieldRef): AnalyticsFieldMeta | undefined {
  const key = refKey(ref);
  return registry.find((m) => refKey(m.ref) === key);
}

// Shared by every cohort-mode branch: both refs must be in the registry, neither can be
// `multiValue` (time-series-only, see `aggregateTimeSeries`), filter != field.
export function validateCohortQuery(
  query: AnalyticsQuery,
  registry: AnalyticsFieldMeta[]
): Result<{ field: AnalyticsFieldMeta; filter?: AnalyticsFieldMeta }, ValidationError> {
  const field = findFieldMeta(registry, query.field);
  if (!field) return err(unknownFieldError(describeRef(query.field)));
  if (field.multiValue) return err(fieldNotAnalyzableError(describeRef(query.field)));

  if (!query.filter) return ok({ field });

  const filter = findFieldMeta(registry, query.filter);
  if (!filter) return err(unknownFilterError(describeRef(query.filter)));
  if (filter.multiValue) return err(fieldNotAnalyzableError(describeRef(query.filter)));
  if (refKey(query.field) === refKey(query.filter)) return err(sameFieldAsFilterError());

  return ok({ field, filter });
}

// Validates the query, then dispatches to the branch dictated by the decision matrix (docs/ANALYTICS.md §2).
export function aggregate(
  query: AnalyticsQuery,
  registry: AnalyticsFieldMeta[],
  dataset: CohortDataset,
  audience: DisclosureAudience
): Result<AnalyticsResult, ValidationError> {
  const validated = validateCohortQuery(query, registry);
  if (!validated.ok) return validated;
  const { field, filter } = validated.value;

  if (field.dataType === "ratio" && !filter) return ratioNoFilter(field, dataset, audience);
  if (field.dataType === "ratio" && filter?.dataType === "ratio") return ratioByRatio(field, filter, dataset, audience);
  if (field.dataType === "ratio" && filter?.dataType === "categorical") return ratioByCategory(field, filter, dataset, audience);
  if (field.dataType === "categorical" && !filter) return categoryNoFilter(field, dataset, audience);
  if (field.dataType === "categorical" && filter?.dataType === "categorical") return categoryByCategory(field, filter, dataset, audience);
  return categoryByRatio(field, filter as AnalyticsFieldMeta, dataset, audience); // only remaining case: categorical field, ratio filter
}

/** Field/filter validation for a time-series query — the time-series counterpart of `validateCohortQuery`. */
export function validateTimeSeriesQuery(
  query: TimeSeriesQuery,
  registry: AnalyticsFieldMeta[]
): Result<{ field: AnalyticsFieldMeta; filter?: AnalyticsFieldMeta }, ValidationError> {
  if (query.patientId && query.filter) return err(timeSeriesModeConflictError());

  const field = findFieldMeta(registry, query.field);
  if (!field) return err(unknownFieldError(describeRef(query.field)));
  if (!field.multiValue) return err(fieldNotAnalyzableError(describeRef(query.field)));

  if (!query.filter) return ok({ field });

  const filter = findFieldMeta(registry, query.filter);
  if (!filter) return err(unknownFilterError(describeRef(query.filter)));
  if (filter.dataType !== "categorical") return err(fieldNotAnalyzableError(describeRef(query.filter)));
  if (refKey(query.field) === refKey(query.filter)) return err(sameFieldAsFilterError());

  return ok({ field, filter });
}

// Time-series mode (docs/ANALYTICS.md §5): `data` is pre-loaded by the caller (analyticsService.ts).
export function aggregateTimeSeries(
  query: TimeSeriesQuery,
  registry: AnalyticsFieldMeta[],
  data: TimeSeriesDataset,
  audience: DisclosureAudience
): Result<TimeSeriesResult, ValidationError> {
  const validated = validateTimeSeriesQuery(query, registry);
  if (!validated.ok) return validated;
  const { field } = validated.value;

  if (query.patientId) return ok(singlePatientTimeSeries(field, data));
  return ok(cohortTimeSeries(field, data, audience));
}
