import { afterEach } from "vitest";

// Only under jsdom, so the node-environment tests don't pay to load Testing Library.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  // Vitest globals are off, so RTL's automatic cleanup never registers itself.
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
