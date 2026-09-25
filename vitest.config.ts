import { defineConfig } from "vitest/config";
import path from "path";

// Deliberately minimal: domain/ is pure TypeScript (no React, no Next.js,
// no Prisma — see docs/ARCHITECTURE.md), so this needs neither a DOM
// environment nor any plugin beyond the same "@/*" path alias
// tsconfig.json already defines. See docs/TESTING.md for what's tested
// here and, just as importantly, what's deliberately NOT (server/ routes,
// React components) and why.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
