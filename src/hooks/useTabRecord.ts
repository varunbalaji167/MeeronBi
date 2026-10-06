"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";

export type TabRecordStatus = "DRAFT" | "COMPLETE";

export interface InitialTabRecord {
  data: Record<string, any>;
  status: TabRecordStatus;
}

interface UseTabRecordResult {
  loading: boolean;
  loadError: string | null;
  data: Record<string, any>;
  status: TabRecordStatus;
  /** Resolves to field-name -> message pairs the server rejected server-side (e.g. an MRD conflict), if any. */
  save: (data: Record<string, any>, status: TabRecordStatus) => Promise<Record<string, string> | undefined>;
  remove: () => Promise<void>;
}

/** GET/PUT/DELETE plumbing for one tab's record; throws on failure so the caller handles the error. A server-read `initialRecord` skips the mount fetch. */
export function useTabRecord(patientId: string, tabRoute: string, initialRecord?: InitialTabRecord): UseTabRecordResult {
  const router = useRouter();
  const [loading, setLoading] = useState(!initialRecord);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any>>(initialRecord?.data ?? {});
  const [status, setStatus] = useState<TabRecordStatus>(initialRecord?.status ?? "DRAFT");
  // Keyed (not a boolean) so a StrictMode double-run of the effect still skips, while a later patient/tab change fetches.
  const seededKey = useRef(initialRecord ? `${patientId}/${tabRoute}` : null);

  useEffect(() => {
    if (seededKey.current === `${patientId}/${tabRoute}`) return;
    seededKey.current = null;
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
