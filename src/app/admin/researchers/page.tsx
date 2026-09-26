"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { Check, X, ShieldCheck } from "lucide-react";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface ResearcherRequest {
  user: { id: string; name: string | null; email: string; createdAt: string };
  status: Status;
  institution: string;
  purpose: string;
  requestedAt: string;
  reviewedBy: { name: string | null; email: string } | null;
  reviewNote: string | null;
}

const TABS: { key: Status; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function ResearcherRequestsPage() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Status>("PENDING");
  const [requests, setRequests] = useState<ResearcherRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    setRequests(null);
    setLoadError(null);
    fetch(`/api/admin/researchers?status=${tab}`)
      .then(async (r) => {
        if (!r.ok) throw await toApiError(r, "Failed to load requests.");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setRequests(json.requests);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyErrorMessage(err, "Failed to load requests."));
      });
    return () => {
      cancelled = true;
    };
  }, [tab, isSuperAdmin]);

  async function act(userId: string, action: "approve" | "reject") {
    setActingOn(userId);
    try {
      const res = await fetch(`/api/admin/researchers/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw await toApiError(res, `Failed to ${action} this request.`);
      showToast(action === "approve" ? "Researcher approved." : "Request rejected.", "success");
      setRequests((prev) => prev?.filter((r) => r.user.id !== userId) ?? null);
    } catch (err) {
      showToast(friendlyErrorMessage(err, `Failed to ${action} this request.`), "error");
    } finally {
      setActingOn(null);
    }
  }

  if (authLoading) return null;

  if (!isSuperAdmin) {
    return (
      <div className="panel">
        <p className="text-sm text-ink-soft">This page is only available to MeeronBi super admins.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-6 w-6 text-brand-500" />
        <h1 className="font-display text-2xl italic text-ink">Researcher Access Requests</h1>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Approving grants sign-in and access to aggregate analytics only — researchers can never view an
        individual patient&apos;s record.
      </p>

      <div className="mt-6 flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-brand-500 text-brand-700" : "border-transparent text-ink-faint hover:text-ink-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loadError && <ErrorBanner>{loadError}</ErrorBanner>}
        {!loadError && requests === null && (
          <div className="panel flex items-center justify-center py-10">
            <Spinner className="h-5 w-5" />
          </div>
        )}
        {requests?.length === 0 && (
          <div className="panel py-8 text-center text-sm text-ink-faint">No {tab.toLowerCase()} requests.</div>
        )}
        {requests?.map((req) => (
          <div key={req.user.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{req.user.name || req.user.email}</p>
                <p className="text-sm text-ink-soft">{req.user.email}</p>
                <p className="mt-1 text-xs text-ink-faint">{req.institution}</p>
              </div>
              {tab === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    className="btn-secondary !py-1.5 text-xs"
                    disabled={actingOn === req.user.id}
                    onClick={() => act(req.user.id, "reject")}
                  >
                    {actingOn === req.user.id ? <Spinner className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    Reject
                  </button>
                  <button
                    className="btn-primary !py-1.5 text-xs"
                    disabled={actingOn === req.user.id}
                    onClick={() => act(req.user.id, "approve")}
                  >
                    {actingOn === req.user.id ? <Spinner className="h-3.5 w-3.5" light /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                </div>
              )}
              {req.reviewedBy && (
                <p className="text-xs text-ink-faint">
                  Reviewed by {req.reviewedBy.name || req.reviewedBy.email}
                </p>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{req.purpose}</p>
            {req.reviewNote && <p className="mt-2 text-xs italic text-ink-faint">Note: {req.reviewNote}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
