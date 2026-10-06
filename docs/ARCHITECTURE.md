# Architecture

This document explains **how the codebase is organized, why it's organized that
way, and exactly where to make each kind of change.** If you're about to add,
remove, or modify anything, find the matching section in
["Where does X go?"](#where-does-x-go) before you start.

The short version: this is a **layered architecture** — `domain` → `server` →
`app` → `components` — where each layer only knows about the layers below it,
never above. That's what keeps a change in one place (say, a new validation
rule) from rippling unpredictably through the rest of the app.

```
┌─────────────────────────────────────────────────────────────────┐
│  app/            Next.js routing only: pages, layouts, API routes │
│                  Thin. Delegates to server/ and components/.      │
├─────────────────────────────────────────────────────────────────┤
│  components/     React UI, organized by cohesion (ui/layout/     │
│  context/        forms/patient), plus client state (context/)    │
│  hooks/          and reusable client-side logic (hooks/)         │
├─────────────────────────────────────────────────────────────────┤
│  server/         Server-only: DB access, auth, business services  │
│                  (repositories + services). No React. No JSX.     │
├─────────────────────────────────────────────────────────────────┤
│  domain/         Pure business logic & types. No React, no        │
│                  Next.js, no Prisma. Framework-agnostic — this    │
│                  layer could be unit tested with zero setup.      │
└─────────────────────────────────────────────────────────────────┘
```

**The dependency rule:** `domain` imports nothing else in `src/`. `server` may
import `domain`. `components`/`context`/`hooks` may import `domain` and call
`server`-backed API routes (but never import from `server/` directly — they're
client code; `server/` is server-only). `app/` may import anything. If you
find yourself importing "up" this list (e.g. `domain/` importing from
`server/`), that's a sign the code is in the wrong layer.

---

## Directory reference

