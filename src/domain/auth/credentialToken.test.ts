import { describe, it, expect } from "vitest";
import { checkToken, TTL_MS_BY_PURPOSE } from "./credentialToken";

const NOW = new Date("2024-06-01T00:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 60_000);
const PAST = new Date(NOW.getTime() - 60_000);

describe("checkToken", () => {
  it("is ok for a fresh, unconsumed, right-purpose token", () => {
    const token = { purpose: "PASSWORD_RESET" as const, expiresAt: FUTURE, consumedAt: null };
    expect(checkToken(token, "PASSWORD_RESET", NOW)).toBe("ok");
  });

  it("is consumed when consumedAt is set, even if still within its expiry window", () => {
    const token = { purpose: "PASSWORD_RESET" as const, expiresAt: FUTURE, consumedAt: PAST };
    expect(checkToken(token, "PASSWORD_RESET", NOW)).toBe("consumed");
  });

  it("is expired once `now` is past expiresAt", () => {
    const token = { purpose: "PASSWORD_RESET" as const, expiresAt: PAST, consumedAt: null };
    expect(checkToken(token, "PASSWORD_RESET", NOW)).toBe("expired");
  });

  it("treats the exact boundary (now === expiresAt) as expired, not ok", () => {
    const token = { purpose: "PASSWORD_RESET" as const, expiresAt: NOW, consumedAt: null };
    expect(checkToken(token, "PASSWORD_RESET", NOW)).toBe("expired");
  });

  it("reports wrong-purpose for an ACCOUNT_INVITE token checked against PASSWORD_RESET, even when otherwise valid — a 7-day invite must not be replayable against the 1-hour reset window", () => {
    const token = { purpose: "ACCOUNT_INVITE" as const, expiresAt: FUTURE, consumedAt: null };
    expect(checkToken(token, "PASSWORD_RESET", NOW)).toBe("wrong-purpose");
  });

  it("reports wrong-purpose rather than expired or consumed, even when the token is also expired/consumed", () => {
    const expiredAndConsumed = { purpose: "ACCOUNT_INVITE" as const, expiresAt: PAST, consumedAt: PAST };
    expect(checkToken(expiredAndConsumed, "PASSWORD_RESET", NOW)).toBe("wrong-purpose");
  });
});

describe("TTL_MS_BY_PURPOSE", () => {
  it("orders invite > verification > reset, so a shorter-lived purpose can never outlive a longer one", () => {
    expect(TTL_MS_BY_PURPOSE.ACCOUNT_INVITE).toBeGreaterThan(TTL_MS_BY_PURPOSE.EMAIL_VERIFICATION);
    expect(TTL_MS_BY_PURPOSE.EMAIL_VERIFICATION).toBeGreaterThan(TTL_MS_BY_PURPOSE.PASSWORD_RESET);
  });
});
