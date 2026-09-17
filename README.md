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
| **Admin** (hospital staff) | Yes | Full create/read/update/delete on every patient record, all 7 tabs |
| **Patient** | Yes | Read-only view of *their own* record only |
| **General public** | No | `/public/trends` — aggregate, anonymized statistics only. No individual patient data is ever exposed on this route. |

Route protection is enforced in `src/middleware.ts` (redirects unauthenticated
or wrong-role users away from `/admin/*` and `/patient/*`) **and** re-checked
in every API route via `src/server/auth/guards.ts`, so the UI guard is not the
only line of defense.

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
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — first admin login

3. **Create the database schema**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed demo data**
   ```bash
   npm run seed
   ```
   This creates the first admin login, **and** one fully-filled-out demo
   patient ("Meikam Tombi Meitei", MRD `DEMO-0001`) with all 7 tabs marked
   **Complete** — realistic personal info, obstetric history, labs, scans, a
   completed delivery, a Robson Group 3 classification, and six visits' worth
   of measurements plus a medication course — so you can see what a finished
   record looks like immediately. It also creates a patient-portal login for
   her (`SEED_DEMO_PATIENT_EMAIL` / `SEED_DEMO_PATIENT_PASSWORD` in `.env`).
   The seed is idempotent — re-running it skips anything that already exists.

5. **Run the app**
   ```bash
   npm run dev
   ```
   - `http://localhost:3000` — public landing page
   - `http://localhost:3000/public/trends` — public trends (no login)
   - `http://localhost:3000/login?role=admin` — staff login (seeded admin) →
     open the demo patient from the Patients list to see a complete record
   - `http://localhost:3000/login?role=patient` — patient login (seeded demo
     patient credentials, or create a new one from the admin UI)

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
- Add rate limiting / audit logging on the admin API routes before deploying
  in a real clinical setting, and confirm the deployment meets your local
  health-data privacy regulations (e.g. access logging, encryption at rest).
- Phone validation uses a per-country expected-length table (India/US = 10
  digits, China = 11, etc. — see `src/domain/phone.ts`), enforced both in the
  browser (hard character cap) and on the server (sanitized on every save,
  and re-validated before a tab can be marked Complete). Countries not
  explicitly listed fall back to a conservative 7–12 digit range; add exact
  rules for more countries there rather than loosening that default.
  Postal codes are free text for the same reason — formats vary too much
  globally for one pattern.
