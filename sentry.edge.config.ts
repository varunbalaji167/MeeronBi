// Sentry init for the Edge runtime (middleware, edge routes). See
// sentry.client.config.ts for the env-var-gating rationale.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
