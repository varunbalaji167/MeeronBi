"use client";

import { SectionConfig } from "@/domain/tabs";
import FieldInput from "../FieldInput";
import { fieldIds } from "../fieldIds";
import GestationalWindowBadge from "../GestationalWindowBadge";
import { GestationalAge } from "@/domain/gestationalAge";

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
  /** Only passed by tabs using `recommendedWindow` (currently Ultrasound). */
  ga?: GestationalAge | null;
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
  ga,
}: Props) {
  const fields = visibleFieldNames ? section.fields.filter((f) => visibleFieldNames.has(f.name)) : section.fields;
  if (fields.length === 0) return null; // every field in this section is hidden — don't render an empty panel

  const cols = section.columns ?? 3;
  const gridClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="panel">
      {section.title && (
        <h3 className="mb-4 flex flex-wrap items-center border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {section.title}
          {section.recommendedWindow && <GestationalWindowBadge window={section.recommendedWindow} ga={ga ?? null} />}
        </h3>
      )}
      <div className={`grid grid-cols-1 gap-4 ${gridClass}`}>
        {fields.map((field) => {
          const { inputId, labelId } = fieldIds(field.name);
          const isGroup = field.type === "radio" || field.type === "multiselect";
          return (
            <div key={field.name}>
              {isGroup ? (
                <span id={labelId} className="label-text">
                  {field.label}
                </span>
              ) : (
                <label className="label-text" htmlFor={inputId}>
                  {field.label}
                </label>
              )}
              <FieldInput
                field={field}
                value={data[field.name]}
                onChange={(v) => setField(field.name, v)}
                onBlur={() => onBlurField(field.name)}
                error={touched.has(field.name) ? errors[field.name] : null}
                disabled={readOnly}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