```
prisma/
  schema.prisma          Database schema — the source of truth for tables/columns
  seed.ts                Creates an admin login + one fully-filled demo patient
  seed-cs-register.ts    Loads 60 synthetic deliveries across 3 facilities (Analytics volume)
  cs-register/           Mock register CSV, shaped like a real hospital's, + its tested column-to-field mapping

src/
  domain/                 Pure business logic & types (see "domain/" below)
    tabs/
      types.ts             FieldConfig/SectionConfig/TabConfig — the schema vocabulary
      sharedOptions.ts      Reused <select> option lists (yes/no, education levels, ...)
      personal.ts           Tab 1 config
      history.ts            Tab 2 config
      investigation.ts      Tab 3 config
      ultrasound.ts         Tab 4 config
      delivery.ts           Tab 5 config
      robson.ts             Tab 6 config + the Robson classification algorithm
      treatments.ts         Tab 7 config
      index.ts              Barrel: allTabs[], getTabByKey() — import tabs from HERE
    analytics/
      types.ts             Analytics result shapes (breakdowns, cross-tabs, series)
      fieldRegistry.ts     Which fields are analyzable, and how each is classified
      disclosureControl.ts Small-cell suppression (k-anonymity) by audience tier
      statistics.ts        Summary statistics over resolved values
      segments.ts          Bucketing continuous values into brackets
      resolveValue.ts      Pulls one field's value out of a stored tab record
      derivedFields.ts     Computed fields (age, gestational age) exposed to analytics
      auditPayload.ts      Builds the audit entry describing an analytics query
    validation.ts          Generic engine: validateFieldValue/validateAllFields/getIncompleteReasons
    fieldVisibility.ts     "Customize fields" resolution logic
    phone.ts               International PhoneValue type + validation
    countryCodes.ts        ITU calling-code reference data
    gestationalAge.ts      Gestational-age math + recommended scan windows
    locale.ts              Date/measurement formatting per Facility.locale
    textPatterns.ts        Shared free-text normalization patterns
    result.ts              Result<T,E> type used across server/analytics
    auth/
      credentialToken.ts     Purpose/expiry/consumption state machine for invite/reset/verify tokens
      googleSignIn.ts         resolveGoogleSignIn: pure verdict logic for Google sign-in/link/signup
    notifications/
      emailTemplates.ts       renderEmail: subject/text/html per template, all HTML escaped
      retryPolicy.ts          Backoff schedule for a failed outbox send
    index.ts               Top-level barrel re-exporting all of the above

  config/
    env.ts                  Zod-parsed SMTP/Google env (emailConfig/googleConfig are null when unset)

  server/                 Server-only: DB, auth, business services
    db/prisma.ts            PrismaClient singleton
    http/withApiErrorHandling.ts  Wraps every route handler so thrown errors become valid JSON, never an empty body
    email/
      outbox.ts               email_outbox CRUD — enqueue inside a caller's transaction, claim/mark for the worker
      transport.ts            getMailer(): real SMTP, or a console transport when SMTP_HOST is unset
    auth/
      authOptions.ts         NextAuth config (providers, session/jwt callbacks)
      guards.ts              Session guards per role, plus requireAdminSessionForPatient/assertPatientRecordAccessible — facility-scoped, see below
      credentialTokens.ts     issueToken/consumeToken/peekToken — hashes tokens, never stores the raw value
      credentialFlows.ts      setPassword/requestPasswordReset/verifyEmail/linkGoogleAccount
      googleResearcherSignupToken.ts  Short-lived JWT bridging Google signup to the no-session researcher-signup form
    facilities/
      facilityRepository.ts      Resolves the tenant for contexts with no session (currently just /public/trends)
    patients/
      patientRepository.ts       Patient CRUD (list+pagination+search, create, get, delete) — every read/write scoped by facilityId
      tabRecordRepository.ts     Per-tab record CRUD (pure data access, no HTTP)
      tabRecordRouteHandlers.ts  Thin HTTP adapters used by the 7 tab API routes
      portalAccessService.ts     "One login per patient, no duplicate emails" business rule
      fieldPreferenceService.ts  Reads/writes a hospital's field-visibility choices, scoped per facility
    trends/
      trendsRepository.ts       Aggregate-only queries for the public trends page, scoped to one facility
    analytics/
      analyticsService.ts       Entry point for cohort/time-series queries; returns Result<T,E>
      analyticsRepository.ts    Facility-scoped reads backing analytics
      aggregate.ts              Aggregation over resolved field values
      cohortBranches.ts         Cohort query branches by field classification
      timeSeriesBranches.ts     Repeated-measurement query branches
      analyticsAudit.ts         Writes an AuditLog row per analytics query
      errors.ts                 Analytics-specific typed errors
    researchers/
      researcherAccessService.ts  Request -> PENDING -> approve/reject flow

  app/                    Next.js App Router — routing glue only
    admin/                 Hospital staff area (sidebar shell, patient list, per-patient tabs)
      page.tsx               Server Component: reads ?page/q/facilityId, calls listPatients directly;
                             PatientListFrame (client toolbar) wraps the server-rendered PatientTable + Pagination
      facilities/, researchers/  Thin server parent (role check + initial data) over a *Client.tsx component
    patient/               Patient portal area (sidebar shell, read-only record view; page.tsx is a
                           Server Component seeding the first tab, PatientRecordClient owns stage switching)
    researcher/            Approved-researcher analytics area
    researcher-access/     Public form for requesting researcher access, or "Sign up with Google"
      complete/              No-session completion form after a Google researcher-signup redirect
    forgot-password/       Public, no-enumeration "send me a reset link" form
    set-password/          Consumes an ACCOUNT_INVITE or PASSWORD_RESET token
    verify-email/          Consumes an EMAIL_VERIFICATION token
    public/trends/         No-login aggregate stats page
    login/                 Shared login page (role-hinted via ?role=admin|patient|researcher)
    api/                   REST-ish route handlers — each one is a thin controller
      auth/                  password-reset/request, set-password, verify-email(+resend), [...nextauth]
      researcher-access/     request (credentials signup), google-start, google-complete

  components/
    ui/                    Generic, dumb, reusable anywhere (Spinner, ErrorBanner, EmptyState + Illustration, PageHeader)
    layout/                App-shell chrome (AppSidebar, SignOutButton, AuthShell for the standalone auth screens)
    forms/                 The dynamic form engine (knows about domain/tabs, nothing patient-specific)
      DynamicForm.tsx        Orchestrator: state, save/delete/autosave wiring
      FieldInput.tsx         Renders one field by type (text/select/phone/...)
      FieldCustomizer.tsx    The "Customize fields" checklist UI
      sections/              PlainSection / GridSection / RepeatingSection renderers
    analytics/              Analytics UI: field/filter/patient pickers, cohort and time-series panels
    patient/                Feature-specific: only meaningful in "a patient's record" context
      TabRecordView.tsx       Resolves visible fields, renders DynamicForm; takes an optional server-read initialRecord, else fetches
      PatientHeader.tsx, PatientPortalAccess.tsx, PatientTabNav.tsx, CareTimeline.tsx

  context/                React Context providers (client-side app state)
    AuthContext.tsx         Wraps next-auth's useSession() in a clean useAuth() hook
    ToastContext.tsx        Global toast notifications
    TabFormContext.tsx      Lets tab navigation autosave the active form before leaving

  hooks/                  Reusable client-side hooks
    useTabRecord.ts          Save/delete for one tab record; fetches on mount only when no initialRecord is given
    useFieldVisibility.ts    Fetch/save a tab's field-visibility selection

  types/next-auth.d.ts    Type augmentation for next-auth's Session/JWT shapes

  lib/
    apiClient.ts            ApiError + friendlyErrorMessage() — the client-side
                             counterpart to server/http/errors.ts (see below)
    suspenseResource.ts     Small promise-cache helper for Suspense boundaries

  middleware.ts           Route-level auth redirects (re-checked server-side in guards.ts)
```

---

