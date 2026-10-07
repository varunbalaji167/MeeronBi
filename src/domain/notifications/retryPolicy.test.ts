import { describe, it, expect } from "vitest";
import { nextAttemptDelayMs, MAX_ATTEMPTS } from "./retryPolicy";

describe("nextAttemptDelayMs", () => {
  it("grows with each successive attempt", () => {
    const delays = [1, 2, 3, 4].map(nextAttemptDelayMs);
    expect(delays[1]!).toBeGreaterThan(delays[0]!);
    expect(delays[2]!).toBeGreaterThan(delays[1]!);
    expect(delays[3]!).toBeGreaterThanOrEqual(delays[2]!);
  });

  it("is capped at 30 minutes so a persistent failure doesn't push retries days out", () => {
    expect(nextAttemptDelayMs(10)).toBe(30 * 60_000);
    expect(nextAttemptDelayMs(100)).toBe(30 * 60_000);
  });

  it("returns a real number, not a throw, at attempts = MAX_ATTEMPTS", () => {
    expect(typeof nextAttemptDelayMs(MAX_ATTEMPTS)).toBe("number");
    expect(Number.isFinite(nextAttemptDelayMs(MAX_ATTEMPTS))).toBe(true);
  });

  it("treats attempts <= 0 as the first attempt rather than producing a negative or zero delay", () => {
    expect(nextAttemptDelayMs(0)).toBe(nextAttemptDelayMs(1));
    expect(nextAttemptDelayMs(-5)).toBe(nextAttemptDelayMs(1));
  });
});
