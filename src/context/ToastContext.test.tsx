// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastContext";
import type { ToastKind } from "@/lib/toastQueue";

function Trigger({ message = "Hello", kind, action }: { message?: string; kind?: ToastKind; action?: boolean }) {
  const { showToast } = useToast();
  return (
    <button
      onClick={() => showToast(message, kind, action ? { action: { label: "Retry", onClick: () => {} } } : undefined)}
    >
      fire
    </button>
  );
}

function setup(props: Parameters<typeof Trigger>[0] = {}) {
  const utils = render(
    <ToastProvider>
      <Trigger {...props} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText("fire"));
  return utils;
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ToastProvider", () => {
  it("auto-dismisses a success toast after its timer, via the exit phase", () => {
    setup({ kind: "success" });
    expect(screen.getByText("Hello")).toBeInTheDocument();
    advance(4200);
    expect(screen.getByText("Hello")).toBeInTheDocument(); // still exiting
    advance(160);
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  it("does not dismiss an error at 4200ms but does by ~12s", () => {
    setup({ kind: "error" });
    advance(4200 + 160);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    advance(12000);
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  it("never auto-dismisses a toast with an action", () => {
    setup({ kind: "success", action: true });
    advance(60_000);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("manual dismiss removes the toast and clears its timer", () => {
    setup({ kind: "success" });
    fireEvent.click(screen.getByLabelText("Dismiss"));
    advance(160);
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unmount clears pending timers and causes no later state update", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = setup({ kind: "success" });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(20_000);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("uses role=alert for errors and role=status for successes", () => {
    const { unmount } = setup({ kind: "error" });
    expect(screen.getByRole("alert")).toHaveTextContent("Hello");
    unmount();
    setup({ kind: "success" });
    expect(screen.getByRole("status")).toHaveTextContent("Hello");
  });

  it("collapses repeated identical toasts into one with a ×N counter", () => {
    setup({ kind: "error" });
    fireEvent.click(screen.getByText("fire"));
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getAllByText("Hello")).toHaveLength(1);
    expect(screen.getByText("×3")).toBeInTheDocument();
  });
});