## Why each layer exists

### `domain/` — pure logic, zero framework dependencies

This is the most important layer to keep clean. Everything in here should be
importable and testable from a plain Node script — no Next.js request object,
no Prisma client, no React. That constraint is deliberate: it's what makes
`computeRobsonGroup()`, `validateAllFields()`, and `resolveVisibleFieldNames()`
each independently verifiable (see the inline examples in this doc) instead of
only testable by clicking through the whole app.

**Why the 7 tabs are 7 separate files instead of one `formConfigs.ts`:** the
original single-file version worked but became a ~600-line file mixing 137
fields across 7 unrelated clinical concerns plus the validation engine plus
the Robson algorithm. Splitting by tab means changing what Investigation
collects touches exactly one file, and a merge conflict in History can't
possibly collide with a change to Delivery.

**Why Robson's config and its classification algorithm live in the same
file:** `computeRobsonGroup()` *is* Robson's domain logic, not a generic
utility — it only makes sense in the context of that tab's 6 fields. Keeping
them together is "high cohesion": one file, one concern, one reason to
change.

### `server/` — infrastructure and business services

Three kinds of things live here, and it's worth keeping them distinct in your
head even though they sit in the same folder:

- **Repositories** (`patientRepository.ts`, `tabRecordRepository.ts`,
  `trendsRepository.ts`) — pure data access. Take plain arguments, return
  plain data or throw, know nothing about HTTP.
- **Services** (`portalAccessService.ts`, `fieldPreferenceService.ts`) —
  business rules that are more than a single query (e.g. "a patient has at
  most one login, and refuse a duplicate email" isn't a database concern by
  itself, it's a rule about what's allowed).
- **Route handler adapters** (`tabRecordRouteHandlers.ts`) — the one
  deliberate exception that *does* know about HTTP (`NextResponse`). It
  exists because all 7 tab API routes share identical GET/PUT/DELETE logic;
  rather than duplicate it 7 times or force it into the repository (which
  should stay framework-agnostic), it has its own thin adapter layer.

`server/` code must never be imported from a Client Component
(`"use client"` file) — it relies on server-only things like the Prisma
client and the NextAuth server session. Client code talks to it exclusively
through `app/api/**/route.ts` endpoints via `fetch()`.

