"use client";

import { RepeatingSectionConfig } from "@/domain/tabs";
import FieldInput from "../FieldInput";
import { Plus, X } from "lucide-react";

interface Props {
  section: RepeatingSectionConfig;
  rows: any[];
  onCellChange: (rowIndex: number, fieldName: string, value: any) => void;
  onAddRow: () => void;
  onRemoveRow: (rowIndex: number) => void;
  readOnly?: boolean;
}

export default function RepeatingSection({
  section,
  rows,
  onCellChange,
  onAddRow,
  onRemoveRow,
  readOnly,
}: Props) {
  const displayRows = section.fixedCount
    ? Array.from({ length: section.fixedCount }, (_, i) => rows[i] || {})
    : rows;

  return (
    <section className="panel overflow-x-auto">
      <div className="mb-4 flex items-center justify-between border-l-2 border-brand-200 pl-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{section.title}</h3>
        {!section.fixedCount && !readOnly && (
          <button type="button" onClick={onAddRow} className="btn-secondary !px-3 !py-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> {section.addRowLabel ?? "Add row"}
          </button>
        )}
      </div>

      {section.fixedCount ? (
        // Transposed layout: one column per fixed slot (e.g. G1..G6), one row per field.
        <table className="w-full min-w-[900px] table-auto border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-faint">
              <th className="py-2 pr-4 font-medium">Info</th>
              {displayRows.map((_, i) => (
                <th key={i} className="py-2 pr-4 font-medium">
                  {(section.columnLabelPrefix ?? "Item") + (i + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.fields.map((field, fieldIdx) => (
              <tr key={field.name} className={`border-b border-line last:border-0 align-top ${fieldIdx % 2 === 1 ? "bg-paper/60" : ""}`}>
                <td className="py-2 pr-4 font-medium text-ink-soft">{field.label}</td>
                {displayRows.map((rowData, i) => (
                  <td key={i} className="py-2 pr-4">
                    <FieldInput
                      field={field}
                      value={rowData?.[field.name]}
                      onChange={(v) => onCellChange(i, field.name, v)}
                      disabled={readOnly}
                      compact
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Regular layout: one row per entry, one column per field.
        <table className="w-full min-w-[900px] table-auto border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-faint">
              <th className="py-2 pr-2 font-medium">#</th>
              {section.fields.map((f) => (
                <th key={f.name} className="py-2 pr-4 font-medium">
                  {f.label}
                </th>
              ))}
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={section.fields.length + 2} className="py-4 text-center text-ink-faint/70">
                  No entries yet.
                </td>
              </tr>
            )}
            {displayRows.map((rowData, i) => (
              <tr key={i} className={`border-b border-line last:border-0 align-top ${i % 2 === 1 ? "bg-paper/60" : ""}`}>
                <td className="py-2 pr-2 text-ink-faint/70">{i + 1}</td>
                {section.fields.map((field) => (
                  <td key={field.name} className="py-2 pr-4">
                    <FieldInput
                      field={field}
                      value={rowData?.[field.name]}
                      onChange={(v) => onCellChange(i, field.name, v)}
                      disabled={readOnly}
                      compact
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(i)}
                      className="flex items-center gap-1 text-xs text-rose-500 hover:underline"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
