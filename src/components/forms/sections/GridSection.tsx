"use client";

import { GridSectionConfig } from "@/domain/tabs";
import FieldInput from "../FieldInput";

interface Props {
  section: GridSectionConfig;
  data: Record<string, any>;
  setField: (name: string, value: any) => void;
  readOnly?: boolean;
}

export default function GridSection({ section, data, setField, readOnly }: Props) {
  return (
    <section className="panel overflow-x-auto">
      <h3 className="mb-4 border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        {section.title}
      </h3>
      <table className="w-full min-w-[600px] table-auto border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-faint">
            <th className="py-2 pr-4 font-medium">{section.rowLabelHeader ?? "Test"}</th>
            {section.valueColumns.map((c) => (
              <th key={c.name} className="py-2 pr-4 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, i) => (
            <tr key={row.name} className={`border-b border-line last:border-0 ${i % 2 === 1 ? "bg-paper/60" : ""}`}>
              <td className="py-2 pr-4 font-medium text-ink-soft">{row.label}</td>
              {section.valueColumns.map((col) => {
                const key = `${row.name}__${col.name}`;
                return (
                  <td key={col.name} className="py-2 pr-4">
                    <FieldInput
                      field={{ ...col, name: key } as any}
                      value={data[key]}
                      onChange={(v) => setField(key, v)}
                      disabled={readOnly}
                      compact
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
