import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldInput from "./FieldInput";
import type { FieldConfig } from "@/domain/tabs";

const opts = ["Alpha", "Beta", "None: By Choice"];

const CASES: { label: string; field: FieldConfig; control: () => HTMLElement }[] = [
  { label: "text", field: { name: "f", label: "F", type: "text", maxLength: 10 }, control: () => screen.getByRole("textbox") },
  { label: "number", field: { name: "f", label: "F", type: "number" }, control: () => screen.getByRole("spinbutton") },
  { label: "date", field: { name: "f", label: "F", type: "date" }, control: () => document.getElementById("f")! },
  { label: "time", field: { name: "f", label: "F", type: "time" }, control: () => document.getElementById("f")! },
  { label: "textarea", field: { name: "f", label: "F", type: "textarea", maxLength: 50 }, control: () => screen.getByRole("textbox") },
  { label: "select", field: { name: "f", label: "F", type: "select", options: opts }, control: () => screen.getByRole("combobox") },
  {
    label: "select+allowOther",
    field: { name: "f", label: "F", type: "select", options: opts, allowOther: true },
    control: () => screen.getByRole("combobox"),
  },
  { label: "phone", field: { name: "f", label: "F", type: "phone" }, control: () => document.getElementById("f")! },
  { label: "radio", field: { name: "f", label: "F", type: "radio", options: opts }, control: () => screen.getByRole("radiogroup") },
  { label: "multiselect", field: { name: "f", label: "F", type: "multiselect", options: opts }, control: () => screen.getByRole("group") },
];

function renderField(field: FieldConfig, extra: Partial<React.ComponentProps<typeof FieldInput>> = {}) {
  return render(<FieldInput field={field} value="" onChange={() => {}} {...extra} />);
}

describe.each(CASES)("FieldInput ($label)", ({ field, control }) => {
  it("renders a control carrying the input id", () => {
    renderField(field);
    expect(control()).toHaveAttribute("id", "f");
  });

  it("with an error, flags aria-invalid and points aria-describedby at the rendered message", () => {
    renderField(field, { error: "Bad value" });
    const el = control();
    expect(el).toHaveAttribute("aria-invalid", "true");
    const target = document.getElementById(el.getAttribute("aria-describedby")!);
    expect(target).toHaveTextContent("Bad value");
  });

  it("without an error, is not invalid and has no dangling describedby", () => {
    renderField(field);
    expect(control()).not.toHaveAttribute("aria-invalid");
    expect(control()).not.toHaveAttribute("aria-describedby");
  });

  it("with help text and an error, describes by both, error first", () => {
    renderField({ ...field, helpText: "Some help" }, { error: "Bad value" });
    const ids = control().getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0])).toHaveTextContent("Bad value");
    expect(document.getElementById(ids[1])).toHaveTextContent("Some help");
  });
});

describe("FieldInput specifics", () => {
  it("radio: unique option ids, one shared scoped name", () => {
    renderField({ name: "f", label: "F", type: "radio", options: opts }, { idScope: "row-1" });
    const radios = screen.getAllByRole("radio");
    expect(new Set(radios.map((r) => r.id)).size).toBe(opts.length);
    expect(new Set(radios.map((r) => (r as HTMLInputElement).name))).toEqual(new Set(["row-1--f"]));
  });

  it("multiselect: aria-pressed reflects selection and flips on click", async () => {
    function Harness() {
      const [v, setV] = useState<string[]>([]);
      return <FieldInput field={{ name: "f", label: "F", type: "multiselect", options: opts }} value={v} onChange={setV} />;
    }
    render(<Harness />);
    const alpha = screen.getByRole("button", { name: "Alpha" });
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-pressed", "false");
  });

  it("does not put maxLength on a <select>", () => {
    renderField({ name: "f", label: "F", type: "select", options: opts, maxLength: 5 });
    expect(screen.getByRole("combobox")).not.toHaveAttribute("maxlength");
  });

  it("still applies maxLength to text controls", () => {
    renderField({ name: "f", label: "F", type: "text", maxLength: 5 });
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "5");
  });

  it("scopes the input id and applies ariaLabel", () => {
    renderField({ name: "f", label: "F", type: "text" }, { idScope: "s-2", ariaLabel: "F, entry 3" });
    expect(screen.getByRole("textbox", { name: "F, entry 3" })).toHaveAttribute("id", "s-2--f");
  });

  it("calls onChange when a radio is chosen", async () => {
    const onChange = vi.fn();
    renderField({ name: "f", label: "F", type: "radio", options: opts }, { onChange });
    await userEvent.click(screen.getByRole("radio", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("Beta");
  });
});
