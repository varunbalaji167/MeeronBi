"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { patientListHref } from "./patientListHref";

interface Props {
  q: string;
  facilityId: string;
  facilities: { id: string; name: string }[] | null;
  /** The server-rendered table and pagination; passing them as children keeps both out of the client bundle. */
  children: React.ReactNode;
}

export default function PatientListFrame({ q, facilityId, facilities, children }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => router.push(href));
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    go(patientListHref({ q: next, facilityId }));
  }

  // Plain clicks on pagination links go through the transition so the table dims; modified clicks keep native behaviour.
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-pending-nav]");
    if (!link) return;
    e.preventDefault();
    go(link.getAttribute("href")!);
  }

  return (
    <>
      {/* Keyed on q so back/forward and Clear reset the input to the URL's value */}
      <form key={q} onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="q"
            className="input-field pl-9"
            placeholder="Search by name, MRD, or phone"
            aria-label="Search patients"
            defaultValue={q}
          />
        </div>
        <button className="btn-secondary" type="submit">
          <Search className="h-4 w-4" /> Search
        </button>
        {q && (
          <button type="button" className="btn-ghost" onClick={() => go(patientListHref({ facilityId }))}>
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        {facilities && (
          <select
            className="input-field max-w-[12rem]"
            aria-label="Filter by facility"
            value={facilityId}
            onChange={(e) => go(patientListHref({ q, facilityId: e.target.value }))}
          >
            <option value="">All facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </form>

      <p className="text-xs text-ink-faint">
        Click a patient&apos;s name to open their record. Click any status pill to jump straight to
        that tab — drafts stay editable, so you can pick up right where you left off.
      </p>

      <div
        onClick={handleClick}
        aria-busy={isPending}
        className={`flex flex-col gap-6 transition-opacity ${isPending ? "opacity-60" : ""}`}
      >
        {children}
      </div>
    </>
  );
}
