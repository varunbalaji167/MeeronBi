# MeeronBi — standing engineering principles

Paste this into the project's custom instructions. It's the distilled,
durable version of `docs/SCALING_PLAN.md` — apply these on every change,
not just when explicitly asked. When they conflict with speed/convenience,
these win; when a decision isn't covered here, check `docs/SCALING_PLAN.md`'s
phased roadmap before inventing a new pattern.

## Context

Next.js 14 + MySQL/Prisma + NextAuth antenatal-care data platform. Currently
one hospital in one Indian state; explicitly expected to grow to many
facilities, states, and eventually countries. Every foundational decision
should assume that trajectory without over-building for it today — see
"design for 10x, build for 10x, don't implement for 1000x" in
`docs/SCALING_PLAN.md`.

## 1. Error handling

- Never throw a bare `Error("string")` from server code. Use/extend the
  typed hierarchy in `server/http/errors.ts` so callers can branch on
  `instanceof`/`code`, not by matching message text.
- Every API route: wrapped in `withApiErrorHandling`, and calls the right
  guard from `server/auth/guards.ts` before touching data. Never trust the
  client — a request can always be hand-built.
- A cross-facility access attempt reports `NotFoundError`, never
  `ForbiddenError` — don't confirm a resource exists at a tenant the caller
  can't see.
- Client-side: read errors through `lib/apiClient.ts`'s `ApiError`/
  `friendlyErrorMessage`, not a raw `fetch().catch()` with a generic string.
- New domain logic that a caller genuinely needs to branch on should prefer
  a typed result over throwing.

## 2. User experience

- Loading state: a skeleton shaped like the real content for a
  predictable-shape wait; a plain spinner only when the shape isn't
  knowable ahead of time.
- Every button that writes data shows a loading state while in flight AND
  is disabled when there's nothing to do (no-op saves stay disabled, not
  just slow — see `DynamicForm`'s Save/Mark Complete logic).
- Prefer closed inputs (`select`/`radio`) over free text wherever the value
  matters for filtering/analytics. Use `allowOther: true`
  (`domain/textPatterns.ts`) instead of forcing an all-or-nothing choice
  between a rigid dropdown and unrestricted text.
- Every new field needs a deliberate `type`, a `validation` rule if the
  format matters, and a documented decision on whether it's `core` (see
  `docs/INPUT_HARDENING_PLAN.md`'s pattern).
- Don't bake a specific locale/timezone assumption deeper into the domain
  layer — i18n isn't wired up yet, but don't make it harder to add later
  either (check `docs/SCALING_PLAN.md` §2 before adding date/number
  formatting logic).

## 3. Security and data correctness

- Every table/query touching patient or user data is scoped by
  `facilityId` — the tenant boundary (`server/auth/guards.ts`, every
  repository under `server/patients/`, `server/trends/`,
  `server/facilities/`). This is non-negotiable, not a nice-to-have.
- Every write path taking a `patientId` uses `requireAdminSessionForPatient`,
  not the bare `requireAdminSession` (which only checks role, not facility
  ownership).
- Every save, draft or complete, goes through `sanitizeTabData` — never
  trust a `select`/`radio`/`number`/array shape from the client just
  because the UI would only ever send a valid one.
- Never expose per-patient data, or an aggregate with a small enough cell
  count to re-identify someone (rule of thumb: suppress/merge any group
  below ~10), from an unauthenticated route. See `docs/SCALING_PLAN.md`'s
  trends-page section for the specific disclosure risks and the
  recommended thresholds/design.
- Any new public/unauthenticated endpoint needs an explicit privacy
  justification in a code comment — default to requiring auth, don't add
  an exception without one.

## 4. Scale and maintainability

- New tab-level or cross-cutting features should be data-driven off the
  field registry (`domain/tabs/*`) and scoped by facility, not hardcoded
  per-deployment — that's what lets different hospitals/regions/countries
  diverge without forking the code.
- Keep `domain/` framework-free and pure. No Next.js/Prisma imports there,
  ever — that's what makes it unit-testable and safely reusable.
- Document non-obvious decisions the way the existing docs do — a comment
  where the decision lives, or a `docs/*.md` file for anything bigger
  (`ARCHITECTURE.md`, `ANALYTICS_PLAN.md`, `INPUT_HARDENING_PLAN.md`,
  `SCALING_PLAN.md`). A future contributor should be able to find "why"
  without re-deriving it.
- Before adding a new architecture-level thing (a new model, a new
  cross-cutting service, a new external dependency), check
  `docs/SCALING_PLAN.md`'s phased roadmap — build what the current phase
  needs, not what a hypothetical later phase might.

## Housekeeping

- Typecheck/balance-check everything touched before considering a change
  done (this sandbox can't always run a full `tsc`/`next build` — say so
  plainly rather than implying something's verified that isn't).
- When a change touches the schema, call out explicitly that
  `npx prisma generate` (+ a migration) needs to run against a real
  database — that can't happen in this environment.
