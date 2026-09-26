import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { consumeToken, getClientIp, withRateLimit, _resetRateLimitState } from "./rateLimit";
import { RateLimitError } from "./errors";

describe("consumeToken", () => {
  beforeEach(() => {
    _resetRateLimitState();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows up to `limit` requests within the window, then denies the next one", () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 5; i++) {
      expect(consumeToken("k", 5, 60_000)).toBe(true);
    }
    expect(consumeToken("k", 5, 60_000)).toBe(false);
  });

  it("refills gradually over the window instead of only ever resetting all-at-once", () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    // Exhaust a 5-per-60s bucket.
    for (let i = 0; i < 5; i++) expect(consumeToken("k", 5, 60_000)).toBe(true);
    expect(consumeToken("k", 5, 60_000)).toBe(false);

    // 30s at 5 tokens/60s refills ~2.5 tokens, enough for 2 more requests.
    now += 30_000;
    expect(consumeToken("k", 5, 60_000)).toBe(true);
    expect(consumeToken("k", 5, 60_000)).toBe(true);
    expect(consumeToken("k", 5, 60_000)).toBe(false);
  });

  it("keeps separate buckets per key", () => {
    const now = 0;
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(consumeToken("a", 1, 60_000)).toBe(true);
    expect(consumeToken("a", 1, 60_000)).toBe(false);
    // A different key's bucket is unaffected.
    expect(consumeToken("b", 1, 60_000)).toBe(true);
  });

  it("is back to full capacity once the window has fully elapsed", () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    expect(consumeToken("k", 3, 60_000)).toBe(true);
    expect(consumeToken("k", 3, 60_000)).toBe(true);
    expect(consumeToken("k", 3, 60_000)).toBe(true);
    expect(consumeToken("k", 3, 60_000)).toBe(false);

    now += 60_000;
    for (let i = 0; i < 3; i++) expect(consumeToken("k", 3, 60_000)).toBe(true);
    expect(consumeToken("k", 3, 60_000)).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers x-forwarded-for, taking only the first (client-nearest) hop", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then to \"unknown\"", () => {
    expect(getClientIp(new Request("http://localhost/api/x", { headers: { "x-real-ip": "203.0.113.9" } }))).toBe(
      "203.0.113.9"
    );
    expect(getClientIp(new Request("http://localhost/api/x"))).toBe("unknown");
  });
});

describe("withRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitState();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes requests through until the per-IP limit is exceeded, then throws RateLimitError with the given detail", async () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withRateLimit({ key: "test.route", limit: 2, windowMs: 60_000, detail: "RATE_LIMIT.TEST" })(handler);
    const req = new Request("http://localhost/api/x", { headers: { "x-forwarded-for": "1.2.3.4" } });

    await wrapped(req);
    await wrapped(req);
    expect(handler).toHaveBeenCalledTimes(2);

    let thrown: unknown;
    try {
      await wrapped(req);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(RateLimitError);
    expect((thrown as RateLimitError).statusCode).toBe(429);
    expect((thrown as RateLimitError).code).toBe("RATE_LIMITED");
    expect((thrown as RateLimitError).detail).toBe("RATE_LIMIT.TEST");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("rate-limits different IPs independently", async () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withRateLimit({ key: "test.route", limit: 1, windowMs: 60_000, detail: "RATE_LIMIT.TEST" })(handler);

    const reqA = new Request("http://localhost/api/x", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const reqB = new Request("http://localhost/api/x", { headers: { "x-forwarded-for": "2.2.2.2" } });

    await wrapped(reqA);
    await wrapped(reqB);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
