"use client";

import { Suspense, useMemo, useState } from "react";
import { Telescope, Sparkles, Wand2 } from "lucide-react";
import { AnalyticsFieldMeta, AnalyticsResult } from "@/domain/analytics/types";
import { toApiError } from "@/lib/apiClient";
import { createResource } from "@/lib/suspenseResource";
import { useAnalyticsFields, resetAnalyticsFields } from "@/hooks/useAnalyticsFields";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import FieldPicker, { fieldRefKey } from "./FieldPicker";
import FilterPicker from "./FilterPicker";
import ResultChart from "./ResultChart";
import TimeSeriesPanel from "./TimeSeriesPanel";
import { FieldPickerSkeleton, ResultSkeleton } from "./AnalyticsSkeletons";

type WorkbenchMode = "cohort" | "timeSeries";

const MODE_OPTIONS: { key: WorkbenchMode; label: string }[] = [
  { key: "cohort", label: "Cohort" },
  { key: "timeSeries", label: "Time-series" },
];

/** A few broadly-interesting fields, offered as one-click starting points rather than making people hunt the picker first. */
const QUICK_PICK_LABELS = ["Age", "BMI", "10. Height (in Cm)", "13. Religion"];

/** Stable cache/remount key for a field+optional-filter pair. */
function queryKey(field: AnalyticsFieldMeta, filter: AnalyticsFieldMeta | null): string {
  return filter ? `${fieldRefKey(field)}|${fieldRefKey(filter)}` : fieldRefKey(field);
}

async function fetchCohortResult(field: AnalyticsFieldMeta, filter: AnalyticsFieldMeta | null): Promise<AnalyticsResult> {
  const res = await fetch("/api/analytics/cohort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field: field.ref, filter: filter?.ref }),
  });
  if (!res.ok) throw await toApiError(res, "Failed to run this query.");
  return res.json();
}

// Keyed by field(+filter), outside React state entirely — `useMemo` alone isn't a safe cache for a
// Suspense resource: React (in Strict Mode, at least) can re-invoke a suspended component's
// render multiple times while it's pending, and each call recomputed a fresh `useMemo` value,
// re-firing the fetch every time (confirmed live: one query fired 500+ duplicate POSTs). An
// external cache, like `useAnalyticsFields`'s module-level singleton, is invoked idempotently
// no matter how many times React (re)tries the render.
const cohortResultCache = new Map<string, ReturnType<typeof createResource<AnalyticsResult>>>();

function getCohortResource(field: AnalyticsFieldMeta, filter: AnalyticsFieldMeta | null) {
  const key = queryKey(field, filter);
  let resource = cohortResultCache.get(key);
  if (!resource) {
    resource = createResource(fetchCohortResult(field, filter));
    cohortResultCache.set(key, resource);
  }
  return resource;
}

/** Clears one field(+filter)'s cached result so the next render retries the fetch — a failed resource caches its error forever otherwise. */
function resetCohortResource(field: AnalyticsFieldMeta, filter: AnalyticsFieldMeta | null): void {
  cohortResultCache.delete(queryKey(field, filter));
}

/** The shared analytics workbench mounted at both /researcher and /admin/analytics: a Cohort/Time-series mode toggle over the corresponding panel. */
export default function AnalyticsWorkbench() {
  const [mode, setMode] = useState<WorkbenchMode>("cohort");

  return (
    <div className="space-y-6">
      <div className="flex w-fit items-center gap-1 rounded-full border border-line p-0.5">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMode(opt.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === opt.key ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:text-brand-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "cohort" ? <CohortPanel /> : <TimeSeriesPanel />}
    </div>
  );
}

