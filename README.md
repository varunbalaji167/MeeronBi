# MeeronBi — Antenatal Care Data Analytics

Next.js 14 (App Router) + MySQL (via Prisma) + NextAuth, rebuilt from the
Google Apps Script prototype's 7 data-collection tabs (Personal, History,
Investigation, Ultrasound, Delivery, Robson, Treatments).

**For how the codebase is organized, why, and exactly where to make any given
change, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).** This README is
just setup + a feature tour.

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

Patients don't self-register; staff grant access per patient:

1. In the admin patient view (any tab), click **"Manage patient portal login"**
   next to the patient's name.
2. Enter the patient's email and a temporary password. This calls
   `POST /api/patients/[id]`, which enforces **exactly one login per patient**
   — updating their existing account in place if they already have one, and
   refusing any email already used by someone else
   (`src/server/patients/portalAccessService.ts`).
3. Share the email + temporary password with the patient through whatever
   channel your hospital uses (not emailed automatically — see "Notes for
   production" below).
4. The patient signs in at `/login?role=patient`. They land on `/patient`,
   seeing all 7 tabs for their own record only, entirely read-only.
5. To reset a password, staff repeat steps 1–2 with the same email.

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
   (add `--dry-run` to preview) loads 60 de-identified deliveries from a real
   2020 caesarean-section register (`prisma/cs-register/`): 30 into the
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
npm test          # single run
npm run test:watch  # re-runs on file change
```

Domain-layer unit tests only (pure logic — no database needed) — see
[`docs/TESTING.md`](docs/TESTING.md) for exactly what's covered, what's
deliberately not, and why.

## Extending the app

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#where-does-x-go) for a
task-by-task guide (adding a field, adding a whole tab, adding an API route,
adding validation, etc.) — the short version is: **domain config lives in
`src/domain/tabs/*.ts`, business logic in `src/server/`, and pages/routes in
`src/app/` should stay thin.**

## Notes / next steps for production

- Passwords are hashed with bcrypt; make sure `NEXTAUTH_SECRET` is a strong,
  private value in production and HTTPS is enforced.
- The patient-portal login is created manually by staff per patient. For a
  self-service flow, add a signed invite-link/email step instead of typing a
  temporary password directly.
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
