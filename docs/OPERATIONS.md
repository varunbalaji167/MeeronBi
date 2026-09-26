# Operations — backup/restore, hosting

Status: **placeholder + decision criteria, not a finished policy.** This
project stores health records; "we'll figure out backups later" is not an
acceptable answer once real patient data exists, so this file exists to
force the decision to be made deliberately rather than never — but faking
specifics (a fabricated RPO number, a hosting provider picked without
actually comparing it against the requirements below) would be worse than
an honest placeholder. Fill in (a)/(b)/(c) below when a hosting decision
is made, then delete the `TODO` and this status line.

## (a) Requirements this project needs

These are the questions a real policy has to answer — not yet answered
here, but named so the eventual answer has a checklist to satisfy:

- **RPO (Recovery Point Objective)** — how much data can we afford to
  lose in the worst case? For antenatal-care records, a day's worth of
  lost visit data is a real clinical/compliance problem, not just an
  inconvenience — this likely wants to be measured in hours, not days,
  once there's real patient load. Not yet decided.
- **RTO (Recovery Time Objective)** — how long can the app be down while
  a restore happens? Depends on whether there's ever an on-call
  expectation for this project; not yet decided.
- **Retention** — how long are backups kept? Needs to satisfy both "can
  we recover from a bad migration/bug noticed weeks later" and any
  data-retention rule a future data-use agreement or health-records
  regulation imposes. Not yet decided — likely 30 days as a starting
  default, revisited once a specific jurisdiction's health-records
  retention rules are reviewed (see `docs/SCALING_PLAN.md`'s
  per-target-jurisdiction compliance trigger).
- **Restore-test cadence** — an untested backup is a hope, not a backup.
  Whatever provider is chosen, a real restore (to a scratch instance, not
  production) needs to happen on a schedule and the result needs to be
  checked against expected row counts / a checksum, not just "the restore
  command exited 0". Suggested starting cadence: quarterly. Not yet
  scheduled anywhere (no CI job, no calendar reminder) — this is the
  single biggest gap in this file.

## (b) Managed-MySQL shortlist and trade-offs

Not a recommendation of one option — a shortlist to pick from once (a)'s
answers are pinned down, since the right choice depends on the RPO/RTO
numbers above more than on this table alone.

| Option | Trade-off |
|---|---|
| **PlanetScale** | Best developer experience (branching, non-blocking schema changes, generous free tier) — but no foreign-key constraints (Vitess limitation), which cuts against this schema's current FK-heavy design (`Facility`/`User`/`Patient`/`AuditLog` all relate via real FKs today). Migrating to it later would mean either dropping FK enforcement to the application layer or accepting Vitess's constraints, not a small decision. |
| **AWS RDS for MySQL** | Full control over backup windows, retention, multi-AZ failover, point-in-time recovery — but the most ops-heavy of the shortlist: patching, parameter groups, and monitoring are the team's responsibility, not the provider's. Reasonable if there's already AWS infrastructure elsewhere; a heavier first choice otherwise. |
| **DigitalOcean Managed MySQL** | Good middle ground — automated daily backups with point-in-time recovery included by default, standard MySQL (no Vitess-style FK gap), simpler pricing/ops surface than RDS. Currently the most likely default absent a reason to prefer one of the others, but not yet chosen. |
| **Self-hosted MySQL** | **Do not.** Backup/restore, patching, and failover all become this project's problem with no managed safety net, for a workload (health records, small team) where that trade is never worth it at this stage. Only reconsider if a specific, unusual constraint (data-residency requirement no managed provider satisfies) forces it — and even then, treat it as a last resort. |

## (c) Status

`TODO: revisit once hosting is chosen.` No provider has been selected
yet; this project currently runs against whatever MySQL instance a given
developer/session has configured locally (see `README`'s setup steps).
Nothing here is wired into an actual backup schedule, restore test, or
monitoring alert today.

---

Related: `docs/SCALING_PLAN.md`'s Phase 0 checklist tracks "documented
backup/restore policy" against this file; `docs/NEXT_STEPS.md` has the
current overall done/not-done state this file's `TODO` fits into.
