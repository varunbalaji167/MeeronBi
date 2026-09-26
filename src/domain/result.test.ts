import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, mapResult, matchResult } from "./result";

describe("Result<T, E>", () => {
  it("ok()/err() build the two shapes, and isOk/isErr narrow between them", () => {
    const success = ok(42);
    const failure = err("ANALYTICS.UNKNOWN_FIELD");

    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    if (isOk(success)) expect(success.value).toBe(42);

    expect(isErr(failure)).toBe(true);
    if (isErr(failure)) expect(failure.error).toBe("ANALYTICS.UNKNOWN_FIELD");
  });

  it("mapResult transforms a success value and leaves an error untouched", () => {
    expect(mapResult(ok(2), (n) => n * 10)).toEqual(ok(20));
    expect(mapResult(err("boom"), (n: number) => n * 10)).toEqual(err("boom"));
  });

  it("matchResult forces handling both branches in one expression", () => {
    const render = (r: ReturnType<typeof ok<number>> | ReturnType<typeof err<string>>) =>
      matchResult(r, (v) => `got ${v}`, (e) => `failed: ${e}`);

    expect(render(ok(5))).toBe("got 5");
    expect(render(err("nope"))).toBe("failed: nope");
  });
});
