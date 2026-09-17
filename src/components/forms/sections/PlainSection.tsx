"use client";

import { SectionConfig } from "@/domain/tabs";
import FieldInput from "../FieldInput";

interface Props {
  section: SectionConfig;
  data: Record<string, any>;
  setField: (name: string, value: any) => void;
  readOnly?: boolean;
  errors: Record<string, string>;
  touched: Set<string>;
  onBlurField: (name: string) => void;
  /** null/undefined = show every field (no customization applies to this tab). */
  visibleFieldNames?: Set<string> | null;
}

export default function PlainSection({
  section,
  data,
  setField,
  readOnly,
  errors,
  touched,
  onBlurField,
  visibleFieldNames,
}: Props) {
  const fields = visibleFieldNames ? section.fields.filter((f) => visibleFieldNames.has(f.name)) : section.fields;
  if (fields.length === 0) return null; // every field in this section is hidden — don't render an empty panel

  const cols = section.columns ?? 3;
  const gridClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="panel">
      {section.title && (
        <h3 className="mb-4 border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {section.title}
        </h3>
      )}
      <div className={`grid grid-cols-1 gap-4 ${gridClass}`}>
        {fields.map((field) => (
          <div key={field.name}>
            <label className="label-text" htmlFor={field.name}>
              {field.label}
            </label>
            <FieldInput
              field={field}
              value={data[field.name]}
              onChange={(v) => setField(field.name, v)}
              onBlur={() => onBlurField(field.name)}
              error={touched.has(field.name) ? errors[field.name] : null}
              disabled={readOnly}
            />
            {field.helpText && <p className="mt-1 text-xs text-ink-faint/70">{field.helpText}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
