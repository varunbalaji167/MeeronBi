"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { allTabs } from "@/domain/tabs";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useAuth } from "@/context/AuthContext";
import { UserPlus, Search, X, ChevronLeft, ChevronRight, Clock, CheckCircle2, ArrowRight } from "lucide-react";

interface PatientRow {
  id: string;
  fullName: string;
  mrn: string | null;
  contactNo: string | null;
  updatedAt: string;
  facility?: { name: string; slug: string } | null;
  personal?: { status: string } | null;
  history?: { status: string } | null;
  investigation?: { status: string } | null;
  ultrasound?: { status: string } | null;
  delivery?: { status: string } | null;
  robson?: { status: string } | null;
  treatments?: { status: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Facility {
  id: string;
  name: string;
  slug: string;
}

const PAGE_SIZE = 10;

export default function AdminDashboard() {
  const router = useRouter();
  const { isSuperAdmin } = useAuth();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetPage: number, query: string, facility: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) });
      if (query) params.set("q", query);
      if (facility) params.set("facilityId", facility);
      const res = await fetch(`/api/patients?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load patients.");
        setPatients([]);
        setPagination(null);
        return;
      }
      setPatients(json.patients ?? []);
      setPagination(json.pagination ?? null);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page, appliedQ, isSuperAdmin ? facilityId : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedQ, facilityId, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/facilities")
      .then((res) => res.json())
      .then((json) => setFacilities(json.facilities ?? []))
      .catch(() => {});
  }, [isSuperAdmin]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedQ(q.trim());
  }

  function openPatient(id: string, tabRoute = "personal") {
    router.push(`/admin/patients/${id}/${tabRoute}`);
  }

  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-sm text-ink-faint">{total} patients</p>
          <h2 className="font-display text-2xl italic text-ink">Patients</h2>
        </div>
        <Link href="/admin/patients/new" className="btn-primary">
          <UserPlus className="h-4 w-4" /> New Patient
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="input-field pl-9"
            placeholder="Search by name, MRD, or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn-secondary" type="submit">
          <Search className="h-4 w-4" /> Search
        </button>
        {appliedQ && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setQ("");
              setAppliedQ("");
              setPage(1);
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        {isSuperAdmin && (
          <select
            className="input-field max-w-[12rem]"
            value={facilityId}
            onChange={(e) => {
              setFacilityId(e.target.value);
              setPage(1);
            }}
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

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <p className="text-xs text-ink-faint">
        Click a patient&apos;s name to open their record. Click any status pill to jump straight to
        that tab — drafts stay editable, so you can pick up right where you left off.
      </p>

      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-panel">
        <table className="w-full min-w-[950px] table-auto text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-ink-faint">
              <th className="px-4 py-3 font-medium">Name</th>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">Facility</th>}
              <th className="px-4 py-3 font-medium">MRD</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              {allTabs.map((t) => (
                <th key={t.key} className="px-4 py-3 font-medium">
                  {t.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={allTabs.length + 5 + (isSuperAdmin ? 1 : 0)} className="px-4 py-10 text-center text-ink-faint">
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-4 w-4" /> Loading…
                  </span>
                </td>
              </tr>
            )}
            {!loading && !error && patients.length === 0 && (
              <tr>
                <td colSpan={allTabs.length + 5 + (isSuperAdmin ? 1 : 0)} className="px-4 py-8 text-center text-ink-faint">
                  {appliedQ
                    ? `No patients match "${appliedQ}".`
                    : isSuperAdmin && facilityId
                      ? "No patients at this facility yet."
                      : isSuperAdmin
                        ? "No patients across any facility yet."
                        : "No patients yet."}
                </td>
              </tr>
            )}
            {!loading &&
              patients.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => openPatient(p.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-brand-50/40 ${
                    i % 2 === 1 ? "bg-paper/60" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/patients/${p.id}/personal`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-700 hover:underline"
                    >
                      {p.fullName}
                    </Link>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-ink-soft">{p.facility?.name || "—"}</td>
                  )}
                  <td className="px-4 py-3 text-ink-soft">{p.mrn || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.contactNo || "—"}</td>
                  {allTabs.map((t) => {
                    const status = (p as any)[t.key]?.status;
                    return (
                      <td key={t.key} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPatient(p.id, t.route);
                          }}
                          title={`Open ${t.label}`}
                        >
                          {status === "COMPLETE" ? (
                            <span className="badge-complete"><CheckCircle2 className="h-3 w-3" /> Complete</span>
                          ) : status === "DRAFT" ? (
                            <span className="badge-draft"><Clock className="h-3 w-3" /> Draft</span>
                          ) : (
                            <span className="text-xs text-ink-faint/50 hover:text-ink-faint">
                              Start
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-ink-faint">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-600"><span className="inline-flex items-center gap-1">Open <ArrowRight className="h-3.5 w-3.5" /></span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-ghost border border-line disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(n);
                return acc;
              }, [])
              .map((n, idx) =>
                n === "ellipsis" ? (
                  <span key={`e${idx}`} className="px-2 text-ink-faint">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-8 min-w-[2rem] rounded-md px-2 text-sm font-medium transition-colors ${
                      n === page ? "bg-brand-500 text-white" : "text-ink-soft hover:bg-paper"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
            <button
              type="button"
              className="btn-ghost border border-line disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
