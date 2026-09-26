# ADR 0001: Facility as the tenant boundary

Status: Accepted

Date: 2026-09-26 (backfilled — the decision itself predates this ADR log;
see `docs/SCALING_PLAN.md`'s "Update" note under §3 for when it actually
landed)

## Context

MeeronBi started as a single-hospital tool but is explicitly built to grow
to many facilities, states, and eventually countries
(`CLAUDE.md`/`docs/SCALING_PLAN.md`'s North Star). Before that growth,
nothing in the schema distinguished "which facility does this patient/user
belong to" — every table implicitly assumed one hospital. That's the kind
of decision that's cheap to make correctly before real multi-tenant data
exists and genuinely painful to retrofit after (a silent cross-facility
data leak is a worse failure mode to discover in production than almost
anything else this project could ship).

## Decision

Introduce a `Facility` model (`prisma/schema.prisma`) as the tenant
boundary, and scope every table that touches patient or user data through
`facilityId` — `User`, `Patient`, `TabFieldPreference`, and now
`AuditLog`. Every write path taking a `patientId` goes through
`requireAdminSessionForPatient` (`server/auth/guards.ts`), not the bare
`requireAdminSession`, because the latter only checks role, not facility
ownership. A cross-facility access attempt reports `NotFoundError`, never
`ForbiddenError` — deliberately not confirming to an unauthorized caller
that the resource exists at all in another tenant.

## Alternatives considered

- **Separate database per facility.** Stronger isolation, but far more
  operational overhead (migrations, connection pooling, cross-facility
  reporting all need a fan-out layer) for a benefit this project doesn't
  need yet — no facility-count or compliance requirement currently
  demands physical database separation. Revisit only if a specific
  jurisdiction's data-residency rule forces it.
- **No explicit tenant column, rely on separate deployments per
  facility.** Rejected outright — doesn't scale past a handful of
  facilities operationally, and cross-facility Analytics (the entire
  point of the Analytics feature) becomes impossible without a shared
  schema.
- **Row-level security at the database layer instead of
  application-layer guards.** MySQL's RLS support is weaker than
  Postgres's; the application-layer guard (`requireAdminSessionForPatient`)
  was judged more auditable and easier to unit-test in this stack, at the
  cost of needing discipline that every new query actually calls it.

## Consequences

**Easier**: multi-facility rollout needs no schema migration when it
happens — the model has been there since before there was a second
facility to test it against. Analytics' cross-facility aggregation
(`docs/ANALYTICS_PLAN.md`) is a natural query shape on top of this, not a
retrofit. `ResearcherProfile`'s approval flow and the public trends page
both compose cleanly with facility scoping already in place.

**Harder / trade-offs accepted**: every new repository function and every
new query anywhere in `server/` must remember to scope by `facilityId` —
there's no database-enforced backstop if a developer forgets (see the
RLS alternative above). This is a discipline cost, mitigated by
`CLAUDE.md`'s non-negotiable rule #1 and by `requireAdminSessionForPatient`
being the only sanctioned entry point for patient-scoped writes, but it
remains a manual invariant rather than one the schema itself enforces.

## Revisit trigger

If a specific target jurisdiction's data-residency law requires physical
database separation per facility/region, revisit the "separate database"
alternative above with real requirements in hand.
