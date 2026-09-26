import { describe, it, expect, vi, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { withApiErrorHandling } from "./withApiErrorHandling";
import { NotFoundError } from "./errors";

describe("withApiErrorHandling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches a matching x-request-id header on a successful response, without altering its body", async () => {
    const handler = withApiErrorHandling(async () => NextResponse.json({ ok: true }));
    const res = await handler();

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toMatch(/^[0-9a-f]{8}$/);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("translates a thrown AppError into its statusCode/code/detail, carrying a matching requestId in both the header and the JSON body", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = withApiErrorHandling(async () => {
      throw new NotFoundError("Patient not found.", "PATIENT.NOT_FOUND_IN_FACILITY");
    });
    const res = await handler();

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      error: "Patient not found.",
      code: "NOT_FOUND",
      detail: "PATIENT.NOT_FOUND_IN_FACILITY",
    });
    expect(body.requestId).toMatch(/^[0-9a-f]{8}$/);
    expect(res.headers.get("x-request-id")).toBe(body.requestId);
  });

  it("never leaks an unexpected error's message to the client, but does carry the same requestId that was logged", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrorHandling(async () => {
      throw new Error("some internal detail that must not reach the client");
    });
    const res = await handler();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).not.toContain("some internal detail");
    expect(body.requestId).toMatch(/^[0-9a-f]{8}$/);
    expect(res.headers.get("x-request-id")).toBe(body.requestId);

    // The stack trace reaches the server log, never the client.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0]![0] as string);
    expect(logged.requestId).toBe(body.requestId);
  });

  it("generates a fresh requestId per call, not a shared/module-level one", async () => {
    const handler = withApiErrorHandling(async () => NextResponse.json({ ok: true }));
    const res1 = await handler();
    const res2 = await handler();
    expect(res1.headers.get("x-request-id")).not.toBe(res2.headers.get("x-request-id"));
  });
});
