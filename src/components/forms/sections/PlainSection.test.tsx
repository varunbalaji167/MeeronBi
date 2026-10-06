import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PlainSection from "./PlainSection";
import type { FieldConfig, SectionConfig } from "@/domain/tabs";

const options = ["A", "B"];
const fields: FieldConfig[] = [
  { name: "t", label: "Text", type: "text", helpText: "help" },
  { name: "n", label: "Number", type: "number" },
  { name: "d", label: "Date", type: "date" },
  { name: "tm", label: "Time", type: "time" },
  { name: "ta", label: "Textarea", type: "textarea" },
  { name: "s", label: "Select", type: "select", options },
  { name: "so", label: "Select other", type: "select", options, allowOther: true },
  { name: "p", label: "Phone", type: "phone" },
  { name: "r", label: "Radio", type: "radio", options },
  { name: "m", label: "Multi", type: "multiselect", options },
];

function renderSection(errorFor: string[] = []) {
  const section: SectionConfig = { title: "S", fields };
  return render(
    <PlainSection
      section={section}
      data={{}}
      setField={() => {}}
      errors={Object.fromEntries(errorFor.map((n) => [n, `${n} is bad`]))}
      touched={new Set(errorFor)}
      onBlurField={() => {}}
    />
  );
}

describe("PlainSection", () => {
  it("points a text field's <label for> at an element that exists", () => {
    const { container } = renderSection();
    const label = container.querySelector("label.label-text")!;
    expect(document.getElementById(label.getAttribute("for")!)).not.toBeNull();
  });

  it("emits no orphaned <label for> and names radio/multiselect groups instead", () => {
    const { container } = renderSection();
    for (const label of container.querySelectorAll("label[for]")) {
      expect(document.getElementById(label.getAttribute("for")!), label.textContent ?? "").not.toBeNull();
    }
    for (const name of ["r", "m"]) {
      const group = document.getElementById(name)!;
      const labelledBy = document.getElementById(group.getAttribute("aria-labelledby")!);
      expect(labelledBy?.tagName).toBe("SPAN");
    }
    expect(container.querySelector('label[for="r"], label[for="m"]')).toBeNull();
  });

  it("renders help text once, via the field control", () => {
    const { getAllByText } = renderSection();
    expect(getAllByText("help")).toHaveLength(1);
  });

  it("shows an error for radio and multiselect fields", () => {
    const { getByText } = renderSection(["r", "m"]);
    expect(getByText("r is bad")).toBeInTheDocument();
    expect(getByText("m is bad")).toBeInTheDocument();
  });

  it("produces no duplicate ids with every field type present", () => {
    renderSection(fields.map((f) => f.name));
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});
