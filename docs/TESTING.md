# Testing strategy

Status: **a real domain/ unit test suite now exists** — the first item on
`docs/SCALING_PLAN.md` Phase 0's checklist. Run it with:

```bash
npm install
npm test          # single run
npm run test:watch  # re-runs on file change, for active development
```

Also runs automatically on every push and pull request via GitHub Actions
(`.github/workflows/ci.yml`), alongside a lint pass and a full-project
`tsc --noEmit` typecheck — the typecheck in particular catches classes of
bugs (a wrong Prisma field name, a mismatched prop type) outside what the
domain/-only test suite below reaches.

## What's tested, and why this is "optimal" rather than exhaustive

Every test lives under `src/domain/` (as `*.test.ts`, colocated next to the
file it tests — `domain/tabs/robson.ts` → `domain/tabs/robson.test.ts`),
because `domain/` is **pure, framework-free TypeScript**: no React, no
Next.js, no Prisma, no network, no filesystem (see `docs/ARCHITECTURE.md`).
That's what makes it possible to test with zero mocking and zero setup
cost — and it's exactly the layer where a silent bug is most expensive,
since it's the layer everything else (API routes, the UI, Analytics)
builds on without re-checking.

**Covered, deliberately:**

- **`validation.ts`** — `sanitizeTabData` (the allowlist rebuild every save
  goes through — the security boundary), `validateFieldValue`,
  `getIncompleteReasons`/`getFieldLevelErrors`. The highest-value target in
  the whole codebase to have tests for: it's the newest, most complex, and
  most security-critical logic here.
- **`tabs/robson.ts`** — `computeRobsonGroup`, the WHO Ten-Group
  Classification algorithm. One test per real Robson group, so reading the
  test file *is* reading the clinical spec this implements.
- **`analytics/disclosureControl.ts`** — the statistical
  de-identification logic. Tested against the source spec's own real
  example (`Thoubal: n=1`) rather than an arbitrary number, so it's
  obvious *why* each assertion exists.
- **`gestationalAge.ts`**, **`fieldVisibility.ts`**, **`phone.ts`**,
  **`tabs/delivery.ts`** — the other pieces of domain logic with real
  branching behavior a regression could silently break.
- **`result.ts`**, **`textPatterns.ts`** — light, intentionally short:
  documenting the contract, not exhaustively enumerating cases, because
  there's no complex branching logic in either to actually regress.

**Deliberately NOT covered here, and why that's the right call, not a gap
to feel bad about:**

- **Library internals** (Prisma, NextAuth, Next.js itself, recharts, ...).
  They have their own test suites; re-testing that `Array.prototype.filter`
  works is exactly the kind of "100% coverage" busywork that adds
  maintenance cost with zero chance of ever catching a real bug.
- **`server/`** (repositories, guards, API routes). This is where the
  *next* test-writing effort should go, but it needs a real (or
  test-container) database — a genuinely different, heavier kind of test
  (integration, not unit) that shouldn't block or dilute the domain/ suite.
  `docs/ARCHITECTURE.md`'s testing-strategy note already flags this as the
  second-highest priority, after domain/.
- **React components.** Lowest priority to automate, per that same note —
  thin enough that manual verification (or real end-to-end tests later)
  covers them reasonably well for now, and component testing needs jsdom +
  Testing Library, a meaningfully bigger setup investment than the
  zero-config domain/ suite above.
- **The 7 tab config files themselves** (`personal.ts`, `investigation.ts`,
  ...). These are data, not logic — there's nothing to assert beyond "does
  this object have this key," which isn't a meaningful test. Where a real
  tab config IS used in a test (`fieldVisibility.test.ts` checks
  `isCustomizable(investigationTab)`), it's because that specific,
  previously-made decision ("Investigation has nothing left to customize")
  is exactly the kind of thing worth protecting from an accidental
  regression — not because the config itself needed testing.

## Adding a test for new domain logic

Colocate it (`domain/foo.ts` → `domain/foo.test.ts`), import from
`vitest`, and follow the existing files' shape: `describe` blocks named
after the function, `it` blocks whose full sentence explains *why* that
behavior matters, not just *what* the assertion checks. A test file should
be readable as a description of the feature on its own, not just a
pass/fail gate — that's a deliberate choice here, not a style nitpick: the
gestational-age and Robson test files in particular are written so that
reading them top to bottom teaches you the actual clinical logic, not just
"this function returns 5 when given these six magic strings."
