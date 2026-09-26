// Next.js's instrumentation hook — runs once per runtime at boot, before
// any request is handled. Loads the matching Sentry config file for
// whichever runtime this process actually is, so sentry.server.config.ts
// never gets bundled into the Edge runtime (and vice versa).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Covers server-rendering errors (React Server Components, route handlers
// Sentry's own instrumentation doesn't already wrap) — API route errors are
// still captured explicitly in withApiErrorHandling.ts's unexpected-error
// branch, which is the one this app's own error JSON/requestId depends on.
type CaptureRequestError = typeof import("@sentry/nextjs").captureRequestError;

export const onRequestError = process.env.SENTRY_DSN
  ? async (...args: Parameters<CaptureRequestError>) => {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureRequestError(...args);
    }
  : undefined;
