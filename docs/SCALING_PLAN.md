# Scaling plan — foundation for growth (one state → many countries)

Status: **Phase 0 and pulled-forward Phase 1 items landed** — see "Status
as of this writing" below for the per-item breakdown. Grounded in the
actual current schema/code, not generic advice.

> A real database connection is required to run the app: run
> `npx prisma generate` then `npx prisma migrate dev` locally before
> starting it, since the Prisma client's generated types (and the actual
> migration SQL) can't be produced without one.

**North Star** (stated explicitly, so it doesn't just live in chat
history): the goal of this project is a strong, scalable foundation —
reliable, fault-tolerant, a genuinely good experience to use, and easy for
a future collaborator to extend correctly without having to ask why
something was built a certain way. MVP scope is fine; a weak foundation
under it is not. `docs/PROJECT_INSTRUCTIONS.md` is the distilled,
paste-into-custom-instructions version of that principle plus the four
pillars below — this file is where the full reasoning behind each line of
that digest lives.

## Status as of this writing

Grounded, not aspirational — every ✅ below is a specific file, not a
vibe. ❌ items are genuinely not started.

**1. Error handling** — ✅ typed `AppError` hierarchy + `withApiErrorHandling`
+ client-side `ApiError`/`friendlyErrorMessage`; ✅ `NotFoundError` vs.
`ForbiddenError` now correctly distinguishes "doesn't exist" from "exists,
not yours" for cross-facility access; ✅ namespaced `detail:` codes applied
across `guards.ts`, `server/patients/errors.ts`, `server/auth/errors.ts`,
`server/analytics/errors.ts`; ✅ request/correlation IDs
(`withApiErrorHandling` generates one per request, returned as
`x-request-id` + JSON `requestId`, surfaced client-side as a toast
`(ref: ab12cd)`); ✅ error-tracking integration (`@sentry/nextjs`, env-gated
on `SENTRY_DSN`, true no-op when unset); ✅ React error boundaries
(`RouteErrorBoundary` under every top-level route group plus
`global-error.tsx`); ✅ `/api/health` (real DB round-trip, 503 on failure).
🟡 backup/DR policy — decision criteria and shortlist documented in
`docs/OPERATIONS.md`, but no provider chosen yet (`TODO: revisit once
hosting is chosen`). ❌ no `Result<T,E>` pattern in server/API code (it
exists in `domain/result.ts` and is used by the analytics foundation, not
yet elsewhere), no retry-with-backoff, no idempotency keys on writes.

**2. UX** — ✅ shape-matched skeletons, button loading/disabled states,
error-code-aware toasts, live-computed panels (Robson, delivery timing,
gestational-age badges), `allowOther` closed-input pattern; ✅
locale/timezone-formatting abstraction (`domain/locale.ts`, two locales:
`en-IN`/`en-US`, backed by `Facility.locale`) — note this is
date/measurement-unit *formatting* only, not full i18n. ❌ no i18n layer
(still hardcoded English strings throughout `domain/tabs/*.ts` — stays
behind the "second-language deployment concrete" trigger), no systematic
accessibility pass, no offline resilience, no component-library governance.

