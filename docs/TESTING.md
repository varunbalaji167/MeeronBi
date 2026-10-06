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

## The three CI gates

The unit suite is one of three independent gates, each catching a class of
failure the others structurally cannot:

| Job | Catches |
|---|---|
| `verify` | Logic bugs, type errors, lint regressions. Seconds, no services. |
| `app` | **Does this commit break the app at all?** Applies every migration to an empty MySQL, builds the real production bundle, boots it, and probes it. |
| `security` | Committed secrets (gitleaks, full history), insecure patterns (Semgrep), and vulnerable production dependencies (`scripts/audit-gate.mjs`). |

The `app` job exists because lint, typecheck and unit tests together still
cannot tell you whether the app *runs*. A broken `next.config.mjs`, a
migration that only ever worked incrementally on one laptop, a Server
Component importing something that can't be bundled, a dropped security
header — all of them pass `verify` and fail in production. That job is the
only place the real build, the real migrations and the real server meet.

### The smoke test

`scripts/smoke.sh` probes a *running* instance and is the same script CI
and the deploy both use. Beyond liveness, it asserts the things that are
silently catastrophic rather than loudly broken:

- `/api/health` answers `ok` **and its timestamp changes between calls** —
  a prerendered health check would report `ok` against a dead database and
  would also blind the deploy's rollback gate.
- Every protected route still refuses an unauthenticated visitor: `/admin`,
  `/patient` and `/researcher` redirect, and the API routes return 401. A
  200 here means a guard or middleware stopped being applied — the single
  worst regression this app can ship, and completely invisible to the unit
  suite.
- The five security headers from `next.config.mjs` are present and
  `X-Powered-By` is absent.
- With `--with-login` (CI only, never production), a real NextAuth
  credentials sign-in issues a session cookie and reaches `/admin`, which
  exercises bcrypt, the user table and the session callback end to end.

Run it against a local dev server with `npm run smoke http://localhost:3000`.

### Running the security scans locally

```bash
npm run security      # gitleaks + Semgrep + the dependency audit gate
npm run audit:gate    # just the production dependency gate
```

`scripts/audit-gate.mjs` blocks on any high/critical advisory in the
**production** dependency tree that is not explicitly accepted in
`.github/audit-allowlist.json`. Every acceptance needs a reason specific to
this app and an expiry date, so an ignored advisory comes back as a CI
failure instead of quietly becoming permanent. devDependency advisories are
reported but never block, since they don't reach the deployed app.

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
