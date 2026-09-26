"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, Check, X, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { AnalyticsFieldMeta } from "@/domain/analytics/types";
import { allTabs } from "@/domain/tabs";

const TAB_LABELS: Record<string, string> = Object.fromEntries(allTabs.map((tab) => [tab.key, tab.label]));

/** Groups a field's picker entry under its source tab's label, or "Derived" for computed fields. */
function groupLabelFor(field: AnalyticsFieldMeta): string {
  if (field.ref.kind === "derived") return "Derived";
  return TAB_LABELS[field.ref.tabKey] ?? field.ref.tabKey;
}

/** A stable string key for a FieldRef, used for equality checks and list keys. */
export function fieldRefKey(field: AnalyticsFieldMeta): string {
  const { ref } = field;
  if (ref.kind === "stored") return `stored:${ref.tabKey}:${ref.fieldName}`;
  if (ref.kind === "multiselectOption") return `multiselectOption:${ref.tabKey}:${ref.fieldName}:${ref.option}`;
  return `derived:${ref.id}`;
}

interface Props {
  /** The candidate list to pick from — callers source this from whichever `useAnalyticsFields`/`useTimeSeriesFields` hook (or filtered subset) fits their picker, inside their own Suspense boundary. */
  fields: AnalyticsFieldMeta[];
  value: AnalyticsFieldMeta | null;
  onChange: (field: AnalyticsFieldMeta) => void;
  label: string;
  placeholder?: string;
  /** Excludes one field (by `fieldRefKey`) from the list — e.g. the filter picker excluding the field already chosen for analysis, so it's impossible to pick the same field on both sides. */
  excludeKey?: string | null;
  /** When set, an inline clear (×) button appears once a value is chosen — used by an optional picker like the filter field. */
  onClear?: () => void;
}

export default function FieldPicker({ fields: allFields, value, onChange, label, placeholder = "Search fields to explore...", excludeKey, onClear }: Props) {
  const fields = useMemo(
    () => (excludeKey ? allFields.filter((f) => fieldRefKey(f) !== excludeKey) : allFields),
    [allFields, excludeKey]
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fields.filter((f) => !q || f.label.toLowerCase().includes(q) || groupLabelFor(f).toLowerCase().includes(q));
  }, [fields, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AnalyticsFieldMeta[]>();
    for (const f of filtered) {
      const key = groupLabelFor(f);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }
    return groups;
  }, [filtered]);

  function choose(field: AnalyticsFieldMeta) {
    onChange(field);
    setOpen(false);
    setQuery("");
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = filtered[activeIndex];
      if (chosen) choose(chosen);
    }
  }

  const selectedKey = value ? fieldRefKey(value) : null;
  let flatIndex = -1;

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          {value ? (
            <>
              {value.dataType === "ratio" ? (
                <BarChart3 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              ) : (
                <PieChartIcon className="h-3.5 w-3.5 shrink-0 text-gold-500" />
              )}
              <span className="truncate text-ink">{value.label}</span>
              <span className="shrink-0 text-xs text-ink-faint">· {groupLabelFor(value)}</span>
            </>
          ) : (
            <span className="text-ink-faint">Choose a field to explore…</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {onClear && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                }
              }}
              className="rounded-full p-0.5 text-ink-faint hover:bg-line/60 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="animate-pop-in absolute z-20 mt-1.5 w-full origin-top overflow-hidden rounded-lg border border-line bg-white shadow-panel">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              ref={searchRef}
              type="text"
              className="input-field pl-9"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>

          <div role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-faint">No fields match &ldquo;{query}&rdquo;.</p>
            )}
            {Array.from(grouped.entries()).map(([groupLabel, groupFields]) => (
              <div key={groupLabel}>
                <p className="sticky top-0 bg-paper px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {groupLabel}
                </p>
                {groupFields.map((f) => {
                  flatIndex += 1;
                  const key = fieldRefKey(f);
                  const active = flatIndex === activeIndex;
                  const selected = key === selectedKey;
                  return (
                    <button
                      type="button"
                      key={key}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => choose(f)}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                        active ? "bg-brand-50 text-brand-700" : "text-ink"
                      }`}
                    >
                      {f.dataType === "ratio" ? (
                        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                      ) : (
                        <PieChartIcon className="h-3.5 w-3.5 shrink-0 text-gold-500" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{f.label}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
