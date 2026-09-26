// Sentry init for the browser bundle. Hand-written (not via `npx
// @sentry/wizard`, which needs an interactive login) — see
// docs/FOUNDATION_PLAN.md Workstream A #3. Env-var-gated: with no
// SENTRY_DSN set, `Sentry.init` receives `dsn: undefined` and the SDK
// no-ops (no network calls, no console noise) — local dev is unaffected.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session Replay is a paid/limited Sentry feature and isn't part of this
  // plan's scope — deliberately left off rather than half-configured.
});
