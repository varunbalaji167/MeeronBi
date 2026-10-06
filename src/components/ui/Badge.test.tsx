import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "./Badge";

describe("Badge", () => {
  it("renders the draft variant", () => {
    render(<Badge variant="draft">Draft</Badge>);
    expect(screen.getByText("Draft")).toHaveClass("bg-gold-50", "text-gold-600");
  });

  it("renders the complete variant and appends className", () => {
    render(
      <Badge variant="complete" className="ml-2">
        Done
      </Badge>,
    );
    expect(screen.getByText("Done")).toHaveClass("bg-brand-50", "text-brand-700", "ml-2");
  });
});
