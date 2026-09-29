# Testing strategy

```bash
npm install
npm test            # single run
npm run test:watch  # re-runs on file change, for active development
```

The suite also runs on every push and pull request via GitHub Actions
(`.github/workflows/ci.yml`), alongside a lint pass and a full-project
`tsc --noEmit` typecheck. The typecheck catches a class of bugs the unit
tests deliberately don't reach — a wrong Prisma field name, a mismatched
prop type — so the two are complementary rather than redundant.

## Scope

Tests are written with Vitest and colocated next to the file they cover
(`domain/tabs/robson.ts` → `domain/tabs/robson.test.ts`). The suite covers
two layers, both chosen because they run with **zero mocking and zero
setup**: no database, no HTTP server, no DOM.

**`domain/` — pure, framework-free logic.** No React, Next.js, Prisma,
network or filesystem (see `docs/ARCHITECTURE.md`). This is the layer where
a silent bug is most expensive, since everything else builds on it without
re-checking:

- **`validation.ts`** — `sanitizeTabData` (the allowlist rebuild every save
  passes through, and the security boundary), `validateFieldValue`,
  `getIncompleteReasons`/`getFieldLevelErrors`. The highest-value target in
  the codebase: the most complex and most security-critical logic here.
- **`tabs/robson.ts`** — `computeRobsonGroup`, the WHO Ten-Group
  Classification algorithm. One test per real Robson group, so reading the
  test file *is* reading the clinical spec it implements.
- **`analytics/*`** — the full module set: `disclosureControl` (statistical
  de-identification, tested against the source spec's own `Thoubal: n=1`
  example rather than an arbitrary number), plus `segments`, `statistics`,
  `fieldRegistry`, `resolveValue`, `derivedFields` and `auditPayload`.
- **`gestationalAge.ts`**, **`fieldVisibility.ts`**, **`phone.ts`**,
  **`tabs/delivery.ts`** — the remaining domain logic with real branching
  behavior a regression could silently break.
- **`result.ts`**, **`textPatterns.ts`**, **`locale.ts`** — intentionally
  light: documenting the contract, not enumerating cases, because there is
  no complex branching in any of them to regress.

**`server/` modules with no database dependency.** These need no test
container, so they are unit-tested alongside `domain/`:

- The HTTP helpers — `parseJson`, `rateLimit`, `logger`, `audit`,
  `withApiErrorHandling`.
- The typed error hierarchies — `server/auth/errors.ts`,
  `server/patients/errors.ts`.
- Analytics aggregation — `aggregate.ts`, `analyticsService.ts`.
- Facility provisioning and patient facility-scoping
  (`patientScope.test.ts`), which encode the tenant boundary.

## Out of scope

- **Library internals** (Prisma, NextAuth, Next.js, recharts). They have
  their own suites; re-testing them adds maintenance cost with no realistic
  chance of catching a bug in this codebase.
- **Repositories and route handlers that need a live database.** These
  require a real or containerized MySQL — a heavier integration-test setup
  that would slow the suite from "runs in seconds with no config" to
  "needs infrastructure". The logic worth asserting has deliberately been
  pushed down into `domain/` and the pure `server/` modules above instead.
- **React components.** Component testing needs jsdom plus Testing Library,
  a meaningfully larger setup investment. The components are thin enough
  that the logic worth protecting already lives in the tested layers.
- **The 7 tab config files** (`personal.ts`, `investigation.ts`, ...).
  These are data, not logic — there is nothing to assert beyond "does this
  object have this key". Where a real tab config *is* used in a test
  (`fieldVisibility.test.ts` asserting `isCustomizable(investigationTab)`),
  it is because that specific decision — Investigation has nothing left to
  customize — is worth protecting from an accidental regression, not
  because the config needed testing.

## Adding a test

Colocate it next to the source, import from `vitest`, and follow the
existing files' shape: `describe` blocks named after the function, and `it`
blocks whose full sentence explains *why* the behavior matters, not just
what the assertion checks.

A test file should read as a description of the feature, not only a
pass/fail gate. That is a deliberate convention here: the gestational-age
and Robson files in particular are written so that reading them top to
bottom teaches the underlying clinical logic, rather than showing that a
function returns `5` for six magic strings.
