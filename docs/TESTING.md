# Testing and CI

## Running locally

| Command | Does |
|---|---|
| `npm test` | Unit suite, single run |
| `npm run test:watch` | Unit suite, re-runs on change |
| `npm run verify` | lint + typecheck + unit suite — mirrors CI's `verify` job |
| `npm run security` | gitleaks + Semgrep + dependency audit gate |
| `npm run audit:gate` | Production dependency audit only |
| `npm run smoke <url>` | Probe a running instance |

`npm run verify && npm run security` before pushing reproduces everything CI
checks except the build-and-boot gate.

## CI pipeline

`.github/workflows/ci.yml` runs three jobs in parallel on every push and pull
request. A green run on `main` triggers deployment (`docs/DEPLOYMENT.md`).

| Job | Verifies | Typical |
|---|---|---|
| `verify` | Lint, full-project `tsc --noEmit`, unit suite | ~2 min |
| `app` | Migrations apply to an empty MySQL, production build succeeds, app boots and answers correctly | ~3 min |
| `security` | No committed secrets, no flagged code patterns, no unaccepted dependency advisories | ~3 min |

A fourth job, `ci-passed`, aggregates the three into one status so branch
protection (when available) requires a single check.

### `verify`

Lint and typecheck cover ground the unit suite deliberately does not: a wrong
Prisma field name or a mismatched prop type is caught by `tsc`, not by tests.

### `app`

The gate that answers *does this commit break the app*. Lint, typecheck and
unit tests together cannot tell you whether it runs — a broken
`next.config.mjs`, a migration that only ever ran incrementally on one
machine, a Server Component importing something unbundlable, or a dropped
security header all pass `verify` and fail in production.

Against a throwaway MySQL 8.4 service container it:

1. Applies every migration from an empty database, then checks `schema.prisma`
   against `prisma/migrations/` for drift.
2. Runs the real production build.
3. Seeds, starts the built app, and runs `scripts/smoke.sh --with-login`.

On failure it prints the application log, so a 500 in a smoke assertion comes
with the stack trace that caused it.

### Smoke test

`scripts/smoke.sh` probes a running instance. CI and the deploy health gate
use the same script, so what passes in CI is what is checked in production.

21 assertions across four groups:

- **Liveness** — `/api/health` reports `ok` with a reachable database, and its
  timestamp changes between calls. A prerendered health check would report
  `ok` against a dead database and would also blind the deploy's rollback gate.
- **Public surfaces** — `/login`, `/public/trends`, `/researcher-access` and
  `/api/public/trends` render; unknown routes 404.
- **Auth boundary** — `/admin`, `/patient` and `/researcher` redirect an
  unauthenticated visitor; protected API routes return 401. A 200 here means a
  guard or middleware stopped being applied, which the unit suite cannot see.
- **Security headers** — the five headers from `next.config.mjs` are present
  and `X-Powered-By` is absent.

`--with-login` adds a real NextAuth credentials sign-in, exercising bcrypt,
the user table and the session callback end to end. CI only — against
production it would be a real login attempt with real credentials, so the
deploy's own smoke run omits it.

### `security`

| Check | Tool | Blocks on |
|---|---|---|
| Committed secrets | gitleaks, full git history | Any finding |
| Code patterns | Semgrep CE, OSS rulesets | ERROR severity |
| Dependencies | `scripts/audit-gate.mjs` | Unaccepted high/critical in the **production** tree |

Semgrep stands in for CodeQL, which requires paid GitHub Advanced Security on
private repositories.

`audit-gate.mjs` blocks on any high or critical advisory in the production
dependency tree that is not explicitly accepted in
`.github/audit-allowlist.json`. Each acceptance carries a reason specific to
this app and an **expiry date**, so a deferred advisory returns as a CI
failure rather than becoming permanent. devDependency advisories are reported
but never block — they do not reach the deployed app.

Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm and
GitHub Actions; each one runs this same pipeline.

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

**`prisma/cs-register/` — the CS-register import mapping.** Pure, like
`domain/`: every rule turning the hospital register's free-typed columns
into tab values, plus whole-file checks that the committed register maps
only to values the forms accept and reproduces the clinician's own Robson
group on every row.

## Out of scope

- **Library internals** (Prisma, NextAuth, Next.js, recharts). They have
  their own suites; re-testing them adds maintenance cost with no realistic
  chance of catching a bug in this codebase.
- **Repositories and route handlers that need a live database.** These
  require a real or containerized MySQL — a heavier integration-test setup
  that would slow the suite from "runs in seconds with no config" to
  "needs infrastructure". The logic worth asserting has deliberately been
  pushed down into `domain/` and the pure `server/` modules above instead.
  Note that CI's `app` job *does* exercise these against a real MySQL, but
  black-box through `scripts/smoke.sh` — "does this route still answer
  correctly", not "is this repository function correct for every input".
  That boundary is deliberate: the smoke test is a breakage detector, not a
  substitute for pushing logic down into a testable layer.
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
