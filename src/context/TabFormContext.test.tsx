// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect } from "react";

const push = vi.fn();
const showToast = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ showToast }) }));

import { TabFormProvider, useTabForm } from "./TabFormContext";

let navigate: (href: string) => Promise<void>;

function Harness({ dirty, saveDraft }: { dirty: boolean; saveDraft: () => Promise<void> }) {
  const { setActiveForm, navigateWithAutosave } = useTabForm();
  navigate = navigateWithAutosave;
  useEffect(() => {
    setActiveForm({ tabKey: "t", dirty, data: {}, saveDraft });
    return () => setActiveForm(null);
  }, [dirty, saveDraft, setActiveForm]);
  return <div>harness</div>;
}

function mount(dirty: boolean, saveDraft: () => Promise<void>) {
  render(
    <TabFormProvider>
      <Harness dirty={dirty} saveDraft={saveDraft} />
    </TabFormProvider>,
  );
  expect(screen.getByText("harness")).toBeInTheDocument();
}

beforeEach(() => {
  push.mockClear();
  showToast.mockClear();
});

describe("navigateWithAutosave", () => {
  it("does NOT navigate when the autosave fails, and shows a toast with an action", async () => {
    mount(true, vi.fn().mockRejectedValue(new Error("boom")));
    await act(() => navigate("/next"));
    expect(push).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledTimes(1);
    const [, kind, opts] = showToast.mock.calls[0];
    expect(kind).toBe("error");
    expect(opts.action.label).toBe("Leave anyway");
  });

  it("navigates when the toast's 'Leave anyway' action is invoked", async () => {
    mount(true, vi.fn().mockRejectedValue(new Error("boom")));
    await act(() => navigate("/next"));
    showToast.mock.calls[0][2].action.onClick();
    expect(push).toHaveBeenCalledWith("/next");
  });

  it("navigates normally when a dirty form saves successfully", async () => {
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    mount(true, saveDraft);
    await act(() => navigate("/next"));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/next");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("navigates without saving when the form is clean", async () => {
    const saveDraft = vi.fn();
    mount(false, saveDraft);
    await act(() => navigate("/next"));
    expect(saveDraft).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/next");
  });
});
