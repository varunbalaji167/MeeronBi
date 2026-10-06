import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { TabConfig } from "@/domain/tabs";
import { ApiError } from "@/lib/apiClient";

const showToast = vi.fn();
let registered: { saveDraft: () => Promise<void> } | null = null;

vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/context/TabFormContext", () => ({
  useTabForm: () => ({
    setActiveForm: (s: { saveDraft: () => Promise<void> } | null) => {
      registered = s;
    },
  }),
}));

import DynamicForm from "./DynamicForm";

const tab: TabConfig = {
  key: "personal",
  label: "Personal",
  route: "personal",
  sections: [{ title: "Basics", fields: [{ name: "mrn", label: "MRD", type: "text" }] }],
};

function renderForm(onSave: (d: Record<string, any>, s: "DRAFT" | "COMPLETE") => Promise<Record<string, string> | void>) {
  render(<DynamicForm tab={tab} initialData={{}} initialStatus="DRAFT" onSave={onSave} />);
}

function edit() {
  fireEvent.change(screen.getByLabelText(/MRD/), { target: { value: "123" } });
}

const draftBtn = () => screen.getByRole("button", { name: /Save as Draft/ });

beforeEach(() => {
  showToast.mockClear();
  registered = null;
});

describe("DynamicForm save", () => {
  it("shows 'needs attention' rather than a plain Saved timestamp when onSave returns fieldErrors", async () => {
    renderForm(vi.fn().mockResolvedValue({ mrn: "Already in use" }));
    edit();
    fireEvent.click(draftBtn());
    expect(await screen.findByText("Saved — one field needs attention")).toBeInTheDocument();
    expect(screen.queryByText(/^Saved \d/)).not.toBeInTheDocument();
  });

  it("shows the timestamp when onSave resolves clean", async () => {
    renderForm(vi.fn().mockResolvedValue(undefined));
    edit();
    fireEvent.click(draftBtn());
    expect(await screen.findByText(/^Saved \d/)).toBeInTheDocument();
    expect(screen.queryByText(/needs attention/)).not.toBeInTheDocument();
  });

  it("propagates the same ApiError instance to the caller and stays silent when silentError is set", async () => {
    const err = new ApiError("nope", 500, "INTERNAL" as any);
    renderForm(vi.fn().mockRejectedValue(err));
    edit();
    await waitFor(() => expect(registered).not.toBeNull());
    let caught: unknown;
    await act(async () => {
      await registered!.saveDraft().catch((e) => (caught = e));
    });
    expect(caught).toBe(err);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("disables both save buttons while a save is in flight", async () => {
    let resolve!: () => void;
    renderForm(() => new Promise<void>((r) => (resolve = r)));
    edit();
    fireEvent.click(draftBtn());
    const saving = await screen.findByRole("button", { name: /Saving/ });
    expect(saving).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /Mark Complete/ })).toHaveAttribute("aria-disabled", "true");
    await act(async () => resolve());
  });
});
