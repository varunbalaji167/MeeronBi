import { defineConfig } from "vitest/config";
import path from "path";

// Node is the default so the pure domain/server tests stay fast; only src/components/**
// pays the jsdom cost. tsconfig's `jsx: preserve` is for Next, so esbuild gets its own setting.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/components/**", "jsdom"]],
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "prisma/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Matches docs/TESTING.md's scope exactly: domain/, the DB-free server/
      // modules that have a colocated test, and the CS-register mapping.
      // Repositories and route handlers need a live database and are
      // deliberately out of scope (see that doc's "Out of scope" section)
      // rather than a coverage gap to chase — including them here would just
      // make the number meaningless.
      include: [
        "src/domain/**",
        "src/lib/design/**",
        "src/server/analytics/aggregate.ts",
        "src/server/analytics/analyticsService.ts",
        "src/server/auth/errors.ts",
        "src/server/email/transport.ts",
        "src/server/facilities/facilityProvisioning.ts",
        "src/server/http/**",
        "src/server/patients/errors.ts",
        "src/server/patients/patientScope.ts",
        "prisma/cs-register/**",
      ],
    },
  },
});
