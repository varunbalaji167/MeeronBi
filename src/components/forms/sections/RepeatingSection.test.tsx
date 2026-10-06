import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RepeatingSection from "./RepeatingSection";
import type { RepeatingSectionConfig } from "@/domain/tabs";

const base: RepeatingSectionConfig = {
  kind: "repeating",
  name: "preg",
  title: "Pregnancies",
  columnLabelPrefix: "G",
  fields: [
    { name: "outcome", label: "Outcome", type: "text" },
    { name: "mode", label: "Mode", type: "radio", options: ["A", "B"] },
    { name: "tags", label: "Tags", type: "multiselect", options: ["X", "Y"] },
  ],
};

function renderRows(section: RepeatingSectionConfig) {
  return render(
    <RepeatingSection
      section={section}
      rows={[{}, {}, {}]}
      onCellChange={() => {}}
      onAddRow={() => {}}
      onRemoveRow={() => {}}
    />
  );
}

describe.each([
  ["row layout", base],
  ["transposed layout", { ...base, transposed: true }],
])("RepeatingSection (%s)", (_, section) => {
  it("keeps every id unique across 3 rows", () => {
    renderRows(section);
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("gives radio groups in different rows different names", () => {
    renderRows(section);
    const names = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((r) => r.name);
    expect(new Set(names).size).toBe(3);
  });

  it("labels each control with its field and entry", () => {
    const { getAllByLabelText } = renderRows(section);
    expect(getAllByLabelText(/^Outcome, /)).toHaveLength(3);
  });
});
