"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
 * Fetches/saves which fields are enabled for a tab (hospital-wide, admin-only). A server-read
 * `initialSelection` (null = never configured) skips the mount fetch; undefined means "not provided".
 */
export function useFieldVisibility(tabKey: string, enabled: boolean, initialSelection?: string[] | null): UseFieldVisibilityResult {
  const router = useRouter();
  const seeded = initialSelection !== undefined;
  const [storedSelection, setStoredSelection] = useState<string[] | null>(initialSelection ?? null);
  const [loading, setLoading] = useState(enabled && !seeded);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Keyed (not a boolean) so a StrictMode double-run still skips, while a later tab change fetches.
  const seededKey = useRef(seeded ? tabKey : null);

  useEffect(() => {
    if (seededKey.current === tabKey) return;
    seededKey.current = null;
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
    router.refresh(); // drops the cached server payload so a later remount doesn't re-seed the old selection
  }

  return { storedSelection, loading, loadError, save };
}
