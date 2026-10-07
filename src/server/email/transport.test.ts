import { describe, it, expect, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("getMailer", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns the console transport and does not throw when RESEND_API_KEY is unset outside production", async () => {
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();

    const { getMailer } = await import("./transport");
    expect(() => getMailer()).not.toThrow();
    await expect(getMailer().send({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>" })).resolves.toBeUndefined();
  });

  it("throws the typed error when RESEND_API_KEY is unset in production", async () => {
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();

    const { getMailer } = await import("./transport");
    expect(() => getMailer()).toThrow(/EMAIL\.TRANSPORT_UNCONFIGURED|not configured/i);
  });
});
