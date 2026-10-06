// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFieldVisibility } from "./useFieldVisibility";

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

describe("useFieldVisibility", () => {
  it("given an initialSelection, starts loaded and performs no fetch", () => {
    const { result } = renderHook(() => useFieldVisibility("history", true, ["a", "b"]));
    expect(result.current.loading).toBe(false);
    expect(result.current.storedSelection).toEqual(["a", "b"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a null initialSelection (never configured) as seeded too", () => {
    const { result } = renderHook(() => useFieldVisibility("history", true, null));
    expect(result.current.loading).toBe(false);
    expect(result.current.storedSelection).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("given no initialSelection, fetches on mount as before", async () => {
    fetchMock.mockReturnValue(ok({ enabledFieldNames: ["x"] }));
    const { result } = renderHook(() => useFieldVisibility("history", true));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/field-config/history");
    expect(result.current.storedSelection).toEqual(["x"]);
  });

  it("does nothing when disabled", () => {
    const { result } = renderHook(() => useFieldVisibility("robson", false));
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("save still PUTs to the API route when seeded", async () => {
    fetchMock.mockReturnValue(ok({ ok: true }));
    const { result } = renderHook(() => useFieldVisibility("history", true, ["a"]));
    await act(async () => {
      await result.current.save(["a", "c"]);
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/field-config/history");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ enabledFieldNames: ["a", "c"] });
    expect(result.current.storedSelection).toEqual(["a", "c"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
