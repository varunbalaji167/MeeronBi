# MeeronBi — Antenatal Care Data Analytics

[![CI](https://github.com/varunbalaji167/MeeronBi/actions/workflows/ci.yml/badge.svg)](https://github.com/varunbalaji167/MeeronBi/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/varunbalaji167/MeeronBi/graph/badge.svg)](https://codecov.io/gh/varunbalaji167/MeeronBi)

**[Live demo →](https://meeronbi-test.eikhoi.net)**

A multi-tenant antenatal-care data platform: hospital staff record structured
clinical data across 7 tabs per patient, patients get a read-only portal to
their own record, and approved researchers run cohort analytics over
anonymized, disclosure-controlled aggregates — never raw patient rows. Built
for one hospital today, with every design decision (tenant isolation, field
customization per facility, i18n-ready phone/locale handling) assuming it
grows to many facilities, states, and countries.

**Stack**: Next.js 14 (App Router) · MySQL via Prisma · NextAuth (credentials
+ Google OAuth) · Vitest · GitHub Actions CI/CD with automatic health-checked
deploys and rollback.

**Engineering highlights**:
- Facility-scoped multi-tenancy enforced at the guard layer, not just in the
  UI — a cross-tenant access attempt returns `404`, never `403`, so a tenant
  boundary is never even confirmed to exist.
- Statistical disclosure control on every analytics query (small-cell
  suppression), so aggregate data can never be narrowed down to re-identify
  an individual patient.
- A pure, framework-free `domain/` layer (zero-setup unit tests, no mocking)
  holding every clinically/legally sensitive rule — validation, the WHO
  Robson classification, de-identification — see
  [`docs/TESTING.md`](docs/TESTING.md).
- Zero-downtime deploys: a release builds alongside the one already serving
  traffic, flips over atomically, and rolls itself back automatically if its
  health check fails — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

**For how the codebase is organized, why, and exactly where to make any given
change, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).** The rest of this
README is setup + a feature tour.

## Roles

| Role | Login required | Access |
|---|---|---|
| **Super Admin** (MeeronBi team) | Yes | Everything, across every facility — no facility-scoping applies. Also reviews researcher access requests at `/admin/researchers`. |
| **Admin** (hospital staff) | Yes | Full create/read/update/delete on every patient record, all 7 tabs — scoped to their own facility only |
| **Patient** | Yes | Read-only view of *their own* record only |
| **Researcher** | Yes, once approved | Aggregate analytics only (`/researcher`) — never per-patient records. Request access at `/researcher-access`; a Super Admin reviews it. |
| **General public** | No | `/public/trends` — aggregate, anonymized statistics only. No individual patient data is ever exposed on this route. |

Route protection is enforced in `src/middleware.ts` (redirects unauthenticated
or wrong-role users away from `/admin/*`, `/patient/*`, and `/researcher/*`)
**and** re-checked in every API route via `src/server/auth/guards.ts`, so the
UI guard is not the only line of defense. Multi-tenancy (`facilityId`) is the
other half of that boundary — see `docs/SCALING_PLAN.md` §3 for the full
reasoning, and `prisma/seed-second-facility.ts` for a script that lets you
verify facility isolation actually works rather than just trusting it.

## Feature tour

- **Draft support** — every tab has a `DRAFT`/`COMPLETE` status. Save as Draft
  never validates anything; Mark Complete checks a small set of
  `requiredFields` per tab (see `src/domain/tabs/*.ts`).
- **Autosave** — leaving a tab with unsaved changes (via the tab stepper)
  saves it as a draft automatically first (`src/context/TabFormContext.tsx`).
- **Field-level validation** — phone numbers, postal codes, and clinically
  plausible ranges (height/weight/haemoglobin/Apgar/etc.) are validated
  inline as you leave a field, with hard character/digit caps enforced in the
  browser itself so invalid values can't even be typed (`src/domain/validation.ts`,
  `src/components/forms/FieldInput.tsx`).
- **International by default** — phone numbers are country-code + national
  number pairs (`src/domain/phone.ts`, `src/domain/countryCodes.ts`), and
  postal codes are free text rather than assuming one country's format — the
  app doesn't assume any single country's conventions.
- **Customize fields** — most hospitals won't want all 137 original fields.
  Each tab's optional fields can be toggled on/off hospital-wide via a
  "Customize fields" panel; a small `core` set ships enabled by default. See
  `src/domain/fieldVisibility.ts` and the "Field visibility" section in
  `docs/ARCHITECTURE.md`.
- **Auth** — 30-day JWT session cookie with role/patientId embedded, so
  navigating the app never re-prompts for login (`src/server/auth/authOptions.ts`,
  `src/context/AuthContext.tsx`).
- **Navigation** — public pages get a normal top nav; hospital staff and
  patients each get their own left sidebar (`src/components/layout/AppSidebar.tsx`),
  collapsing into a drawer on mobile.
- **Toasts & loading states** — `src/context/ToastContext.tsx` (top-center,
  auto-dismissing, dismissible) / `src/components/ui/Spinner.tsx`, used
  everywhere instead of `alert()`/`confirm()` — see
  `src/components/ui/ConfirmDialog.tsx` for the styled replacement for
  native browser confirmation dialogs.
- **Two levels of delete** — each tab has its own "Delete [tab] data"
  (clears just that tab), and the patient header has a separate "Delete
  entire patient" that removes the patient and every tab's data, with its
  own confirmation dialog.
- **Analytics** — cohort breakdowns and repeated-measure time series over any
  field in the registry, at `/admin/analytics` for staff and `/researcher` for
  approved researchers. Results pass through statistical disclosure control
  (`src/domain/analytics/disclosureControl.ts`), which suppresses small cells
  by audience tier so aggregates can't be narrowed down to an individual;
  every query is audit-logged. Design reference:
  [`docs/ANALYTICS.md`](docs/ANALYTICS.md).

## Patient portal login — how it works

Patients don't self-register; staff grant access per patient, choosing **per
patient** between two methods:

1. In the admin patient view (any tab), click **"Manage patient portal login"**
   next to the patient's name.
2. Enter the patient's email, then pick one:
   - **Give them a password now** — today's in-person handover: type a
     temporary password and share it with the patient through whatever
     channel your hospital uses. This sends no email — deliberately, since the
     address on file may be a placeholder or a relative's, and staff are
     handing the credential over directly.
   - **Email them a set-up link** — no password is typed; an invite link is
     emailed instead, valid for 7 days. Only use this when the address on file
     is genuinely the patient's own — whoever can read that inbox can open the
     record.
   Either way this calls `POST /api/patients/[id]`, which enforces **exactly
   one login per patient** — updating their existing account in place if they
   already have one, and refusing any email already used by someone else
   (`src/server/patients/portalAccessService.ts`).
3. The patient signs in at `/login?role=patient` (with the password you gave
   them, or after following the emailed link to set their own). They land on
   `/patient`, seeing all 7 tabs for their own record only, entirely
   read-only.
4. To reset access, staff repeat steps 1–2 with the same email — or the
   patient can use **"Forgot password"** at `/login?role=patient` themselves,
   since self-serve password reset now covers every account type, not just
   this flow.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — your MySQL connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — first hospital-admin login
   - `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` — first Super
     Admin login (every facility, plus reviewing researcher requests)
   - `SMTP_*` / `EMAIL_FROM` — optional; outbound mail prints to the console
     instead of sending while unset
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional; the Google
     sign-in button only appears once both are set (see `docs/DEPLOYMENT.md`)

3. **Create the database schema**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed demo data**
   ```bash
   npm run seed
   ```
   This is idempotent — re-running it skips anything that already exists.
   It creates, all at once:

   | Account | Role | Login | Password |
   |---|---|---|---|
   | MeeronBi Team | Super Admin | `SEED_SUPER_ADMIN_EMAIL` | `SEED_SUPER_ADMIN_PASSWORD` |
   | System Admin | Admin (default facility) | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |
   | Meikam Tombi Meitei | Patient (portal) | `SEED_DEMO_PATIENT_EMAIL` | `SEED_DEMO_PATIENT_PASSWORD` |
   | Dr. Priya Menon | Researcher — **pending** | `priya.pending@example.org` | `ResearcherDemo123!` |
   | Dr. Arjun Iyer | Researcher — **approved** | `arjun.approved@example.org` | `ResearcherDemo123!` |
   | R. Fernandes | Researcher — **rejected** | `rejected.request@example.org` | `ResearcherDemo123!` |

   Plus two patient records in the default facility: **Meikam Tombi Meitei**
   (MRD `DEMO-0001`) with all 7 tabs marked **Complete** — realistic personal
   info, obstetric history, labs, scans, a completed delivery, a Robson
   Group 3 classification, and six visits' worth of measurements plus a
   medication course — and **Rajkumari Ibemhal Devi** (MRD `DEMO-0002`), a
   **Draft** record with only the Personal tab started, so the incomplete/
   draft states aren't something you have to create by hand either.

   To actually verify facility isolation (not just trust it), run
   `npx tsx prisma/seed-second-facility.ts` separately — see that file's own
   comment for the manual QA steps it sets up.

   For realistic Analytics volume, `npx tsx prisma/seed-cs-register.ts`
   (add `--dry-run` to preview) loads 60 synthetic deliveries shaped like a
   real 2020 caesarean-section register (`prisma/cs-register/`): 30 into the
   default facility, 15 each into two demo facilities it creates. Names and
   MRDs (`CSR-001`…) are synthetic, DOBs are derived from age, and it
   creates no user accounts.

5. **Run the app**
   ```bash
   npm run dev
   ```
   - `http://localhost:3000` — public landing page
   - `http://localhost:3000/public/trends` — public trends (no login)
   - `http://localhost:3000/login?role=admin` — staff login (seeded admin, or
     the Super Admin account) → open a patient from the Patients list
   - `http://localhost:3000/login?role=patient` — patient login (seeded demo
     patient credentials, or create a new one from the admin UI)
   - `http://localhost:3000/login?role=researcher` — researcher login; try
     the pending and rejected accounts above to see their specific sign-in
     messages, and the approved one to reach `/researcher`
   - `http://localhost:3000/researcher-access` — submit a new researcher
     request yourself, then approve/reject it signed in as the Super Admin
     at `http://localhost:3000/admin/researchers`

## Running the tests

```bash
npm test            # unit suite, single run
npm run test:watch  # re-runs on file change
npm run verify      # lint + typecheck + unit suite (mirrors CI)
npm run security    # secret scan + SAST + dependency audit
```

Domain-layer unit tests only (pure logic — no database needed) — see
[`docs/TESTING.md`](docs/TESTING.md) for exactly what's covered, what's
deliberately not, and why.

## CI and deployment

Every push and pull request runs three parallel gates
([`docs/TESTING.md`](docs/TESTING.md)):

- **`verify`** — lint, full-project typecheck, unit suite
- **`app`** — applies migrations to a throwaway MySQL, runs the real
  production build, boots it and smoke-tests the running app
- **`security`** — secret scanning over full git history, Semgrep SAST, and a
  dependency audit with an expiring allowlist

A green run on `main` deploys automatically: the release is built alongside
the running one, swapped in atomically, then health- and smoke-checked — and
rolled back on its own if either fails. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Extending the app

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#where-does-x-go) for a
task-by-task guide (adding a field, adding a whole tab, adding an API route,
adding validation, etc.) — the short version is: **domain config lives in
`src/domain/tabs/*.ts`, business logic in `src/server/`, and pages/routes in
`src/app/` should stay thin.**

## Notes / next steps for production

- Passwords are hashed with bcrypt; make sure `NEXTAUTH_SECRET` is a strong,
  private value in production and HTTPS is enforced.
- Facility admins and invited patients get a set-password link by email, never
  a typed temporary password (`src/server/email/`, `scripts/email-worker.ts`).
  Provisioning an admin or sending a patient invite now depends on that
  worker running — see `docs/DEPLOYMENT.md`.
- Google sign-in is additive, never a replacement: every provisioned account
  keeps its password path, and Google can sign into an existing account but
  only ever create one for researcher self-signup
  (`src/domain/auth/googleSignIn.ts`).
- Mutating writes are audit-logged to the `AuditLog` table
  (`src/server/http/audit.ts`), and rate limiting is applied to sign-in and the
  unauthenticated routes (`src/server/http/rateLimit.ts`). The admin API routes
  are not yet rate-limited; add that before deploying in a real clinical
  setting, and confirm the deployment meets your local health-data privacy
  regulations (e.g. access logging, encryption at rest).
- Phone validation uses a per-country expected-length table (India/US = 10
  digits, China = 11, etc. — see `src/domain/phone.ts`), enforced both in the
  browser (hard character cap) and on the server (sanitized on every save,
  and re-validated before a tab can be marked Complete). Countries not
  explicitly listed fall back to a conservative 7–12 digit range; add exact
  rules for more countries there rather than loosening that default.
  Postal codes are free text for the same reason — formats vary too much
  globally for one pattern.
