"use client";

import { useEffect, useId, useMemo, useState } from "react";
import DynamicForm from "../forms/DynamicForm";
import FieldCustomizer from "../forms/FieldCustomizer";
import FormSkeleton from "../ui/FormSkeleton";
import ErrorBanner from "../ui/ErrorBanner";
import { getTabByKey, computeRobsonGroup } from "@/domain/tabs";
import { isCustomizable, resolveVisibleFieldNames, getFieldsWithData } from "@/domain/fieldVisibility";
import { useTabRecord } from "@/hooks/useTabRecord";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useTabForm } from "@/context/TabFormContext";
import { useToast } from "@/context/ToastContext";
import { friendlyErrorMessage } from "@/lib/apiClient";
import { SlidersHorizontal } from "lucide-react";

interface Props {
  /**
   * Pass the tab's string key (e.g. "robson"), not the config object
   * itself. The pages that render this are server components, and some tab
   * configs carry functions (Robson's classifier) that can't cross the
   * server→client prop boundary — a plain string key can.
   */
  tabKey: string;
  patientId: string;
  readOnly?: boolean;
}

export default function TabRecordView({ tabKey, patientId, readOnly }: Props) {
  const tab = getTabByKey(tabKey);
  const record = useTabRecord(patientId, tab?.route ?? tabKey);
  const canCustomize = !readOnly && !!tab && isCustomizable(tab);
  const fieldVisibility = useFieldVisibility(tabKey, canCustomize);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const { showToast } = useToast();
  const { activeForm } = useTabForm();
  const customizerTitleId = useId();

  // Close the field-customizer overlay on Escape, same as ConfirmDialog.
  useEffect(() => {
    if (!showCustomizer) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowCustomizer(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCustomizer]);

  // Field-visibility preferences are a nice-to-have, not core to viewing/
  // editing the record — if fetching them fails, fall back to core-field
  // defaults (already what `resolveVisibleFieldNames` does with a null
  // selection) and just let the admin know, rather than blocking the page.
  useEffect(() => {
    if (fieldVisibility.loadError) {
      showToast(fieldVisibility.loadError, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldVisibility.loadError]);

  // These are two genuinely different questions:
  //  - "what should the STAFF editing form show?" → strictly the hospital's
  //    configuration (resolveVisibleFieldNames). Unchecking a field in the
  //    customizer hides it here, even if it already has data.
  //  - "what should the PATIENT'S read-only view show?" → whatever fields
  //    actually have data, regardless of the hospital's current
  //    configuration (getFieldsWithData) — their own record shouldn't
  //    appear to lose history just because staff later reconfigured what's
  //    collected going forward.
  const visibleFieldNames = useMemo(() => {
    if (!tab) return null;
    if (readOnly) return getFieldsWithData(tab, record.data);
    if (!canCustomize) return null; // Robson/Treatments: no filtering, show everything
    return resolveVisibleFieldNames(tab, fieldVisibility.storedSelection);
  }, [tab, readOnly, canCustomize, record.data, fieldVisibility.storedSelection]);

  const fieldsWithData = useMemo(() => (tab ? getFieldsWithData(tab, record.data) : new Set<string>()), [tab, record.data]);

  if (!tab) return <ErrorBanner>Unknown tab &ldquo;{tabKey}&rdquo;.</ErrorBanner>;

  // A skeleton shaped like the real form, not a spinner: app/**/loading.tsx
  // already shows a matching skeleton while the server layout resolves, and
  // handing off to a spinner here for this client-side fetch produced a
  // skeleton → spinner → data flicker. Using the same skeleton shape for
  // both moments reads as one continuous load instead.
  if (record.loading || (canCustomize && fieldVisibility.loading)) {
    return <FormSkeleton />;
  }
  if (record.loadError) return <ErrorBanner>{record.loadError}</ErrorBanner>;

  // Reads the live, currently-being-edited Robson answers (via the same
  // TabFormContext mechanism the patient header's live name uses) instead
  // of the stale snapshot from the initial page load — so the classification
  // result updates the instant all 6 questions are answered, not only after
  // a save completes and the page is revisited.
  const robsonResult =
    tab.key === "robson"
      ? computeRobsonGroup(activeForm?.tabKey === "robson" ? activeForm.data : record.data)
      : null;

  return (
    <>
      <DynamicForm
        tab={tab}
        initialData={record.data}
        initialStatus={record.status}
        readOnly={readOnly}
        visibleFieldNames={visibleFieldNames}
        onSave={record.save}
        onDelete={readOnly ? undefined : record.remove}
        headerActions={
          canCustomize ? (
            <button
              type="button"
              onClick={() => setShowCustomizer((v) => !v)}
              className="btn-ghost border border-line text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Customize fields
            </button>
          ) : undefined
        }
        extra={
          tab.key === "robson" ? (
            <div className="panel border-l-2 border-brand-300" aria-live="polite">
              <p className="text-sm text-ink-soft">Robson Ten-Group Classification result</p>
              <p className="mt-1 font-display text-3xl italic text-brand-700">
                {robsonResult ? `Group ${robsonResult}` : "—"}
              </p>
              {!robsonResult && (
                <p className="mt-1 text-xs text-ink-faint">Answer all 6 questions above to classify.</p>
              )}
            </div>
          ) : undefined
        }
      />

      {showCustomizer && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 pt-16"
          onClick={() => setShowCustomizer(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={customizerTitleId}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <FieldCustomizer
              tab={tab}
              titleId={customizerTitleId}
              enabledFieldNames={visibleFieldNames ?? new Set()}
              fieldsWithData={fieldsWithData}
              onSave={async (names) => {
                try {
                  await fieldVisibility.save(names);
                  setShowCustomizer(false);
                  showToast("Field selection saved for this tab.", "success");
                } catch (err) {
                  showToast(friendlyErrorMessage(err, "Failed to save field selection."), "error");
                }
              }}
              onClose={() => setShowCustomizer(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
