import { defineConfig } from "vitest/config";
import path from "path";

// Node-only environment for pure TS unit tests (no DOM, no React).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
  },
});