**Every route handler is wrapped in `withApiErrorHandling`** (see
`server/http/withApiErrorHandling.ts`). This exists because of a real bug: a
thrown exception in a route handler (e.g. a query against a table that
hasn't been migrated yet) can otherwise produce an empty response body, and
`fetch(...).then(r => r.json())` on the client throws a confusing
`"Unexpected end of JSON input"` that hides the actual problem. The wrapper
guarantees any error — expected or not — still comes back as a well-formed
JSON `{ error: "..." }` with a real status code, and logs the real error
server-side for debugging. When adding a new route, wrap it the same way:

```ts
export const GET = withApiErrorHandling(async (req, { params }) => {
  // ...
});
```

### `app/` — routing glue, intentionally thin

Every `page.tsx`, `layout.tsx`, and `route.ts` should be short. If a
`route.ts` file is doing anything more complex than "check auth → call one
server/ function → return the result," that logic almost certainly belongs
in `server/`, not the route handler. Look at any of the 7
`api/patients/[id]/{tab}/route.ts` files for the target shape — three lines,
delegating entirely to `tabRecordRouteHandlers.ts`.

### `components/` — organized by cohesion, not by "everything in one folder"

- **`ui/`** — no domain knowledge at all. A `Spinner` doesn't know what a
  patient is. If you're tempted to import `domain/` into something in `ui/`,
  it belongs in `forms/` or `patient/` instead.
- **`layout/`** — app-shell chrome (sidebar, sign-out). Knows about routes
  and auth, not about clinical data.
- **`forms/`** — the *engine* that can render any `TabConfig`. It knows about
  `domain/tabs` types but nothing about *which* tab or *whose* patient record
  — that's the boundary that keeps it reusable.
- **`patient/`** — the features that only make sense already in the context
  of "a specific patient's record" (the tab stepper, the portal-access panel,
  the component that actually fetches and renders one tab's data).

### `context/` vs `hooks/`

`context/` is for state that many unrelated components need without prop
drilling (who's logged in, the toast queue, which form is currently dirty).
`hooks/` is for encapsulating *behavior* — a hook doesn't create app-wide
shared state, it just gives a component a clean API for something it would
otherwise have to reimplement (`useTabRecord` wraps three fetch calls;
`useFieldVisibility` wraps two more). If you find a chunk of `useEffect` +
`fetch` logic duplicated across two components, that's the signal to extract
a hook.

---

## The two most substantial features, explained

### Field visibility ("Customize fields")

Most hospitals won't want to collect all 137 fields from the original
prototype. Each tab's plain-section fields can be individually shown or
hidden **per deployment** (not per patient — this is a hospital-wide data
standard, stored in one `TabFieldPreference` row per tab).

- `FieldConfig.core: true` marks the handful of fields shown by default
  before any hospital has customized anything (see each file in
  `domain/tabs/` for which ones, and the reasoning in code comments there).
- `domain/fieldVisibility.ts` deliberately separates two different
  questions, each with its own function:
  - **`resolveVisibleFieldNames(tab, storedSelection)`** — what the STAFF
    editing form shows. Strictly the hospital's saved selection (or `core`
    defaults if never configured). Unchecking a field hides it here,
    period — even if it already has data. That data isn't deleted; it just
    stops being editable through this form until the field is re-enabled.
  - **`getFieldsWithData(tab, data)`** — what the PATIENT's read-only view
    shows. Any field with a value, regardless of the hospital's current
    configuration — a patient's own record shouldn't appear to lose history
    just because staff later stopped collecting that field.

  These two used to be one function that unioned "configured" with "has
  data" for both views, which meant unchecking a field in the customizer
  didn't actually hide it from the staff form if it had data — the opposite
  of what "Customize fields" is for. Keep them separate; don't reintroduce
  that union for the staff-facing view.
- Grid and repeating sections (tables like Reactive Tests, Obstetric History)
  are deliberately **not** covered — they're already compact, and per-cell
  toggling wasn't worth the added complexity. This is a documented scope
  boundary, not an oversight.
- `FieldCustomizer.tsx` shows a small "(has data)" hint next to any field
  that currently has a value but is unchecked, so hiding it is an informed
  choice rather than a surprise — without blocking the action.

### One source of truth for name / MRD / phone

The Patient table has `fullName`/`mrn`/`contactNo` columns (needed for the
patient list's display and search), and the Personal tab separately collects
the same three things in more detail. These used to both be asked for at
patient-creation time, which meant editing them later in the Personal tab
silently didn't update what the patient list showed — two sources of truth,
silently drifting apart.

Now: creating a patient asks for **only a name** (the one thing required to
create the row at all). Everything else — MRD, phone, and a more detailed
name breakdown — is entered exactly once, in the Personal tab. Every time
the Personal tab is saved, `syncPatientSummaryFromPersonal()`
(`server/patients/patientRepository.ts`) copies `fullName`/`mrn`/`contactNo`
back onto the Patient row, so the list is always current without asking
twice. MRD has a uniqueness constraint; if a save would collide with another
patient's MRD, the name/phone sync still succeeds and the person saving gets
a warning toast rather than a failed save over a display-only field.

### Inline validation errors vs. the completeness toast

`getFieldLevelErrors()` (`domain/validation.ts`) is the single field-name →
message map used for red inline text under each box — it merges
format/range validation (`validateAllFields`) with "required but currently
empty" fields, so both kinds of problem show up the same way, right under
the field that has them. Attempting **Mark Complete** with any of these
outstanding shows exactly one toast ("Please fix the highlighted fields...")
rather than a wall of concatenated error text — the toast points at the
form, the form carries the specifics. (`getIncompleteReasons()` still
returns human-readable *labels* rather than field names, for the rare case
of a tab-level custom check that isn't about a single field — Robson's "all
6 questions must be answered" being the only current example.)

### International phone numbers

Phone fields use a dedicated `type: "phone"` (see `domain/tabs/types.ts`),
stored as `{ countryIso, number }` rather than a single string, so a country
can be changed without re-parsing free text. `domain/phone.ts` holds a
per-country expected-length table (`PHONE_LENGTH_BY_ISO`) — e.g. India and
the US are both exactly 10 digits, China is 11 — rather than one loose range
for everyone, so "too many digits for this specific country" is actually
rejected, not just anything under some generous global ceiling. Countries not
in the table fall back to a conservative default range; add a country's exact
rule to the table rather than loosening that default.

This is enforced in **three places**, deliberately redundant:

1. **The input itself** (`components/forms/FieldInput.tsx`) strips
   non-digit characters as you type and hard-caps the DOM `maxlength` to the
   selected country's exact limit — for India that's `10`, so a keystroke
   past the 10th digit is simply not accepted by the browser at all.
2. **`validateFieldValue`/`validateAllFields`** (`domain/validation.ts`)
   re-checks the same rule on blur, for the inline red-text error message.
3. **The server** (`server/patients/tabRecordRouteHandlers.ts` +
   `sanitizeTabData` in `domain/validation.ts`) never trusts the client:
   every save clamps any phone field to its country's max length before
   writing to the database, and marking a tab **Complete** re-runs the full
   validation server-side and rejects the request (HTTP 400) if anything is
   invalid — so a request built by hand, bypassing the UI entirely, cannot
   mark a record Complete with a malformed phone number (or any other
   invalid field) just because it skipped the browser.

---

## How the source spec maps onto this codebase

The field list originates in a PDF walkthrough of the Google Apps Script
prototype (`MeeronBi_Default_indicators_to_be_recorded.pdf`), one page per
tab, each screenshot annotated with red dots marking "default indicators to
be recorded" — the same concept this codebase calls `core` (see Field
visibility above). `core` flags are kept aligned with those annotations.
Four tabs needed a mechanism beyond a simple dot-to-`core` mapping, and
those decisions are the ones worth knowing:

- **Obstetric History is dynamic, not a fixed grid.** The spec annotates it
  as "G1 [only] is default — from G2 to G6 or G10, allow users to add via an
  'Add Gravida' button", so `RepeatingSectionConfig` carries a
  `transposed`/`minCount`/`maxCount` shape and `RepeatingSection.tsx` has a
  matching dynamic-column render path.
- **Every plain-section field on Investigation is `core`.** The spec's
  caption reads "Investigations are mandatory" and nearly every field on
  that page carries a dot. One consequence worth knowing: this tab has no
  "Customize fields" button, because `isCustomizable` returns false once
  nothing is left to hide. That is intended behavior, not a bug.
- **Ultrasound uses gestational-age windows instead of `core` defaults.**
  That page carries zero dots but a different instruction — "Auto select for
  display using LMP date" — attached to the NT Scan, Anomaly Scan, Uterine
  Artery Doppler and pre-delivery Doppler sections, with specific textbook
  windows (NT scan at 11w0d–13w6d, and so on). It is read as "this tab uses
  a different display-timing mechanism", not "nothing here is default";
  stripping `core` to literally match zero dots would have emptied the tab's
  default view. `domain/gestationalAge.ts` holds the pure LMP-to-gestational
  -age math, and a `recommendedWindow` on the relevant
  `SectionConfig`/`GridSectionConfig` entries renders as an advisory
  `GestationalWindowBadge`, computed from the Personal tab's LMP and fetched
  for this tab in `TabRecordView` — the one genuinely cross-tab read in the
  app. The badge is advisory only and never hides or disables a section: a
  scan legitimately happening outside its textbook window must still be
  recordable.
- **Delivery keeps its `core` set aligned with `requiredFields`.** A
  required field must stay `core` regardless of what a spec page shows —
  otherwise it could be hidden via Customize, making Mark Complete
  unreachable (see `delivery.ts`'s comment). `classifyDeliveryTiming()`
  displays live next to the form, the same way Robson's result does.
- **Robson auto-computes rather than gating on a Classify button.** The
  spec describes the user clicking Classify before saving; this app
  live-displays the classification (`robsonResult` in `TabRecordView`) and
  blocks **Mark Complete** until it resolves. That achieves the same
  guarantee without a manual step, and without blocking **Save as Draft**,
  which nothing in this app is allowed to do.

---

## Where does X go?

| I want to... | Do this |
|---|---|
| **Add/rename/remove a field on an existing tab** | Edit the relevant file in `domain/tabs/*.ts`. Nothing else needs to change — `DynamicForm` renders from this config automatically, and the JSON storage in Prisma doesn't need a migration. |
| **Add a brand-new tab** | 1) Create `domain/tabs/newTab.ts` following an existing file's shape. 2) Add it to `allTabs` in `domain/tabs/index.ts`. 3) Add a Prisma model for it in `schema.prisma` + add its key to `TAB_MODEL_MAP` in `server/patients/tabRecordRepository.ts`. 4) Create the route folder `app/admin/patients/[id]/<tabkey>/page.tsx` (copy an existing one — it's 3 lines) and the API route `app/api/patients/[id]/<tabkey>/route.ts` (copy an existing one). 5) Run `npx prisma migrate dev`. |
| **Add validation to a field** | Add a `validation: { pattern/min/max, message }` to that field in its `domain/tabs/*.ts` file. For a rule that depends on *another* field's value (like "EDD after LMP"), add a function to that tab's `fieldValidators` instead. |
| **Change what's required before "Mark Complete"** | Edit `requiredFields` (or `validateForComplete` for non-trivial rules) on the tab in `domain/tabs/*.ts`. |
| **Add a new field type (beyond phone/select/date/...)** | Add it to the `FieldType` union in `domain/tabs/types.ts`, then add a `case` for it in `components/forms/FieldInput.tsx`. |
| **Add a new API endpoint** | Create `route.ts` under `app/api/...`. Keep it thin: auth guard from `server/auth/guards.ts`, then call into a `server/` repository/service, then return `NextResponse.json(...)` — and wrap every exported handler in `withApiErrorHandling` (see below). If the logic is more than a few lines, put it in `server/`, not the route file. |
| **Add a new page** | Add it under `app/`. If it needs the admin or patient sidebar, it should live under `app/admin/` or `app/patient/` so it inherits the existing `layout.tsx`. |
| **Add a new reusable UI primitive** (a button variant, a modal shell, etc.) | `components/ui/`. |
| **Add a new database column/table** | Edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <description>`. If it's a per-tab field, prefer adding it to that tab's `data` JSON blob (via `domain/tabs/*.ts`) instead of a new column — only add real columns for things the public trends page needs to aggregate (see `deriveExtraColumns()` in `tabRecordRepository.ts` for the existing examples). |
| **Add a new role or permission rule** | Add the role to the `Role` enum in `schema.prisma` and `types/next-auth.d.ts`, add a guard function in `server/auth/guards.ts`, and update `src/middleware.ts`'s route matcher. |
| **Change sidebar navigation** | `components/layout/AppSidebar.tsx` — it takes a `role: "admin" | "patient"` prop and resolves its own nav items/icons internally (see the file's top comment for why it doesn't accept icon components as props). |
| **Add a toast/notification somewhere** | `useToast()` from `context/ToastContext.tsx` — never use `alert()` or `confirm()` for anything except the one existing delete-confirmation dialog in `DynamicForm.tsx`. |
| **Change country-code data** | `domain/countryCodes.ts`. |

---

## Naming conventions

- **Files**: `PascalCase.tsx` for React components, `camelCase.ts` for
  everything else (domain modules, server modules, hooks). Hooks are
  additionally prefixed `use*`.
- **Barrels**: prefer importing from a folder's `index.ts` (`@/domain/tabs`,
  `@/domain`) over reaching into an individual file, unless you need
  something that specific barrel doesn't re-export.
- **Server vs. client**: every file that uses hooks, event handlers, or
  browser APIs starts with `"use client"`. Everything under `server/` is
  implicitly server-only (Next.js API routes and Server Components can
  import it; Client Components cannot and should not).
- **Tab keys**: the lowercase string (`"personal"`, `"robson"`, ...) is the
  single identifier used across the domain config, the URL segment, the
  Prisma model mapping, and API routes. When in doubt, pass the *key*
  between layers, not the full config object — config objects can carry
  functions (like Robson's classifier), and functions can't cross the
  server→client boundary (see the comment atop `TabRecordView.tsx` for the
  bug this was written to prevent).

### Toasts, live header updates, and confirmations

A few UI details that are easy to regress if touched carelessly:

- **Toasts render top-center** (`context/ToastContext.tsx`), not bottom —
  `DynamicForm` has its own sticky action bar pinned to the bottom of the
  screen while editing a tab, and a bottom-anchored toast collided with it
  (visually and in z-order). If you add UI with its own bottom-fixed
  element, keep this in mind.
- **The patient header's name updates live**, not just after a save. This
  works via `TabFormContext`'s `activeForm` (a reactive, not just
  ref-based, snapshot of the currently-mounted tab's in-progress `data`) —
  `PatientHeader` reads `activeForm.data.fullName` when the Personal tab is
  the active one, falling back to the last-saved, server-provided name
  otherwise. **The Robson classification result uses the exact same
  mechanism** (`TabRecordView.tsx` reads `activeForm.data` when
  `activeForm.tabKey === "robson"`) so the classified group updates the
  instant all 6 questions are answered — not only after a save completes
  and the page is revisited, which was a real reported bug. If you need
  similar "reflect this as it's typed, before save" behavior elsewhere,
  extend `activeForm` rather than inventing a parallel mechanism.
- **Delete confirmation uses `components/ui/ConfirmDialog.tsx`**, not the
  browser's native `confirm()`. Native confirm dialogs can't be styled,
  block rendering of anything else (including a toast that might be
  in-flight), and look out of place next to the rest of the UI. Use
  `ConfirmDialog` for any future "are you sure?" step instead of reaching
  for `confirm()`/`alert()`.
- **The sidebar must stay visually pinned while a long tab (e.g. History's
  Obstetric History grid) scrolls.** This depends on the *layout*, not the
  sidebar component itself: `app/admin/layout.tsx` / `app/patient/layout.tsx`
  set `lg:h-screen lg:overflow-hidden` on the outer flex container, so only
  `<main>` (which has `lg:overflow-y-auto`) scrolls — the sidebar, a normal
  flex sibling, simply never moves because its parent doesn't either. An
  earlier version used `min-h-screen` on the outer container with no
  overflow constraint, which let the *whole page* scroll together,
  dragging the sidebar's nav out of view on any long tab. If a future
  layout change reintroduces unbounded height on that outer container,
  this bug comes back — keep the two changes (bounded height + `main`'s own
  scroll region) together.

### Typed errors instead of string messages

`server/http/errors.ts` defines a small `AppError` hierarchy
(`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`,
`ConflictError`), each carrying its own HTTP status code, a machine-readable
`code`, and optionally `fieldErrors` (for errors that map to a specific form
field). `server/auth/guards.ts` and the services in `server/patients/`
**throw** these instead of returning a `{ ok, status, message }` union or a
bare `Error("some string")` — so a route handler is just:

```ts
export const POST = withApiErrorHandling(async (req) => {
  const session = await requireAdminSession(); // throws UnauthorizedError/ForbiddenError, never returns false
  const result = await someService(...);       // throws ValidationError/ConflictError/NotFoundError as needed
  return NextResponse.json(result);
});
```

`withApiErrorHandling` (already required on every route — see above) is the
one place that turns a thrown `AppError` into the right JSON response
(`{ error, code, fieldErrors }`, with the error's own status code) — and
still catches anything unexpected as a generic, internals-free 500. If you
add a new kind of failure, add a subclass in `errors.ts` rather than
threading another string through a return type; callers can then
`instanceof`-check for the specific failure mode instead of parsing a
message.

### Loading UI: Suspense/`loading.tsx` vs. client-side spinners vs. skeletons

Three distinct mechanisms, for three distinct moments — worth keeping straight:

- **`loading.tsx` files** (`app/admin/loading.tsx`, `app/patient/loading.tsx`,
  `app/admin/patients/[id]/loading.tsx`) are Next.js's file-based Suspense
  boundaries — they render automatically while an `async` Server Component
  in that route segment (a layout awaiting `getSession()`, or the `[id]`
  layout awaiting `getPatientHeaderInfo()`) is still resolving, with zero
  client-side state of your own to manage. Next nests them *inside* the
  sibling `layout.tsx`, so they render content only — never their own
  sidebar/`<main>` shell. Each one is a skeleton shaped like the real content (via `components/ui/Skeleton.tsx`) so the page
  doesn't visually "pop" once real data arrives.
- **A matching client-side skeleton** (`components/ui/FormSkeleton.tsx`,
  built from the same `Skeleton` primitive) covers a `"use client"`
  component's own `fetch()` after the page has already loaded, when that
  fetch is filling in a shape the person can already see coming — most
  notably `TabRecordView`'s per-tab record fetch. Use the *same* skeleton
  shape here as the route's `loading.tsx` uses for the equivalent content,
  not a spinner: handing off from a `loading.tsx` skeleton to a
  spinner and only then to real data reads as two separate
  loading moments (a visible flicker) instead of one continuous "this is
  materializing" impression. This is why `TabRecordView` renders
  `FormSkeleton`, not a spinner, while `record.loading` is true.
- **Inline `Spinner`** is for narrower waits where the shape isn't worth a
  skeleton — a button's in-flight state, or a client tab switch that refetches
  (e.g. the Approved/Rejected tabs on `/admin/researchers`). Prefer a Server
  Component read plus `loading.tsx` over a client fetch-then-spinner for any
  page's first paint: it removes the hydrate-then-fetch waterfall.

### Action-button loading state and error messages

Every button that writes data (Save as Draft, Mark Complete, Delete,
signing in, creating a patient, setting up portal access) follows the same
shape: swap its icon for a `Spinner` and its label for an "-ing…" verb the
moment it's clicked, and stay disabled until the request settles — so a
slow network is visibly "working," not just unresponsive. Two further
rules on top of that:

- **No-op saves are disabled, not just slow.** `DynamicForm`'s "Save as
  Draft" is disabled whenever the form isn't `dirty` (nothing to save), and
  "Mark Complete" is disabled specifically when the tab is *already*
  `COMPLETE` and nothing has changed since — re-submitting identical data
  accomplishes nothing and invites a confusing "did that do anything?"
  moment. Both re-enable the instant the person edits anything.
- **Failure toasts are error-code-aware, not one generic string.**
  `lib/apiClient.ts`'s `ApiError` (client-side counterpart to
  `server/http/errors.ts`'s `AppError`) carries the server's `code` back
  through a failed `fetch`, and `friendlyErrorMessage()` maps it to
  something actionable — "please sign out and sign in again" for an
  expired session, the server's own message for a `VALIDATION_ERROR`/
  `CONFLICT` (e.g. an MRD already in use), "please try again" for a
  genuine server fault, "check your connection" for a request that never
  reached the server at all (a `TypeError` from `fetch()` itself). Every
  write path (`useTabRecord`, `useFieldVisibility`, `PatientHeader`'s
  delete, `PatientPortalAccess`, new-patient creation) throws/reads through
  this instead of a bare `Error("...")`, so a new write path should too.

### Static vs. dynamic rendering

Stated explicitly with `export const dynamic = ...` rather than left to
Next's inference, so the choice reads as a decision, not an accident:

- `app/page.tsx` (homepage) — `"force-static"`. Nothing on it reads
  per-request data.
- `app/admin/layout.tsx`, `app/patient/layout.tsx` — `"force-dynamic"`.
  Both read the session on every request; must never be cached across users.
- `app/public/trends/page.tsx` is an async Server Component with
  `revalidate = 300` (ISR): it calls `getPublicTrends()` directly, so the stat
  cards are in the HTML. recharts lives in `TrendsCharts.tsx`, lazily loaded via
  `TrendsChartsLoader.tsx`; the session-aware nav link is the isolated
  `HomeLink.tsx` client island, because reading the session in the page would
  force dynamic rendering and defeat ISR. `/api/public/trends` stays for the
  smoke test and the rate-limited public surface.

### Accessibility patterns to keep using

- **Dialogs** (`ConfirmDialog`, the field-customizer overlay in
  `TabRecordView.tsx`) use `role="alertdialog"`/`role="dialog"` +
  `aria-modal="true"` + `aria-labelledby`/`aria-describedby` pointing at
  real element ids (via `useId()`), close on **Escape**, and move focus to
  a sensible default button on open. Follow this shape for any new modal
  rather than inventing a new one.
- **Toasts** live in an `aria-live="polite"` region (`ToastContext.tsx`) so
  screen readers announce new ones without needing focus to move there.
- **The care-stage stepper** (`CareTimeline.tsx`) exposes each stage's
  status in an `aria-label` ("Step 3: Investigation (draft)"), not just
  color — color alone isn't accessible to everyone reading the same UI.
- **Purely decorative elements** (connecting lines, the active-nav accent
  bar) are `aria-hidden="true"` so they don't clutter screen-reader output.

### Tailwind content glob

`tailwind.config.ts` scans `content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"]` —
**one catch-all glob**, not a list of specific folders. Keep it that way.

A Tailwind class used in a file outside the glob is silently dropped from
the compiled CSS: not an error, just absent. When the glob listed only
`src/app/**` and `src/components/**`, `src/context/ToastContext.tsx` fell
outside it, and every toast rendered in the DOM with none of its
`fixed`/`top-4`/`z-[60]` classes defined — visually invisible, with nothing
in the build to indicate why. The catch-all already covers any new
top-level folder under `src/`; narrowing it back to a folder list
reintroduces that failure mode.

### MRD/CR No. uniqueness

`Patient.mrn` has a database-level uniqueness constraint. Saving the
Personal tab with an MRD that's already used by a different patient doesn't
fail the save outright — `syncPatientSummaryFromPersonal()`
(`server/patients/patientRepository.ts`) catches that specific conflict,
still syncs everything else (name, phone), and `handleTabSave`
(`server/patients/tabRecordRouteHandlers.ts`) reports it back as a
field-level error on `mrn` — same mechanism as any other inline validation
error, so it shows up as red text under the MRD box rather than a toast
that's easy to miss. The seeded demo patient uses MRD `DEMO-0001`; if you
manually type that same value for a different patient while testing, this
is the conflict you'll see, and it's working as intended.

### Deleting a patient entirely

`PatientHeader.tsx` has a "Delete entire patient" action (separate from
each tab's own "Delete [tab] data," which only clears that one tab).
Deleting a `Patient` row cascades to all 7 tab records automatically (each
has `onDelete: Cascade` in `schema.prisma`), but their portal login
(`User` row) does not — the foreign key points the other way
(`Patient.userId -> User.id`), so a cascade rule can't be attached to this
direction. `deletePatient()` (`server/patients/patientRepository.ts`)
handles this explicitly: delete the `Patient` row first (clearing the
reference), then delete the now-orphaned `User` row. If you ever see a
patient-portal login that still "works" after its patient was deleted, this
is the function to check.

### The sticky form action bar must not cover the sidebar

`DynamicForm`'s Save/Mark Complete/Delete bar is `position: fixed` to the
bottom of the viewport so it stays reachable on a long tab. It used to be
`inset-x-0` (full viewport width) with only its *inner content* padded
clear of the sidebar via `lg:pl-[17rem]` — the bar's own translucent
`bg-white/95 backdrop-blur` still painted across the sidebar's screen
region, including its bottom strip where Sign Out lives, so at desktop
width Sign Out was invisible (covered, not removed) whenever an editable
tab was open. Fixed by constraining the bar itself, not just its content:
`left-0 right-0 lg:left-60` (matching `AppSidebar`'s `lg:w-60`) so the bar's
box stops geometrically overlapping the sidebar at desktop width, rather
than trying to fix it with z-index or padding tricks. If you resize the
sidebar (`AppSidebar`'s `lg:w-60`), update this `lg:left-60` to match, or
the gap/overlap comes back.

### Stale sessions after a database reset

Sessions are signed JWTs (see `server/auth/authOptions.ts`) — fast,
and never re-prompt for login on navigation, but also never re-checked
against the database by default. If you reset or reseed the database (a
new `prisma migrate reset`, or re-running seed against a fresh DB) while a
browser still holds an old session cookie, that cookie references a user id
that no longer exists. The session guards in `server/auth/guards.ts`
explicitly check the session's user id still
exists and return a clear 401 ("please sign out and sign in again") instead
of letting a stale session reach a database write, where it would otherwise
surface as a confusing foreign-key violation (e.g. `Patient.createdById`).
If you ever hit that FK error directly instead of the clean 401, it likely
means a new write path was added that skips these guards — every route that
writes data must go through one of them.

## Testing strategy

See `docs/TESTING.md` — this layering is what lets the suite run without a
database, HTTP server, or React renderer.
