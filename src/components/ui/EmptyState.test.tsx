import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(<EmptyState icon={<svg />} title="No patients" description="Add one to begin." />);
    expect(screen.getByText("No patients")).toBeInTheDocument();
    expect(screen.getByText("Add one to begin.")).toBeInTheDocument();
  });

  it("renders the action only when given", () => {
    const { rerender } = render(<EmptyState icon={<svg />} title="Empty" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<EmptyState icon={<svg />} title="Empty" action={<button>Add</button>} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
