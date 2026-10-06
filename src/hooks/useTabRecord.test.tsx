// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTabRecord } from "./useTabRecord";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();
const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("useTabRecord", () => {
  it("given initialRecord, starts loaded and performs no fetch", () => {
    const { result } = renderHook(() => useTabRecord("p1", "personal", { data: { a: 1 }, status: "COMPLETE" }));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ a: 1 });
    expect(result.current.status).toBe("COMPLETE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("given no initialRecord, fetches on mount as before", async () => {
    fetchMock.mockReturnValue(ok({ data: { b: 2 }, status: "DRAFT" }));
    const { result } = renderHook(() => useTabRecord("p1", "personal"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/patients/p1/personal");
    expect(result.current.data).toEqual({ b: 2 });
  });

  it("fetches when the tab changes after seeding, so callers must remount per tab to reuse a seed", async () => {
    fetchMock.mockReturnValue(ok({ data: { n: 1 }, status: "DRAFT" }));
    const { result, rerender } = renderHook(({ route }) => useTabRecord("p1", route, { data: {}, status: "DRAFT" }), {
      initialProps: { route: "personal" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ route: "history" });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(fetchMock).toHaveBeenCalledWith("/api/patients/p1/history");
  });

  it.each([
    ["with initialRecord", { data: {}, status: "DRAFT" as const }],
    ["without initialRecord", undefined],
  ])("save still PUTs to the API route %s", async (_label, initialRecord) => {
    fetchMock.mockReturnValue(ok({ data: {}, status: "DRAFT" }));
    const { result } = renderHook(() => useTabRecord("p1", "personal", initialRecord));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchMock.mockClear();

    await act(async () => {
      await result.current.save({ x: 1 }, "DRAFT");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/patients/p1/personal");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ data: { x: 1 }, status: "DRAFT" });
  });
});
