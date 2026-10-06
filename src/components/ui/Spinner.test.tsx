// Proof that the jsdom harness is wired up; it guards the harness, not Spinner.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Spinner from "./Spinner";

describe("Spinner", () => {
  it("renders an svg with the animate-spin class", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("animate-spin");
  });

  it("uses the brand colour by default and white when `light`", () => {
    const { container, rerender } = render(<Spinner />);
    expect(container.querySelector("svg")).toHaveClass("text-brand-500");
    rerender(<Spinner light />);
    expect(container.querySelector("svg")).toHaveClass("text-white");
  });
});
