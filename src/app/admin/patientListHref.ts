export interface PatientListQuery {
  page?: number;
  q?: string;
  facilityId?: string;
}

/** Canonical /admin URL for a list state; omits defaults so the bare list stays `/admin`. */
export function patientListHref({ page, q, facilityId }: PatientListQuery): string {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (facilityId) params.set("facilityId", facilityId);
  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}
