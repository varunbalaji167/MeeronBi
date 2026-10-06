import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Button from "./Button";

describe("Button", () => {
  it.each([
    ["primary", "bg-brand-500"],
    ["secondary", "bg-brand-50"],
    ["danger", "text-rose-600"],
    ["ghost", "text-ink-soft"],
    ["outline", "border-line"],
  ] as const)("renders the %s variant classes", (variant, cls) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button")).toHaveClass(cls);
  });

  it("renders size classes and never the legacy btn-* class", () => {
    const { rerender } = render(<Button size="sm">Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-3", "py-1", "text-xs");
    expect(screen.getByRole("button").className).not.toMatch(/btn-|!/);
    rerender(<Button size="md">Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-4", "py-2", "text-sm");
  });

  it("appends className rather than replacing the variant", () => {
    render(<Button className="ml-auto">Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("ml-auto", "bg-brand-500");
  });

  it("calls onClick when enabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading shows a spinner, sets aria-busy and blocks onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabledReason sets aria-disabled, renders an sr-only reason, blocks onClick and stays focusable", () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="No changes to save" onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).not.toBeDisabled();
    expect(btn.tabIndex).not.toBe(-1);
    expect(screen.getByText("No changes to save")).toHaveClass("sr-only");
    btn.focus();
    expect(btn).toHaveFocus();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders icon with aria-hidden", () => {
    render(<Button icon={<svg data-testid="ic" />}>Go</Button>);
    expect(screen.getByTestId("ic").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});
