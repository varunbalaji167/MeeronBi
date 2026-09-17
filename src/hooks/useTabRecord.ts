"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";

export type TabRecordStatus = "DRAFT" | "COMPLETE";

interface UseTabRecordResult {
  loading: boolean;
  loadError: string | null;
  data: Record<string, any>;
  status: TabRecordStatus;
  /** Resolves to field-name -> message pairs the server rejected server-side (e.g. an MRD conflict), if any. */
  save: (data: Record<string, any>, status: TabRecordStatus) => Promise<Record<string, string> | undefined>;
  remove: () => Promise<void>;
}

/**
 * All the network plumbing for "one tab's record for one patient" — GET on
 * mount, PUT to save, DELETE to clear — so components (TabRecordView) stay
 * focused on what to render, not how to fetch it. Throws on save/delete
 * failure rather than showing its own UI, so the caller decides how to
 * surface the error (DynamicForm uses toasts).
 */
export function useTabRecord(patientId: string, tabRoute: string): UseTabRecordResult {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<TabRecordStatus>("DRAFT");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetch(`/api/patients/${patientId}/${tabRoute}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const err = await toApiError(r, `Couldn't load this tab (HTTP ${r.status}).`);
          setLoadError(friendlyErrorMessage(err, err.message));
          return;
        }
        const json = await r.json().catch(() => ({}));
        setData(json.data ?? {});
        setStatus(json.status ?? "DRAFT");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyErrorMessage(err, "Could not reach the server. Check your connection and try again."));
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [patientId, tabRoute]);

  async function save(nextData: Record<string, any>, nextStatus: TabRecordStatus) {
    const res = await fetch(`/api/patients/${patientId}/${tabRoute}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: nextData, status: nextStatus }),
    });
    if (!res.ok) {
      throw await toApiError(res, "Failed to save.");
    }
    const json = await res.json().catch(() => ({}));
    router.refresh();
    return json.fieldErrors as Record<string, string> | undefined;
  }

  async function remove() {
    const res = await fetch(`/api/patients/${patientId}/${tabRoute}`, { method: "DELETE" });
    if (!res.ok) {
      throw await toApiError(res, "Failed to delete.");
    }
    setData({});
    setStatus("DRAFT");
    router.refresh();
  }

  return { loading, loadError, data, status, save, remove };
}
