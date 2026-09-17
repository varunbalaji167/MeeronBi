"use client";

import { useState } from "react";
import { TabConfig, isPlainSection } from "@/domain/tabs";
import { getCustomizableFields } from "@/domain/fieldVisibility";
import Spinner from "../ui/Spinner";
import { SlidersHorizontal, X, Check, Info } from "lucide-react";

interface Props {
  tab: TabConfig;
  /** Applied to the heading so the surrounding dialog can reference it via aria-labelledby. */
  titleId?: string;
  enabledFieldNames: Set<string>;
  /** Fields that currently have a value — shown as a hint so unchecking one is an informed choice. */
  fieldsWithData: Set<string>;
  onSave: (names: string[]) => Promise<void>;
  onClose: () => void;
}

export default function FieldCustomizer({ tab, titleId, enabledFieldNames, fieldsWithData, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(enabledFieldNames));
  const [saving, setSaving] = useState(false);

  const plainSections = tab.sections.filter(isPlainSection);
  const totalCustomizable = getCustomizableFields(tab).length;
  const hidingDataCount = Array.from(fieldsWithData).filter((name) => !selected.has(name)).length;

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(Array.from(selected));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel border-l-2 border-gold-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id={titleId} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-brand-600" /> Customize Fields — {tab.label}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Choose which of the {totalCustomizable} optional fields below your hospital wants to collect.
            Unchecking a field hides it from this form — including fields that already have data (that
            data isn't deleted, and still shows in the patient's own record).
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 max-h-80 space-y-4 overflow-y-auto pr-1">
        {plainSections.map((section, idx) => (
          <div key={idx}>
            {section.title && (
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {section.title}
              </p>
            )}
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {section.fields.map((field) => {
                const willHideData = fieldsWithData.has(field.name) && !selected.has(field.name);
                return (
                  <label key={field.name} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={selected.has(field.name)}
                      onChange={() => toggle(field.name)}
                      disabled={field.core}
                      className="h-3.5 w-3.5 accent-brand-500"
                    />
                    <span className={willHideData ? "text-gold-600" : undefined}>{field.label}</span>
                    {field.core && <span className="text-xs text-ink-faint">(always on)</span>}
                    {willHideData && (
                      <span className="text-xs text-gold-600" title="This field has data and will be hidden from this form">
                        (has data)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hidingDataCount > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {hidingDataCount} field{hidingDataCount > 1 ? "s" : ""} with existing data will be hidden from
          this form after saving.
        </div>
      )}

      <div className="mt-4 flex gap-2 border-t border-line pt-4">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" light /> : <Check className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Selection"}
        </button>
        <button type="button" className="btn-ghost border border-line" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
