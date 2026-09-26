"use client";

import { Suspense, useState } from "react";
import { Waypoints } from "lucide-react";
import { AnalyticsFieldMeta, TimeSeriesResult } from "@/domain/analytics/types";
import { toApiError } from "@/lib/apiClient";
import { createResource } from "@/lib/suspenseResource";
import { resetAnalyticsFields, useAnalyticsFields, useTimeSeriesFields } from "@/hooks/useAnalyticsFields";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import FieldPicker, { fieldRefKey } from "./FieldPicker";
import FilterPicker from "./FilterPicker";
import PatientPicker, { PatientOption } from "./PatientPicker";
import TimeSeriesChart from "./TimeSeriesChart";
import { FieldPickerSkeleton, ResultSkeleton } from "./AnalyticsSkeletons";

type TimeSeriesSubMode = "patient" | "cohort";

const SUB_MODE_OPTIONS: { key: TimeSeriesSubMode; label: string }[] = [
  { key: "patient", label: "One patient" },
  { key: "cohort", label: "Cohort by filter" },
];

/** Stable cache/remount key for a field + (patient or filter) request. */
function requestKey(field: AnalyticsFieldMeta, patient: PatientOption | null, filter: AnalyticsFieldMeta | null): string {
  if (patient) return `${fieldRefKey(field)}|patient:${patient.id}`;
  return filter ? `${fieldRefKey(field)}|filter:${fieldRefKey(filter)}` : fieldRefKey(field);
}

async function fetchTimeSeriesResult(
  field: AnalyticsFieldMeta,
  patient: PatientOption | null,
  filter: AnalyticsFieldMeta | null
): Promise<TimeSeriesResult> {
  const res = await fetch("/api/analytics/timeseries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field: field.ref, patientId: patient?.id, filter: filter?.ref }),
  });
  if (!res.ok) throw await toApiError(res, "Failed to run this query.");
  return res.json();
}

// Same rationale as AnalyticsWorkbench's cohortResultCache: an external, keyed cache so a
// suspended render retried by React never re-fires the fetch.
const timeSeriesResultCache = new Map<string, ReturnType<typeof createResource<TimeSeriesResult>>>();

function getTimeSeriesResource(field: AnalyticsFieldMeta, patient: PatientOption | null, filter: AnalyticsFieldMeta | null) {
  const key = requestKey(field, patient, filter);
  let resource = timeSeriesResultCache.get(key);
  if (!resource) {
    resource = createResource(fetchTimeSeriesResult(field, patient, filter));
    timeSeriesResultCache.set(key, resource);
  }
  return resource;
}

function resetTimeSeriesResource(field: AnalyticsFieldMeta, patient: PatientOption | null, filter: AnalyticsFieldMeta | null): void {
  timeSeriesResultCache.delete(requestKey(field, patient, filter));
}

/** Time-series mode: pick a `multiValue` field, then either one patient's trend or a cohort trend averaged per filter category. */
export default function TimeSeriesPanel() {
  const [field, setField] = useState<AnalyticsFieldMeta | null>(null);
  const [subMode, setSubMode] = useState<TimeSeriesSubMode>("patient");
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [filter, setFilter] = useState<AnalyticsFieldMeta | null>(null);

  function chooseField(next: AnalyticsFieldMeta) {
    setField(next);
    if (filter && fieldRefKey(filter) === fieldRefKey(next)) setFilter(null);
  }

  function chooseSubMode(next: TimeSeriesSubMode) {
    setSubMode(next);
    setPatient(null);
    setFilter(null);
  }

  // Cohort sub-mode always needs its filter chosen (it's how patients are split into series);
  // single-patient sub-mode always needs its patient chosen.
  const ready = field !== null && (subMode === "patient" ? patient !== null : filter !== null);

  return (
    <div className="space-y-6">
      <div className="panel space-y-4">
        <ErrorBoundary fallbackMessage="Failed to load fields." onRetry={resetAnalyticsFields}>
          <Suspense fallback={<FieldPickerSkeleton />}>
            <TimeSeriesFieldPicker value={field} onChange={chooseField} />
          </Suspense>
        </ErrorBoundary>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">View</label>
          <div className="flex w-fit items-center gap-1 rounded-full border border-line p-0.5">
            {SUB_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => chooseSubMode(opt.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  subMode === opt.key ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:text-brand-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {field && subMode === "patient" && <PatientPicker value={patient} onChange={setPatient} />}

        {field && subMode === "cohort" && (
          <ErrorBoundary fallbackMessage="Failed to load fields.">
            <Suspense fallback={<FieldPickerSkeleton />}>
              <CategoricalFilterPicker value={filter} onChange={setFilter} excludeField={field} />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {ready && field && (
        // Keying on the field+patient/filter remounts this whole subtree on every new pick — a
        // fresh resource, a fresh Suspense fallback, and a cleared error boundary, all for free.
        <ErrorBoundary
          key={requestKey(field, patient, filter)}
          fallbackMessage="Failed to run this query."
          onRetry={() => resetTimeSeriesResource(field, patient, filter)}
        >
          <Suspense fallback={<ResultSkeleton />}>
            <TimeSeriesResultView field={field} patient={patient} filter={filter} subMode={subMode} />
          </Suspense>
        </ErrorBoundary>
      )}

      {!ready && (
        <div className="panel flex flex-col items-center gap-2 py-12 text-center">
          <Waypoints className="h-8 w-8 text-brand-300" />
          <p className="font-display text-lg italic text-ink">Follow a trend across pregnancy</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Pick a repeated-measurement field — like TSH or visit weight — then {subMode === "patient" ? "a patient" : "a category to group by"} to
            see it change trimester by trimester.
          </p>
        </div>
      )}
    </div>
  );
}

/** Suspends on the field registry, restricted to multiValue (grid/repeating) fields — the ones eligible for time-series mode. */
function TimeSeriesFieldPicker({ value, onChange }: { value: AnalyticsFieldMeta | null; onChange: (field: AnalyticsFieldMeta) => void }) {
  const fields = useTimeSeriesFields();
  return (
    <FieldPicker
      fields={fields}
      value={value}
      onChange={onChange}
      label="Field to track"
      placeholder="Search repeated-measurement fields (e.g. TSH, weight)..."
    />
  );
}

/** Suspends on the field registry, restricted to categorical fields — the only valid cohort grouping for time-series. */
function CategoricalFilterPicker({
  value,
  onChange,
  excludeField,
}: {
  value: AnalyticsFieldMeta | null;
  onChange: (field: AnalyticsFieldMeta | null) => void;
  excludeField: AnalyticsFieldMeta;
}) {
  const fields = useAnalyticsFields().filter((f) => f.dataType === "categorical");
  return (
    <FilterPicker
      fields={fields}
      value={value}
      onChange={onChange}
      excludeField={excludeField}
      label="Group by (category)"
      placeholder="Search categorical fields..."
    />
  );
}

/** Suspends on the cached time-series query resource for this field + patient/filter. */
function TimeSeriesResultView({
  field,
  patient,
  filter,
  subMode,
}: {
  field: AnalyticsFieldMeta;
  patient: PatientOption | null;
  filter: AnalyticsFieldMeta | null;
  subMode: TimeSeriesSubMode;
}) {
  const result = getTimeSeriesResource(field, patient, filter).read();

  return (
    <div className="animate-rise-in space-y-3">
      <TimeSeriesChart field={field} result={result} />
      {subMode === "cohort" && (
        <p className="text-xs text-ink-faint">Categories with too few patients to protect privacy aren&apos;t shown.</p>
      )}
    </div>
  );
}
