import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SENTRY_DSN;
  });

  it("propagates requestId (and any other context) into the logged line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info({ requestId: "ab12cd34", userId: "u1" }, "did a thing");

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({ level: "info", msg: "did a thing", requestId: "ab12cd34", userId: "u1" });
  });

  it("routes warn/error to console.warn/console.error respectively", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.warn({ requestId: "r1" }, "a warning");
    log.error({ requestId: "r2" }, "an error");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warnSpy.mock.calls[0]![0] as string)).toMatchObject({ level: "warn", requestId: "r1" });
    expect(JSON.parse(errorSpy.mock.calls[0]![0] as string)).toMatchObject({ level: "error", requestId: "r2" });
  });

  it("never forwards to Sentry when SENTRY_DSN is unset (no-op path)", () => {
    delete process.env.SENTRY_DSN;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => log.error({ requestId: "r3" }, "boom")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
