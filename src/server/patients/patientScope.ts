export interface PatientScopeSession {
  role: string;
  facilityId: string;
}

// ADMIN is always pinned to its own facility; SUPER_ADMIN may narrow to a requested facility or
// see all (`undefined`). Never trust a client-supplied facilityId for a non-super-admin.
export function resolvePatientListScope(
  session: PatientScopeSession,
  requestedFacilityId?: string
): string | undefined {
  if (session.role === "SUPER_ADMIN") {
    return requestedFacilityId ?? undefined;
  }
  return session.facilityId;
}
