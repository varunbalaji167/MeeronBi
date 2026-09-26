// Composes the field registry, the repository, and aggregate.ts into the one entry point
// callers (the API route) use to run a cohort analytics query.

import { Result } from "@/domain/result";
import { AnalyticsQuery, AnalyticsResult, TimeSeriesQuery, TimeSeriesResult } from "@/domain/analytics/types";
import { getAnalyticsFieldRegistry } from "@/domain/analytics/fieldRegistry";
import { DisclosureAudience } from "@/domain/analytics/disclosureControl";
import { buildAnalyticsAuditPayload, buildTimeSeriesAuditPayload } from "@/domain/analytics/auditPayload";
import { ValidationError } from "@/server/http/errors";
import { requireAdminSessionForPatient } from "@/server/auth/guards";
import { aggregate, aggregateTimeSeries, refKey, validateCohortQuery, validateTimeSeriesQuery } from "./aggregate";
import { loadCohortDataset, loadCohortTimeSeriesData, loadPatientTimeSeriesData, tabKeysForQuery } from "./analyticsRepository";
import { logAnalyticsQuery } from "./analyticsAudit";
import type { Session } from "next-auth";

export interface AnalyticsScope {
  /** Omitted = every facility (SUPER_ADMIN/RESEARCHER); present = pinned to one (ADMIN). */
  facilityId?: string;
  audience: DisclosureAudience;
}

// Pure function of `{ role, facilityId }`. ADMIN is pinned to its own facility; SUPER_ADMIN and
// RESEARCHER see every facility, at different disclosure thresholds (`MIN_CELL_SIZE`).
export function resolveAnalyticsScope(user: { role: string; facilityId: string }): AnalyticsScope {
  if (user.role === "ADMIN") return { facilityId: user.facilityId, audience: "internal" };
  if (user.role === "RESEARCHER") return { audience: "researcher" };
  return { audience: "internal" }; // SUPER_ADMIN — the only other role requireAnalyticsSession allows through
}

// Validates the query before touching the database, then loads only the tabs it needs and dispatches to `aggregate`.
export async function runCohortAnalytics(query: AnalyticsQuery, session: Session): Promise<Result<AnalyticsResult, ValidationError>> {
  const registry = getAnalyticsFieldRegistry();

  const validated = validateCohortQuery(query, registry);
  if (!validated.ok) return validated;

  const { facilityId, audience } = resolveAnalyticsScope(session.user);
  const tabKeys = tabKeysForQuery(query, registry);
  const dataset = await loadCohortDataset({ facilityId, tabKeys });

  const result = aggregate(query, registry, dataset, audience);
  if (result.ok) {
    const payload = buildAnalyticsAuditPayload({
      field: refKey(query.field),
      filter: query.filter ? refKey(query.filter) : null,
      scope: facilityId ?? "all",
      result: result.value,
    });
    // Awaited (not fire-and-forget) so it completes before the serverless response ends, but
    // logAnalyticsQuery never throws — see its own comment.
    await logAnalyticsQuery({ facilityId: session.user.facilityId, actorUserId: session.user.id, payload });
  }

  return result;
}

// Time-series counterpart of `runCohortAnalytics`. Single-patient mode is re-guarded with
// `requireAdminSessionForPatient` — a RESEARCHER must never reach one patient's own trend line.
export async function runTimeSeriesAnalytics(query: TimeSeriesQuery, session: Session): Promise<Result<TimeSeriesResult, ValidationError>> {
  const registry = getAnalyticsFieldRegistry();

  const validated = validateTimeSeriesQuery(query, registry);
  if (!validated.ok) return validated;
  const { filter } = validated.value;

  let data;
  let facilityId: string | undefined;
  let audience: DisclosureAudience;

  if (query.patientId) {
    const patientSession = await requireAdminSessionForPatient(query.patientId);
    facilityId = patientSession.user.role === "SUPER_ADMIN" ? undefined : patientSession.user.facilityId;
    audience = "internal"; // single-patient mode has nothing to suppress — it's the one patient's own data
    const patientData = await loadPatientTimeSeriesData({ patientId: query.patientId, field: query.field, facilityId });
    data = patientData ? [patientData] : [];
  } else {
    ({ facilityId, audience } = resolveAnalyticsScope(session.user));
    data = await loadCohortTimeSeriesData({ field: query.field, filter: filter?.ref, facilityId });
  }

  const result = aggregateTimeSeries(query, registry, data, audience);
  if (result.ok) {
    const payload = buildTimeSeriesAuditPayload({
      field: refKey(query.field),
      filter: query.filter ? refKey(query.filter) : null,
      scope: query.patientId ? `patient:${query.patientId}` : (facilityId ?? "all"),
      result: result.value,
    });
    await logAnalyticsQuery({ facilityId: session.user.facilityId, actorUserId: session.user.id, payload });
  }

  return result;
}
