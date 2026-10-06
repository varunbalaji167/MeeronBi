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

describe("EmptyState illustrations", () => {
  it.each(["patients", "entries", "results", "notFound"] as const)("renders the %s illustration, decorative only", (name) => {
    const { container } = render(<EmptyState illustration={name} title="Nothing here" />);
    const svg = container.querySelector(`svg[data-illustration="${name}"]`);
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("prefers the illustration over the icon", () => {
    const { container } = render(<EmptyState illustration="patients" icon={<i data-testid="icon" />} title="Empty" />);
    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders no glyph slot when neither icon nor illustration is given", () => {
    const { container } = render(<EmptyState title="Bare" />);
    expect(container.querySelector("svg, [aria-hidden]")).toBeNull();
  });
});
