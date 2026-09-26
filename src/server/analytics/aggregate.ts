// SKELETON — locks in the validated, tested contract for the Analytics aggregation branches
// (docs/ANALYTICS_PLAN.md §2, §5) before their bodies are written. Every branch below is real,
// tested field-validation logic; every branch's actual statistics/bucketing body is deliberately
// `throw new Error("not yet implemented")` — that's the follow-up plan's job (see
// docs/FOUNDATION_PLAN.md Workstream C item 15 and docs/NEXT_STEPS.md).

import { Result, ok, err } from "@/domain/result";
import { AnalyticsFieldMeta, AnalyticsQuery, AnalyticsResult, FieldRef, TimeSeriesQuery, TimeSeriesResult } from "@/domain/analytics/types";
import { ValidationError } from "@/server/http/errors";
import { fieldNotAnalyzableError, sameFieldAsFilterError, unknownFieldError, unknownFilterError } from "./errors";

function refKey(ref: FieldRef): string {
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
function describeRef(ref: FieldRef): string {
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

/**
 * Field/filter validation shared by every cohort-mode branch: both refs must be in the registry,
 * neither can be `multiValue` (those are time-series-only, see `aggregateTimeSeries`), and the
 * filter can't be the same field as what's being analyzed.
 */
function validateCohortQuery(
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

// --- The six branches (docs/ANALYTICS_PLAN.md §2) — one per Field/Filter data-type pairing. ---

/** Ratio field, no filter: central tendencies + bucketed histogram/Standard-Segment breakdown. */
function ratioNoFilter(_field: AnalyticsFieldMeta): Result<AnalyticsResult, ValidationError> {
  throw new Error("not yet implemented");
}

/** Ratio field, Ratio filter: scatter plot. */
function ratioByRatio(_field: AnalyticsFieldMeta, _filter: AnalyticsFieldMeta): Result<AnalyticsResult, ValidationError> {
  throw new Error("not yet implemented");
}

/** Ratio field, Categorical filter: per-category central tendencies. */
function ratioByCategory(_field: AnalyticsFieldMeta, _filter: AnalyticsFieldMeta): Result<AnalyticsResult, ValidationError> {
  throw new Error("not yet implemented");
}

/** Categorical field, no filter: count + percent per distinct value. */
function categoryNoFilter(_field: AnalyticsFieldMeta): Result<AnalyticsResult, ValidationError> {
  throw new Error("not yet implemented");
}

/** Categorical field, Categorical filter: cross-tab of counts. */
function categoryByCategory(_field: AnalyticsFieldMeta, _filter: AnalyticsFieldMeta): Result<AnalyticsResult, ValidationError> {
  throw new Error("not yet implemented");
}

/** Categorical field, Ratio filter: bucket the ratio filter into a Standard Segment/histogram first, then treat as Categorical x Categorical. */
function categoryByRatio(_field: AnalyticsFieldMeta, _filter: AnalyticsFieldMeta): Result<AnalyticsResult, ValidationError> {
  throw new Error("not yet implemented");
}

/**
 * Validates the query against the field registry, then dispatches to the branch dictated by the
 * decision matrix. Returns the validation error immediately if the query is malformed; otherwise
 * delegates to the matching (not-yet-implemented) branch.
 */
export function aggregate(query: AnalyticsQuery, registry: AnalyticsFieldMeta[]): Result<AnalyticsResult, ValidationError> {
  const validated = validateCohortQuery(query, registry);
  if (!validated.ok) return validated;
  const { field, filter } = validated.value;

  if (field.dataType === "ratio" && !filter) return ratioNoFilter(field);
  if (field.dataType === "ratio" && filter?.dataType === "ratio") return ratioByRatio(field, filter);
  if (field.dataType === "ratio" && filter?.dataType === "categorical") return ratioByCategory(field, filter);
  if (field.dataType === "categorical" && !filter) return categoryNoFilter(field);
  if (field.dataType === "categorical" && filter?.dataType === "categorical") return categoryByCategory(field, filter);
  return categoryByRatio(field, filter as AnalyticsFieldMeta); // only remaining case: categorical field, ratio filter
}

/**
 * Time-series mode (docs/ANALYTICS_PLAN.md §5): a `multiValue` field bucketed into
 * Pre-pregnancy/T1/T2/T3 by entry date, either for one patient or averaged per filter category.
 * `field` here is expected to be `multiValue` (the opposite of the cohort-mode branches above) —
 * that's exactly what makes it time-series-only.
 */
export function aggregateTimeSeries(query: TimeSeriesQuery, registry: AnalyticsFieldMeta[]): Result<TimeSeriesResult, ValidationError> {
  const field = findFieldMeta(registry, query.field);
  if (!field) return err(unknownFieldError(describeRef(query.field)));

  if (query.filter) {
    const filter = findFieldMeta(registry, query.filter);
    if (!filter) return err(unknownFilterError(describeRef(query.filter)));
    if (filter.dataType !== "categorical") return err(fieldNotAnalyzableError(describeRef(query.filter)));
    if (refKey(query.field) === refKey(query.filter)) return err(sameFieldAsFilterError());
  }

  throw new Error("not yet implemented");
}
