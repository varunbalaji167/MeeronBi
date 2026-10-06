# MeeronBi — Antenatal Care Data Analytics

[![CI](https://github.com/varunbalaji167/MeeronBi/actions/workflows/ci.yml/badge.svg)](https://github.com/varunbalaji167/MeeronBi/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/varunbalaji167/MeeronBi/graph/badge.svg)](https://codecov.io/gh/varunbalaji167/MeeronBi)

**[Live demo →](https://meeronbi-test.eikhoi.net)**

MeeronBi is a platform for antenatal care — one connected record from first
visit to delivery, built so hospital staff, patients, and approved researchers
each see their part of it. It is designed to
scale to many facilities, states, and countries.

## Who uses it

```mermaid
flowchart LR
  Staff["🏥 Hospital staff<br/>record care"] -->|writes| Record[("Patient<br/>record")]
  Record -->|read-only| Patient["👤 Patient<br/>sees own record"]
  Record -->|anonymised<br/>aggregates| Researcher["🔬 Researcher<br/>cohort analytics"]
  Record -->|public<br/>trends| Public["🌐 Anyone<br/>no login"]
  SuperAdmin["⚙️ Super Admin"] -.->|approves| Researcher
  SuperAdmin -.->|oversees| Staff
```

| Role | Access |
|---|---|
| **Hospital staff** | Create and edit patient records at their own facility. |
| **Patient** | Read-only view of their own record. |
| **Researcher** | Aggregate analytics only — never per-patient data. Access is reviewed. |
| **Super Admin** | Cross-facility oversight and researcher approval. |
| **Public** | A `/public/trends` page with aggregate statistics only. |

## Architecture at a glance

```mermaid
flowchart TB
  subgraph browser["Browser"]
    UI["Next.js pages<br/>(App Router)"]
  end
  subgraph server["Server"]
    Guards["Auth guards<br/>+ facility scoping"]
    Services["Business logic<br/>(server/)"]
    Domain["Pure domain<br/>(validation, Robson,<br/>analytics)"]
  end
  DB[("MySQL<br/>via Prisma")]
  UI -->|HTTP| Guards --> Services --> Domain
  Services --> DB
```

Three ideas carry most of the design:

1. **One tenant boundary, enforced in one place.** Every row touching patient
   data is scoped by `facilityId`; the guard layer refuses cross-facility
   access without even confirming the record exists.
2. **A framework-free domain layer.** Clinical rules, validation, and
   anonymisation live in plain TypeScript with no database or React imports,
   so they are unit-testable without any setup.
3. **Aggregates only for research and public pages.** Analytics queries pass
   through disclosure control that suppresses small cells, so a cohort can
   never be narrowed down to one patient.

Full layout, dependency rules, and a "where does X go" table live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![NextAuth](https://img.shields.io/badge/NextAuth.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Google](https://img.shields.io/badge/Google_OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

CI/CD is health-checked with automatic rollback on a failed release.

## Quick start

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, NEXTAUTH_SECRET, SEED_* accounts
npx prisma migrate dev
npm run seed               # idempotent demo data
npm run dev                # http://localhost:3000
```

The seed creates one of each account type (super admin, hospital admin,
patient portal, researchers in each review state) and two patient records —
one complete, one draft — so every screen has real data on first load. The
seeded logins print to the console; the full table of accounts lives in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

For production setup — email, Google sign-in, zero-downtime deploys — see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Tests & CI

```bash
npm run verify     # lint + typecheck + unit tests (what CI runs)
npm run security   # secret scan + SAST + dependency audit
```

Three parallel CI gates run on every push: `verify`, a full `app` gate (real
migrations, real build, smoke-tested on a booted instance), and `security`.
A green `main` deploys automatically and rolls itself back on a failed health
check. Scope and reasoning: [`docs/TESTING.md`](docs/TESTING.md).

## Learn more

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code layout, layers, "where does X go" |
| [`docs/SCALING_PLAN.md`](docs/SCALING_PLAN.md) | Foundation plan, known gaps, phased roadmap |
| [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | Design reference for the analytics feature |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production setup, deploys, rollback |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Symptom → fix for CI, deploy, and production |
| [`docs/TESTING.md`](docs/TESTING.md) | Test strategy and CI gates |
| [`docs/INPUT_VALIDATION.md`](docs/INPUT_VALIDATION.md) | Field-by-field input/validation audit |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Backup/restore policy decisions |
| [`CLAUDE.md`](CLAUDE.md) | Session primer for Claude Code — reads first |
