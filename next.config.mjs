import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  env: {
    // Client bundle needs a NEXT_PUBLIC_ var; mirrors the server-side SENTRY_DSN.
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // HSTS only in production — sending it in local http:// dev breaks localhost for weeks.
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Narrowed from "*" to the real origin — CVE-2025-55183 mitigation.
    serverActions: {
      allowedOrigins: [process.env.NEXT_PUBLIC_APP_ORIGIN || "localhost:3000"],
    },
    // Required for instrumentation.ts (Sentry server/edge init) to run.
    instrumentationHook: true,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
});