/** Cohort mode (Steps 07/10): pick a field, optionally a filter, and get one of the six decision-matrix results. */
function CohortPanel() {
  const [field, setField] = useState<AnalyticsFieldMeta | null>(null);
  const [filter, setFilter] = useState<AnalyticsFieldMeta | null>(null);

  function chooseField(next: AnalyticsFieldMeta) {
    setField(next);
    // A filter equal to the new field is no longer valid to keep selected (excludeKey would
    // already stop this from being picked going forward, but a previously-chosen filter can go
    // stale when the *field* changes out from under it).
    if (filter && fieldRefKey(filter) === fieldRefKey(next)) setFilter(null);
  }

  return (
    <div className="space-y-6">
      <div className="animate-rise-in panel space-y-4">
        <ErrorBoundary fallbackMessage="Failed to load fields." onRetry={resetAnalyticsFields}>
          <Suspense fallback={<FieldPickerSkeleton />}>
            <CohortFieldPicker value={field} onChange={chooseField} />
          </Suspense>
        </ErrorBoundary>

        {field && (
          <ErrorBoundary fallbackMessage="Failed to load fields.">
            <Suspense fallback={<FieldPickerSkeleton />}>
              <CohortFilterPicker value={filter} onChange={setFilter} excludeField={field} />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {field && (
        // Keying on the field+filter remounts this whole subtree on every new pick — a fresh
        // resource, a fresh Suspense fallback, and a cleared error boundary, all for free.
        <ErrorBoundary
          key={queryKey(field, filter)}
          fallbackMessage="Failed to run this query."
          onRetry={() => resetCohortResource(field, filter)}
        >
          <Suspense fallback={<ResultSkeleton />}>
            <CohortResult field={field} filter={filter} />
          </Suspense>
        </ErrorBoundary>
      )}

      {!field && (
        <div className="animate-rise-in panel flex flex-col items-center gap-2 py-12 text-center" style={{ animationDelay: "80ms" }}>
          <Telescope className="h-8 w-8 text-brand-300" />
          <p className="font-display text-lg italic text-ink">Let&apos;s go exploring</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Pick a field above — or tap one of the quick suggestions — and watch the aggregate story unfold.
          </p>
        </div>
      )}
    </div>
  );
}

/** Suspends on the field registry (cohort-eligible fields only); pairs the picker with the quick-pick chips so both share one Suspense/ErrorBoundary. */
function CohortFieldPicker({ value, onChange }: { value: AnalyticsFieldMeta | null; onChange: (f: AnalyticsFieldMeta) => void }) {
  const fields = useAnalyticsFields();
  return (
    <>
      <FieldPicker fields={fields} value={value} onChange={onChange} label="Field to analyze" />
      <QuickPicks fields={fields} selected={value} onSelect={onChange} />
    </>
  );
}

/** Suspends on the field registry for the optional filter field. */
function CohortFilterPicker({
  value,
  onChange,
  excludeField,
}: {
  value: AnalyticsFieldMeta | null;
  onChange: (f: AnalyticsFieldMeta | null) => void;
  excludeField: AnalyticsFieldMeta;
}) {
  const fields = useAnalyticsFields();
  return <FilterPicker fields={fields} value={value} onChange={onChange} excludeField={excludeField} />;
}

/** One-click starting points, sourced from the same field list as CohortFieldPicker (no extra fetch — same cached resource). */
function QuickPicks({
  fields,
  selected,
  onSelect,
}: {
  fields: AnalyticsFieldMeta[];
  selected: AnalyticsFieldMeta | null;
  onSelect: (f: AnalyticsFieldMeta) => void;
}) {
  const quickPicks = useMemo(() => fields.filter((f) => QUICK_PICK_LABELS.includes(f.label)), [fields]);

  if (quickPicks.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-ink-faint">
        <Wand2 className="h-3 w-3" /> Try:
      </span>
      {quickPicks.map((f) => {
        const active = selected && fieldRefKey(selected) === fieldRefKey(f);
        return (
          <button
            key={fieldRefKey(f)}
            type="button"
            onClick={() => onSelect(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-line text-ink-soft hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {f.label.replace(/^\d+\.\s*/, "")}
          </button>
        );
      })}
    </div>
  );
}

/** Suspends on the cached cohort-query resource for this field(+filter). */
function CohortResult({ field, filter }: { field: AnalyticsFieldMeta; filter: AnalyticsFieldMeta | null }) {
  const result = getCohortResource(field, filter).read();

  return (
    <div className="animate-rise-in space-y-4" style={{ animationDelay: "80ms" }}>
      <ResultSummary field={field} filter={filter} result={result} />
      <ResultChart field={field} filter={filter} result={result} />
    </div>
  );
}

/** A one-line, delighted-to-share-it summary above the chart — every number here is already in the API response. */
function ResultSummary({ field, filter, result }: { field: AnalyticsFieldMeta; filter: AnalyticsFieldMeta | null; result: AnalyticsResult }) {
  const count =
    result.kind === "ratioSummary"
      ? result.stats.count
      : result.kind === "categorySummary"
        ? result.breakdown.reduce((sum, b) => sum + b.count, 0)
        : undefined;
  if (count === undefined || count === 0) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-brand-700">
      <Sparkles className="h-4 w-4 text-gold-500" />
      Based on <span className="font-semibold">{count}</span> patient{count === 1 ? "" : "s"} with data for{" "}
      <span className="font-semibold">{field.label}</span>
      {filter && (
        <>
          {" "}
          filtered by <span className="font-semibold">{filter.label}</span>
        </>
      )}
      .
    </p>
  );
}
