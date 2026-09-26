import { AnalyticsFieldMeta } from "@/domain/analytics/types";
import { toApiError } from "@/lib/apiClient";
import { createResource } from "@/lib/suspenseResource";

async function fetchFields(): Promise<AnalyticsFieldMeta[]> {
  const res = await fetch("/api/analytics/fields");
  if (!res.ok) throw await toApiError(res, "Failed to load fields.");
  const json = await res.json();
  return json.fields as AnalyticsFieldMeta[];
}

// Module-level singleton: the field registry is the same for the whole session, so every caller
// (either picker, the quick-pick chips) suspends on the one fetch instead of each firing their own.
let resource: ReturnType<typeof createResource<AnalyticsFieldMeta[]>> | null = null;

function useAllAnalyticsFields(): AnalyticsFieldMeta[] {
  if (!resource) resource = createResource(fetchFields());
  return resource.read();
}

// Suspends until the field registry loads; throws on failure. Excludes `multiValue` fields —
// those are time-series-only (see `useTimeSeriesFields`).
export function useAnalyticsFields(): AnalyticsFieldMeta[] {
  return useAllAnalyticsFields().filter((f) => !f.multiValue);
}

/** Same registry, restricted to `multiValue` fields — the time-series picker's field list (the opposite of `useAnalyticsFields`). */
export function useTimeSeriesFields(): AnalyticsFieldMeta[] {
  return useAllAnalyticsFields().filter((f) => f.multiValue);
}

/** Clears the cached fetch so the next render tries again — call from an ErrorBoundary's retry. */
export function resetAnalyticsFields(): void {
  resource = null;
}