**3. Security & data correctness** — ✅ Facility/tenant model + scoped
guards; ✅ comprehensive `sanitizeTabData` allowlist rebuild across all
section kinds; ✅ the `requireAdminSessionForPatient` fix; ✅ `AuditLog`
table + `writeAuditLog` helper, retrofitted onto every mutating
repository/service (patient create/delete/sync, tab record save/delete,
field preferences, portal access, researcher approve/reject); ✅ rate
limiting (`server/http/rateLimit.ts`'s in-memory token bucket, applied to
researcher-access requests, public trends, and credentials login) — Phase
1 item pulled forward, non-negotiable before Analytics ships per the
differencing-attack concern in §Trends below; ✅ security headers
(`next.config.mjs`'s `headers()`, HSTS production-only, `poweredByHeader:
false` — CSP-with-nonces still deliberately deferred, its own testing
pass); ✅ `zod` at the API boundary (`server/http/parseJson.ts` — helper
landed, not yet retrofitted onto every existing route's body validation).
❌ no RBAC hierarchy beyond `SUPER_ADMIN`/`ADMIN`/`PATIENT`/`RESEARCHER`
scoped further per-region (not yet needed — single state today), no
optimistic concurrency, no soft-delete, PII-at-rest encryption unconfirmed
(trigger: per-target-country compliance review).

**4. Scale & maintainability** — ✅ Facility model doubles as the
i18n/regionalization backbone; ✅ field-visibility system already the right
shape for per-region field differences; ✅ strong documentation culture
(`ARCHITECTURE.md`, `ANALYTICS_PLAN.md`, `INPUT_HARDENING_PLAN.md`, this
file, `docs/NEXT_STEPS.md`, `docs/OPERATIONS.md`); ✅ `domain/` unit test
suite (`docs/TESTING.md`) + a GitHub Actions CI gate
(`.github/workflows/ci.yml`) running lint + a full-project typecheck + the
test suite on every push/PR; ✅ ADR log started (`docs/adr/` — template
plus two initial ADRs backfilling the Facility-as-tenant-boundary and
audit-log-per-entity-change decisions). ❌ no API versioning convention.

**A note on observability, since it spans several rows above**: every
request now carries a correlation ID from `withApiErrorHandling` through
to the structured logger (`server/http/logger.ts`) and, when configured,
Sentry — "a save failed for someone, somewhere" is debuggable today in a
way it wasn't when this plan was first written. The one known gap:
`AuditLog.requestId` is currently always `null` (threading the
per-request ID into service-layer calls needs either a handler-signature
change or `AsyncLocalStorage`, deliberately deferred — see
`docs/NEXT_STEPS.md`).

**Suggested addition to the plan**: a `RESEARCHER` role, folded into
Phase 1's RBAC work rather than treated as a separate later effort — see
the trends-page section below, which is really what prompted this. It's
the concrete shape the "regional/national admin tiers" idea in §3 needed
anyway; better to design the role hierarchy once, with a real third role in
mind, than to bolt one on after the fact.

> **Update:** this is now implemented — `prisma/schema.prisma`'s `Role`
> enum is `SUPER_ADMIN | ADMIN | PATIENT | RESEARCHER`, with a
> `ResearcherProfile` model backing a real in-app request → `PENDING` →
> SUPER_ADMIN-reviewed → `APPROVED`/`REJECTED` flow (`/researcher-access`
> to request, `/admin/researchers` to review). `requireResearcherSession()`
> in `server/auth/guards.ts` re-checks approval status fresh from the
> database on every call — never trusts the session cookie's cached
> status — so a revoked researcher loses access immediately, not whenever
> their 30-day JWT happens to expire. No Analytics routes exist yet; this
> guard (and `domain/analytics/disclosureControl.ts`,
> `domain/result.ts`, and the namespaced error-code convention in
> `server/http/errors.ts`) were all built as foundation *before* any
> aggregation function, specifically so Analytics gets written against a
> correct shape from its first line of code rather than retrofitted later.

**Nothing recommended for removal** — everything on the original plan still
holds up; the trends-page analysis below sharpens §3's existing (and,
until now, fairly brief) note about it rather than replacing anything.

## Guiding principle

**Design for 10x, build for 10x, don't implement for 1000x.** There's a
small number of decisions that are catastrophically expensive to retrofit
once real data exists — mostly "does this row know which tenant it belongs
to" and "is this error typed" — and a much larger number of decisions
(sharding, multi-region deployment, a data warehouse, microservices) that
are expensive to build and easy to get wrong when built ahead of real load
data. This plan is deliberately split that way: Phase 0 is the small list
of things to do now, before the next feature, because they're cheap today
and brutal later. Everything else is sequenced behind an actual trigger
(a second facility signing up, a second region, a specific pain point),
not built speculatively.

---

## 1. Error handling using error types

**Current state**: genuinely a good foundation already — `server/http/errors.ts`'s
`AppError` hierarchy (`UnauthorizedError`/`ForbiddenError`/`NotFoundError`/
`ValidationError`/`ConflictError`/generic 500), `withApiErrorHandling`
wrapping every route so a thrown typed error becomes the right HTTP
status + JSON shape automatically, and the client-side mirror
(`lib/apiClient.ts`'s `ApiError`/`friendlyErrorMessage`) that reads the
server's `code` back out to pick an actionable message. This is the right
shape — the gaps are about depth and observability, not the core pattern.

**Gaps and what to do about them:**

- **Error codes are a flat 6-bucket enum.** Fine for "is this a permission
  problem" branching today; not enough once there are dozens of distinct
  business rules across a growing field registry and multiple regions
  ("MRD already used", "can't delete a patient with a completed delivery",
  a country-specific validation rule). Move to namespaced, stable string
  codes — `PATIENT.MRD_DUPLICATE`, `AUTH.SESSION_EXPIRED`,
  `VALIDATION.FIELD_REQUIRED` — as a second dimension alongside the
  existing HTTP-status category. These codes are also the natural future
  i18n key: the client maps `code → localized message` instead of
  depending on the server's English message string, which matters the
  moment staff need this in more than one language (see §2).
- **No `Result<T, E>` pattern in domain logic yet.** Business-logic
  functions mostly return plain values or throw. As more contributors add
  domain rules (new tab configs, new analytics aggregations), a typed
  `Result<T, E>` return (instead of throwing) lets TypeScript's
  exhaustiveness checking force every call site to handle both outcomes —
  catches "forgot to handle the error case" at compile time instead of in
  production. Don't retrofit existing code for this; adopt it for new
  domain modules going forward (the Analytics aggregation functions in
  `docs/ANALYTICS_PLAN.md` §9 are a natural first place to use it).
- **No request/correlation ID.** Once there's real volume across multiple
  facilities, "a save failed for someone, somewhere" is undebuggable
  without one. Generate a short ID per request (in `withApiErrorHandling`
  or middleware), include it in every error JSON response and every
  server log line, and show it small/unobtrusively in the error toast
  ("error ref: ab12cd") so a support conversation has something concrete
  to search logs for.
- **No error tracking/observability integration.** Nothing today captures
  "how often does this actually fail in production" beyond what's
  manually noticed. Wire in an error-tracking service (Sentry or
  equivalent) at the `withApiErrorHandling` boundary and a top-level React
  error boundary — cheap now, expensive to realize you need after the
  first unreported outage.
- **No React error boundaries.** A render-time throw in one component
  likely takes down more of the page than it needs to today. Add a
  top-level boundary plus one per major route section (a broken Analytics
  chart shouldn't take the whole admin shell down).
- **Extend the client's network-failure handling with retry.** `ApiError`
  vs. a bare `TypeError` (request never reached the server) is already
  distinguished — good. Add automatic retry-with-backoff for idempotent
  GETs (loading a tab record), since low-connectivity settings become more
  likely, not less, as this reaches more places geographically.

**Fault tolerance specifically** (related to error typing but a distinct
concern — a well-typed error that still corrupts data on a retry hasn't
actually solved reliability):

- **No idempotency guarantee on writes yet.** A double-click on "Save as
  Draft", or a client retrying a request it wrongly believes failed
  (timeout, but the write actually landed), can't currently be
  distinguished from a genuine second save. The button-disable-on-click
  pattern already in `DynamicForm` covers the common UI case; the gap is
  server-side — a request replayed by a flaky network has no way to say
  "this is the same attempt as before." Worth an idempotency-key header on
  write routes once retry-with-backoff (above) is added — otherwise retry
  logic and duplicate-write risk trade off against each other instead of
  both being solved.
- **No defined backup/disaster-recovery story.** Nothing in this plan or
  the codebase says how often the database is backed up, how long backups
  are retained, or what an actual restore looks like. For health records
  specifically, this isn't optional — it needs an explicit answer (even a
  simple one, like "managed MySQL provider's automated daily backups,
  30-day retention, tested restore quarterly") before real patient data
  exists, not after an incident.
- **No health/readiness check.** A load balancer or uptime monitor has
  nothing to poll today to know "is this instance actually able to serve
  requests" (vs. just "is the process running") — a `/api/health` route
  that confirms a real DB round-trip, not just a 200, is cheap and becomes
  necessary the moment there's more than one server instance or an
  automated deploy pipeline.
- **Graceful degradation isn't designed for yet.** If the database is
  briefly unreachable, does the app show a clear "try again in a moment"
  state, or does it throw a raw 500 with no useful message? `withApiErrorHandling`
  already catches the unexpected-error case into a clean JSON shape (see
  above), which is most of the way there — worth explicitly testing what
  the UI actually shows a person in that moment, not just confirming the
  API response is well-formed.

---

## 2. Excellent user experience

**Current state**: already meaningfully above baseline — Tailwind design
tokens, skeletons shaped like real content (not generic spinners), button
loading states, error-code-aware toasts, live-computed panels (Robson
result, delivery timing, gestational-age badges), a real field-visibility
system. The gaps below are specifically about what breaks or becomes
expensive at multi-region/multi-country scale, not general polish.

- **No internationalization layer — and this is the single highest-leverage
  "do it now" item given the explicit country-scaling intent.** Every
  label/placeholder/`helpText` across all 7 tab configs (~140 fields) is a
  hardcoded English string baked directly into `domain/tabs/*.ts`.
  Retrofitting i18n onto that later means touching every one of those
  fields a second time, under time pressure, right when a real deployment
  needs it. Do it now, while only English is populated: every
  `label`/`placeholder`/`helpText` becomes a translation **key** resolved
  through a catalog (`next-intl` or equivalent), not a literal string.
  Zero user-visible change today (still English), but the expensive part
  (touching every field config) happens once, calmly, instead of twice
  under deadline.
- **Locale-aware formatting is hardcoded.** Date placeholders assume
  dd-mm-yyyy; height/weight assume cm/kg. Introduce a small
  `domain/locale.ts` (date formatting, unit conversion) used everywhere a
  date or measurement is displayed, so a different deployment can show
  mm/dd/yyyy and lb/in without touching business logic — same principle as
  i18n: the field configs shouldn't need to know about locale, a
  formatting layer between them and the DOM should.
- **Timezone handling is naive.** `computeGestationalAge`, delivery-timing
  classification, and friends currently use local `new Date()`. Once
  spanning timezones, "today" needs to be explicit — standardize on UTC
  storage with explicit facility-timezone-aware display, decided once,
  early, rather than discovered as an off-by-one-day bug near a facility's
  midnight boundary later.
- **No systematic accessibility pass.** Bake this into the shared `ui/`
  component library specifically (aria labels, focus management, keyboard
  nav, contrast) — one investment there beats an audit-and-patch pass
  across every page later.
- **No offline resilience.** This is a health data-collection tool that
  will plausibly run in lower-connectivity clinics as it spreads — a
  dropped connection mid-visit today just means a failed save + a retry
  toast, no local persistence. Medium-term: mirror in-progress form state
  to IndexedDB and background-sync when connectivity returns, so a nurse
  never loses an entered form to a bad connection. This is a real feature,
  not a quick win — sequenced as a Phase 2 item below, not immediate.
- **Component library governance.** The `ui/`/`forms/` split is already
  well-factored; formalize it with a short style guide (or Storybook) once
  more than one or two people are contributing, to keep that consistency
  as the team grows alongside the deployment footprint.

---

## 3. Security and correctness of data

**Current state**: NextAuth JWT sessions, server-side guards
(`requireAdminSession`/`requirePatientSession`/`assertPatientRecordAccessible`
in `server/auth/guards.ts`) correctly documented as the *real* security
boundary (client-side checks are UX-only), bcrypt password hashing, and —
as of the last pass — a comprehensive server-side sanitizer
(`sanitizeTabData`) that allowlists every field by the tab's own config.
That's a solid baseline. The gaps below are specifically what's missing
for multi-tenant, multi-region, regulated-health-data operation.

- **There is no multi-tenancy concept anywhere in the schema, and this is
  the single most expensive thing on this entire plan to retrofit later.**
  Every model (`Patient`, `User`, `TabFieldPreference`, ...) implicitly
  assumes one hospital. `TabFieldPreference` in particular is *one global
  row per tab key* — there's no facility to scope it to even if you
  wanted to. The moment a second hospital signs up, every query
  everywhere needs a tenant filter retrofitted, on live data, which is a
  genuinely risky migration to do under pressure. **Do this now, before
  there's a second facility, while it's a schema decision instead of a
  data migration:** add a `Facility` (or `Organization`) model, add
  `facilityId` to `Patient`, `User`, and `TabFieldPreference`, and scope
  every query through it — even while exactly one facility exists. A
  state/country hierarchy is then just region metadata *on* `Facility`
  (`stateCode`, `countryCode`), not a second migration.
- **RBAC is two flat roles (`ADMIN`, `PATIENT`).** A country program
  overseeing multiple state deployments, a facility admin managing their
  own hospital's staff and field customization, and a clinician who enters
  data but doesn't manage users are all genuinely different permission
  levels this will need. Don't keep adding flat enum values as tiers
  appear — move to a role **+ scope** model (`ADMIN` at facility X vs. a
  `REGIONAL_ADMIN` at state Y) once the `Facility` model from the point
  above exists, so adding a tier is a data change, not a migration.
- **No audit trail.** No record today of who changed what, when — a real
  compliance and data-integrity gap for health records at any serious
  scale, and it also happens to be the exact tool needed to investigate
  "why does this field look wrong" once there's real usage. Add an
  append-only `AuditLog` (actor, action, entity, before/after diff,
  timestamp), written on every mutating operation.
- **No optimistic concurrency control.** Two staff editing the same tab at
  the same time today silently resolves as last-write-wins. Add a
  `version`/`updatedAt`-compare check on save that rejects with a typed
  `CONFLICT` error (fits the existing error taxonomy in §1) if the record
  changed since the client loaded it — worth doing once multiple staff
  per facility is the norm, not urgent while it's one or two admins.
- **No soft-delete.** Deletes are hard/cascading today. For health
  records, an accidental or malicious delete should be recoverable, and
  several jurisdictions' health-data regulations expect a retention trail
  even past a "delete". Add `deletedAt` + exclude soft-deleted rows from
  normal queries instead of a real `DELETE`.
- **No rate limiting anywhere**, `/api/auth` included — login
  brute-forcing is trivial today. Add at the edge (middleware, or a
  Redis-backed limiter once there's more than one server instance) before
  this is internet-facing at any real scale.
- **No security headers.** `next.config.mjs` still sets nothing beyond
  `serverActions.allowedOrigins` — still a real gap once there's a
  production domain. Add the standard set (CSP, X-Frame-Options,
  Referrer-Policy, HSTS).

  > **Update:** `allowedOrigins` itself is no longer a wildcard — narrowed
  > to `NEXT_PUBLIC_APP_ORIGIN` (falling back to `localhost:3000`
  > locally), and `next` bumped from `14.2.5` to the patched `14.2.35`.
  > Both were prompted by the same discovery: the Dec 2025 Next.js
  > security advisory (CVE-2025-55183, a Server-Actions source/function
  > leak) specifically applies to apps that have opted into
  > `experimental.serverActions` — which this app has — and a wildcard
  > origin widened that CVE's exploitable surface for no real benefit.
  > The critical RCE in the same advisory batch (CVE-2025-55182,
  > CVSS 10.0) does NOT apply here — it's scoped to Next.js 14 canary
  > builds and 15/16, and this app is on a stable 14.x release. Set the
  > real env var before ever deploying this anywhere public.
- **PII/PHI at rest** (phone, DOB, address, MRD) is plain JSON today.
  Worth evaluating field-level encryption, or at minimum explicitly
  confirming the hosting database's encryption-at-rest setting rather than
  assuming it — and treating jurisdiction-specific compliance (India's
  DPDP Act, GDPR-adjacent rules, HIPAA-style regimes elsewhere) as a
  **per-target-country review**, not a single generic code change, since
  the specific requirements genuinely differ by country and this plan
  shouldn't pretend otherwise.
- **`zod` is a dependency but isn't load-bearing at the API boundary
  today.** Add it as an explicit first-line request-shape check on every
  route (cheap, fast rejection of malformed JSON) ahead of the richer,
  business-rule-aware `sanitizeTabData` — two complementary layers, not a
  replacement for either.

### The public trends page: problems, and the research-access design

`/public/trends` is unauthenticated by design, and returns aggregates only
(counts, averages, group-bys — never a patient row). That's the right
instinct, but "unauthenticated + aggregate" is not automatically safe, and
it's specifically **not sufficient for the stated goal of enabling real
research** — those are two different trust models that the current single
page conflates. Concretely, in order of severity:

1. **Small-cell re-identification.** Even a pure aggregate leaks identity
   when a bucket is small — the source spec's own sample data has a
   `Thoubal: 1` district count. Cross that against any other public fact
   (local knowledge, a news mention) and that one row is deanonymized. This
   gets *worse*, not better, once the flexible Analytics module (pick any
   field, filter by any other field — see `docs/ANALYTICS_PLAN.md`) is
   built, since chaining several individually-unremarkable filters can
   narrow a query down to n=1 even when no single filter looked risky.
2. **Differencing attacks over time.** Nothing rate-limits or logs who's
   polling this endpoint. Two snapshots taken close together let anyone
   infer facts about "whichever one record changed between them" by
   diffing every other aggregate at the same moment (an average shifting
   by a small amount after `totalPatients` ticks up by one reveals
   something about that specific new record). This is a well-known,
   textbook statistical-disclosure technique, not a theoretical concern.
3. **No identity, no audit trail, no accountability.** Real research
   access — the kind an IRB-style review or a data use agreement expects —
   requires knowing *who* accessed *what*, *when*. An anonymous public JSON
   endpoint structurally cannot provide any of that. It's fine for a
   narrow "public transparency" purpose (a headline number like "this
   program has served N mothers"); it is not a substitute for a real
   research pathway.
4. **No purpose limitation.** The data is public to whoever finds the URL
   — a researcher with legitimate purpose and, say, an insurer or employer
   scraping the same endpoint get identical access today.
5. **No reproducibility guarantee.** Live numbers that shift as new
   patients are added aren't citable — research needs a stable snapshot to
   reference, not a moving target.
6. **Cross-facility ambiguity**, once a second facility exists: should
   trends aggregate nationally, or stay per-facility? That's a governance
   decision each facility should opt into explicitly, not a silent default
   either way.

**The recommended design is three tiers, not one page trying to be both:**

- **Tier 1 — harden the existing public page for the narrow purpose it
  actually serves (public transparency, not research).** Minimum cell-size
  suppression (a standard disclosure-control convention — many public
  health agencies use k=5 or k=11; k=10 is a reasonable starting point
  here) on every breakdown; coarsen registration counts to quarterly
  instead of monthly; rate-limit the route. Keep its surface intentionally
  narrow — high-level totals and suppressed categorical splits, never the
  full field × filter Analytics engine, which is inherently more
  re-identification-prone by design and should never be reachable without
  authentication.
- **Tier 2 — a real `RESEARCHER` role for actual research access.** A
  third `Role` value alongside `ADMIN`/`PATIENT` (extends the RBAC
  hierarchy already in Phase 1), with its own guard
  (`requireResearcherSession()`, mirroring `requirePatientSession()`'s
  shape) that structurally can never reach the per-patient tab-record
  endpoints — a separate code path, not a permission flag that could be
  granted too broadly by mistake. Gets the full Analytics module, but with
  disclosure controls built into the aggregation layer itself rather than
  left to the researcher's judgment: the same cell-size suppression as
  Tier 1 (a more permissive threshold is reasonable here, since there's
  now an identified, accountable user — but still enforced, never
  optional), and the `STANDARD_SEGMENTS` bucketing already designed for
  Analytics (age bands, height bands, BMI bands, trimester-bucketed TSH)
  becomes the *default* granularity for any quasi-identifying continuous
  field — a genuine synergy: the categorization work Analytics already
  needs for UX reasons doubles as a privacy control. Every researcher
  query gets logged via the `AuditLog` table already on the Phase 0
  checklist — very likely a literal data-use-agreement requirement, not
  just good practice. Account provisioning is manual (an admin creates the
  account after an out-of-band approval — an IRB doc, a signed agreement)
  — doesn't need an automated request workflow for v1. Worth deciding a
  snapshot mechanism (a scheduled job writing periodic frozen aggregates
  to a `TrendsSnapshot` table) before real researcher access ships — it
  solves both the differencing-attack risk and the reproducibility need at
  once.
- **Tier 3 — differential privacy, once research usage is real enough to
  justify it.** The actual gold-standard technique for this exact problem
  (used by, e.g., the US Census Bureau): calibrated statistical noise added
  to aggregate results so no single individual's presence or absence in
  the dataset can be inferred, even under many repeated queries — this is
  what actually closes the differencing-attack class of problem, rather
  than just raising the bar the way cell-size suppression does. Real
  engineering lift (a privacy-budget/epsilon accounting system) — not
  worth building ahead of real usage, but worth naming now as the known
  destination rather than rediscovering it later.

---

## 4. Easy to scale and maintain

- **The `Facility` model (§3) is also the internationalization/regionalization
  backbone, not just a security fix.** The field-visibility system already
  built (`domain/fieldVisibility.ts`, "Customize fields") already answers
  "which fields does this hospital want to show" per tab — the natural
  extension is scoping that same table by `facilityId`, so different
  hospitals/regions get different defaults, and eventually different
  **countries** can have entirely different required fields (a US
  deployment's Investigation tab will legitimately need a different lab
  panel than an Indian one) as *data*, not a code fork. This is why §3's
  `Facility` addition is the load-bearing decision for this whole plan —
  most of the rest builds on it existing.
- **Keep the region hierarchy flat.** Country/state as metadata columns on
  `Facility`, not a deep normalized table tree — resist over-modeling this
  before there's a second real tenant to learn actual requirements from.
- **Testing strategy — start now, not later.** `docs/ARCHITECTURE.md`
  already correctly identifies `domain/` as the highest-value place to
  start (pure functions, zero framework setup required to test them) but
  no suite exists yet. The Robson classification, gestational-age math,
  and the sanitizer built in the last pass are exactly the kind of logic
  where a silent regression is expensive and easy to miss by eye once the
  field list is in the hundreds — write that first suite now.
- **No CI pipeline exists.** Add a baseline workflow (typecheck + lint +
  the test suite above) gating every PR, before this becomes a
  multi-contributor project spanning regions/time zones where "it worked
  on my machine" starts costing real time to untangle.
- **Decide an API versioning convention now** (`/api/v1/...`), even though
  nothing external depends on today's routes yet — cheap to decide before
  a mobile app or external integration exists, expensive to introduce
  after one does.
- **The Analytics data-fetch strategy already has its own revisit trigger
  written down** (`docs/ANALYTICS_PLAN.md` §8: fine to compute from JSON
  in Node at hospital scale, revisit at real scale) — worth calling out
  explicitly here that the trigger is specifically "regional/national
  rollups across many facilities", which is exactly the scenario this plan
  is written for. Watch it actively once §3's `Facility` model means
  cross-facility queries are a real, common request.
- **Start an ADR (Architecture Decision Record) log.** Documentation
  culture here is already unusually good for the project's size
  (`ARCHITECTURE.md`, `ANALYTICS_PLAN.md`, `INPUT_HARDENING_PLAN.md`) —
  a lightweight per-decision log (one file per significant call, "why we
  chose X over Y") keeps that up as more people join across more regions
  and "why did we build it this way" gets harder to reconstruct from
  memory alone.

---

## Phased roadmap

**Phase 0 — before the next feature, while it's still cheap:** ✅ done.
✅ `Facility` model + scope every table through it · ✅ namespaced error
codes · ✅ `zod` at the API boundary (helper landed; per-route retrofit
ongoing) · ✅ security headers · ✅ `AuditLog` table · ✅ `domain/` unit
test suite + CI gate · ✅ a real `/api/health` check · 🟡 documented
backup/restore policy — criteria and shortlist done
(`docs/OPERATIONS.md`), provider not yet chosen.

**Phase 1 — as a second facility/state becomes concrete:** three items
pulled forward and landed ahead of schedule (rate limiting, locale/
timezone abstraction, error-tracking/observability) because they were
cheap now and either non-negotiable before Analytics ships (rate
limiting — differencing-attack defense) or got more expensive the longer
they waited (locale abstraction — cheap before more `new Date()` call
sites exist). Remaining: RBAC role+scope model *scoped per-region* (the
four-role model itself already exists), i18n scaffolding (English-only
content, through the catalog), soft-delete, optimistic concurrency,
retry-with-backoff + idempotency keys on write routes (the two go
together — retrying safely requires both).

**Phase 2 — as multi-region/multi-country rollout becomes real:**
Field registry scoped per facility/region · offline-first data entry ·
Analytics data-fetch strategy revisited if volume demands it ·
per-target-jurisdiction compliance review · ✅ ADR log started early
(`docs/adr/`) rather than waiting for this phase, per this section's own
advice that it's cheap at any phase.

## What's deliberately NOT here

No sharding, no multi-region deployment, no microservices split, no data
warehouse, no message queue. All real, all eventually plausible at true
country-scale — all skipped here because building them ahead of actual
load data is itself a cost (complexity with no evidence it's needed yet),
and every one of them is *addable later* without a painful retrofit,
unlike the Phase 0 items above. If usage ever reaches the point where
these are genuinely the bottleneck, that's a good problem, and it'll come
with real numbers to design against instead of guesses.
