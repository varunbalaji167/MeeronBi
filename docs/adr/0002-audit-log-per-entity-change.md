# ADR 0002: Audit log as a per-entity-change table, not an event stream

Status: Accepted

Date: 2026-09-26

## Context

MeeronBi stores health records, and had no compliance-grade record of
"who changed what, when" — a real gap called out in
`docs/SCALING_PLAN.md`'s Phase 0 checklist, and the exact tool a future
researcher data-use agreement is likely to require for query/access
logging on top of record-change logging. The design question was what
shape that record should take: a row per entity mutation with a
before/after diff, versus an append-only event stream that a projection
would later reduce into current state.

## Decision

Add a single `AuditLog` table (`prisma/schema.prisma`) with one row per
mutation: `facilityId`, `actorUserId?`, `action` (an `AuditAction` enum —
`CREATE`/`UPDATE`/`DELETE`/`COMPLETE`/`APPROVE`/`REJECT`/
`PORTAL_ACCESS_SET`/`PORTAL_ACCESS_REVOKED`), `entityType`, `entityId`,
`before Json?`/`after Json?`, `requestId?`, `createdAt`, indexed on
`(facilityId, entityType, entityId)`. A single helper,
`writeAuditLog(tx, {...})` (`server/http/audit.ts`), is the only
sanctioned way to write a row, and it must be called inside the same
`prisma.$transaction` as the mutation it's recording — an audit row that
could exist without its corresponding change (or vice versa) defeats the
point of an audit log. This is why `patientRepository.ts`'s
`createPatient`/`deletePatient`/`syncPatientSummaryFromPersonal` were each
changed to wrap their write in `prisma.$transaction` as part of landing
this.

## Alternatives considered

- **Append-only event stream + projections.** The more "correct"
  event-sourcing shape for some domains, but it means every reader that
  wants current state needs a projection step, and this project's actual
  need (answer "who changed this patient's record and when", for a
  compliance/support conversation) doesn't need event replay — it needs a
  queryable diff per change. Rejected as solving a harder problem than
  the one that exists.
- **Generic JSON blob per table-row-change, no typed `action` enum.**
  Considered for simplicity, but a typed `AuditAction` enum makes "show me
  all researcher approvals this month" a plain `WHERE action = 'APPROVE'`
  query instead of parsing free-text, at negligible cost (adding an enum
  value if a new action type appears later).
- **Log to the application logger only (Sentry/structured logs), no
  dedicated table.** Rejected — logs are typically retained for a much
  shorter window than a compliance audit trail needs, and aren't
  queryable in the same way (`SELECT * FROM AuditLog WHERE
  entityId = ...` vs. grepping log aggregator output).

## Consequences

**Easier**: every mutating repository/service now has a uniform pattern
for adding audit coverage to a new call site — wrap in
`prisma.$transaction`, call `writeAuditLog` with the same `tx`. A
compliance/support question ("what happened to this patient's record on
this date") is a single indexed query, not a log-archaeology exercise.

**Harder / trade-offs accepted**: `AuditLog.requestId` is currently always
`null` (see `docs/NEXT_STEPS.md`) — threading the per-request correlation
ID from the HTTP layer into service-layer calls needs either a
handler-signature change across many call sites or `AsyncLocalStorage`,
deliberately deferred as its own follow-up rather than done as part of
this decision. Every new mutating code path must remember to route
through a transaction + `writeAuditLog` — like the tenant-scoping
discipline in ADR 0001, this is a manual invariant, not one the type
system enforces; a missed call site fails silently (no audit row, no
error) rather than loudly.

## Revisit trigger

If `AuditLog.requestId` needs to actually be populated (e.g., a
data-use-agreement audit specifically asks for request-level
traceability, not just entity-level), revisit with `AsyncLocalStorage` as
the likely mechanism — passing the ID through every call signature by hand
was already rejected once as too invasive for the workstream that added
this table.
