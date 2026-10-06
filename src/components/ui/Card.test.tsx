import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Card from "./Card";

describe("Card", () => {
  it("renders children with default padding and no header", () => {
    const { container } = render(<Card>Body</Card>);
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("p-5", "rounded-lg");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders the title, titleAfter and actions slots", () => {
    render(
      <Card title="Vitals" titleAfter={<span>GA badge</span>} actions={<button>Add</button>}>
        Body
      </Card>,
    );
    expect(screen.getByRole("heading", { name: /Vitals/ })).toBeInTheDocument();
    expect(screen.getByText("GA badge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("supports scrollX, padding none and the `as` element", () => {
    const { container } = render(
      <Card as="div" scrollX padding="none">
        x
      </Card>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("overflow-x-auto");
    expect(el).not.toHaveClass("p-5");
  });
});
