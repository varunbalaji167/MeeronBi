"use client";

import { useEffect, useState } from "react";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";

interface UseFieldVisibilityResult {
  /** null = never configured (fall back to core defaults); otherwise the hospital's saved choice. */
  storedSelection: string[] | null;
  loading: boolean;
  /** Set when the GET failed — surfaced so the caller can show it instead of silently using defaults. */
  loadError: string | null;
  save: (names: string[]) => Promise<void>;
}

/**
 * Fetches/saves which fields are enabled for a tab (admin-only). Combine
 * the result with a record's own `data` via
 * domain/fieldVisibility.resolveVisibleFieldNames() to get the actual set
 * of fields to render — this hook only knows about the hospital-wide
 * preference, not any specific patient's record.
 */
export function useFieldVisibility(tabKey: string, enabled: boolean): UseFieldVisibilityResult {
  const [storedSelection, setStoredSelection] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetch(`/api/field-config/${tabKey}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const err = await toApiError(r, `Couldn't load field settings (HTTP ${r.status}).`);
          setLoadError(friendlyErrorMessage(err, err.message));
          return;
        }
        const json = await r.json().catch(() => ({}));
        setStoredSelection(json.enabledFieldNames ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyErrorMessage(err, "Could not reach the server for field settings."));
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [tabKey, enabled]);

  async function save(names: string[]) {
    const res = await fetch(`/api/field-config/${tabKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledFieldNames: names }),
    });
    if (!res.ok) {
      throw await toApiError(res, `Failed to save field selection (HTTP ${res.status}).`);
    }
    setStoredSelection(names);
  }

  return { storedSelection, loading, loadError, save };
}
