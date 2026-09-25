# MeeronBi — standing engineering principles

Paste this into the project's custom instructions. It's the distilled,
durable version of `docs/SCALING_PLAN.md` — apply these on every change,
not just when explicitly asked. When they conflict with speed/convenience,
these win; when a decision isn't covered here, check `docs/SCALING_PLAN.md`'s
phased roadmap before inventing a new pattern.

## North Star

The core goal of this project is a **strong, scalable foundation** —
reliable, fault-tolerant, a great experience to use, and easy for a future
collaborator (including a future instance of Claude with no memory of this
conversation) to pick up and extend correctly on the first try. Shipping an
MVP feature set is completely fine; shipping it on top of a weak foundation
is not. Every decision below exists in service of that, not as bureaucracy
for its own sake.

**Before calling a change done, ask:**
1. Does it scope by `facilityId`? (Any new table/query touching patient or
   user data that doesn't is a bug, not a shortcut.)
2. Does it fail loudly and specifically, not silently or generically? (A
   caught-and-swallowed error, or a bare `catch {}`, is a future 2am
   debugging session for someone else.)
3. Could a future contributor understand *why* this was built this way
   from a comment or a doc, without having to ask the person who wrote it?
4. If this fails partway (network drops, the DB is briefly unreachable,
   the person double-clicks), does it degrade gracefully — or corrupt
   state, duplicate a write, or leave the UI stuck?
5. Am I building for the scale this actually needs now (one facility,
   modest data volume) while keeping the door open for where it's
   explicitly headed (many facilities, states, countries) — not gold-plating
   for a scale that isn't real yet, and not painting into a corner either?

## Context

Next.js 14 + MySQL/Prisma + NextAuth antenatal-care data platform. Currently
one hospital in one Indian state; explicitly expected to grow to many
facilities, states, and eventually countries. Every foundational decision
should assume that trajectory without over-building for it today — see
"design for 10x, build for 10x, don't implement for 1000x" in
`docs/SCALING_PLAN.md`.

## 1. Error handling and reliability

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
- **Fault tolerance, not just error typing**: a dropped connection, a slow
  database, or a person double-clicking Save should never corrupt data or
  produce two records where one was intended. Prefer idempotent writes,
  keep the existing "disable the button the instant it's clicked" pattern
  non-negotiable for anything that mutates data, and don't assume a
  network call succeeds just because it was sent — every write path needs
  a real answer to "what happens if this fails halfway."
- Never silently swallow an error (an empty `catch {}` or a `.catch(() =>
  {})` with no comment explaining why it's genuinely safe to ignore) —
  either handle it, surface it, or log it with a one-line reason it's safe
  to ignore right there in the code.

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
- Before hardcoding any reference list (a country's regions, a set of
  categories), check whether it's genuinely small and stable (safe to
  hardcode, like Manipur's 16 districts or India's 28 states) or large
  and/or frequently changing (needs a real, sourced, maintainable dataset
  — never hand-typed from memory). See the district-scaling discussion for
  the reasoning.

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
- New pure logic in `domain/` gets a colocated `*.test.ts` (`npm test`
  runs the suite — see `docs/TESTING.md` for scope and philosophy). Not
  every change needs a new test, but a new branch of real logic in
  `domain/` — a new field-sanitization rule, a new classification case —
  usually does. CI (`.github/workflows/ci.yml`) runs lint + a full
  typecheck + this suite on every push/PR — a red run blocks merging that
  branch's problems into `main`, not something to work around.
