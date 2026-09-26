// Sentry init for the Node.js server runtime. See sentry.client.config.ts
// for the env-var-gating rationale (no SENTRY_DSN → no-op).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
