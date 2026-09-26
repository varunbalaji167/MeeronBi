"use client";

import { useEffect, useRef, useState } from "react";
import { Search, User, X } from "lucide-react";

export interface PatientOption {
  id: string;
  fullName: string;
  mrn: string | null;
}

interface Props {
  value: PatientOption | null;
  onChange: (patient: PatientOption | null) => void;
}

// Facility-scoped patient search for single-patient time-series mode; reuses `/api/patients`
// (already facility-scoped) rather than a new lookup, so scope can't drift between the two.
export default function PatientPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q, pageSize: "8" });
      fetch(`/api/patients?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((json) => setResults(json.patients ?? []))
        .catch(() => {
          setResults([]);
          setError(true);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  function choose(patient: PatientOption) {
    onChange(patient);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-ink">Patient</label>

      {value ? (
        <div className="input-field flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <span className="truncate text-ink">{value.fullName}</span>
            {value.mrn && <span className="shrink-0 text-xs text-ink-faint">· MRN {value.mrn}</span>}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear patient"
            className="shrink-0 rounded-full p-0.5 text-ink-faint hover:bg-line/60 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Search patients by name or MRN..."
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
          />
        </div>
      )}

      {open && !value && query.trim().length >= 2 && (
        <div className="animate-pop-in absolute z-20 mt-1.5 w-full origin-top overflow-hidden rounded-lg border border-line bg-white shadow-panel">
          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {loading && <p className="px-4 py-3 text-sm text-ink-faint">Searching...</p>}
            {!loading && error && <p className="px-4 py-3 text-sm text-ink-faint">Couldn&apos;t search patients — try again.</p>}
            {!loading && !error && results.length === 0 && (
              <p className="px-4 py-3 text-sm text-ink-faint">No patients match &ldquo;{query}&rdquo;.</p>
            )}
            {!loading &&
              !error &&
              results.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(p)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <User className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                  <span className="min-w-0 flex-1 truncate">{p.fullName}</span>
                  {p.mrn && <span className="shrink-0 text-xs text-ink-faint">MRN {p.mrn}</span>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
