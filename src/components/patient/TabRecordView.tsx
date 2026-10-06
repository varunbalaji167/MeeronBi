"use client";

import { useEffect, useId, useMemo, useState } from "react";
import DynamicForm from "../forms/DynamicForm";
import FieldCustomizer from "../forms/FieldCustomizer";
import FormSkeleton from "../ui/FormSkeleton";
import ErrorBanner from "../ui/ErrorBanner";
import { getTabByKey, computeRobsonGroup, classifyDeliveryTiming } from "@/domain/tabs";
import { isCustomizable, resolveVisibleFieldNames, getFieldsWithData } from "@/domain/fieldVisibility";
import { computeGestationalAge } from "@/domain/gestationalAge";
import { useTabRecord, type InitialTabRecord } from "@/hooks/useTabRecord";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useTabForm } from "@/context/TabFormContext";
import { useToast } from "@/context/ToastContext";
import { friendlyErrorMessage } from "@/lib/apiClient";
import { SlidersHorizontal } from "lucide-react";

interface Props {
  /** Tab's string key (e.g. "robson"), not the config object — configs can carry functions that can't cross the server-client boundary. */
  tabKey: string;
  patientId: string;
  readOnly?: boolean;
  /** Server-read record; when given, the tab renders without a client fetch. */
  initialRecord?: InitialTabRecord;
  /** Server-read field selection (null = never configured); skips the client fetch like initialRecord does. */
  initialFieldSelection?: string[] | null;
  /** Server-read Personal LMP for Ultrasound's gestational age (null = none recorded); skips the client fetch. */
  initialPersonalLmp?: string | null;
}

export default function TabRecordView({ tabKey, patientId, readOnly, initialRecord, initialFieldSelection, initialPersonalLmp }: Props) {
  const tab = getTabByKey(tabKey);
  const record = useTabRecord(patientId, tab?.route ?? tabKey, initialRecord);
  const canCustomize = !readOnly && !!tab && isCustomizable(tab);
  const fieldVisibility = useFieldVisibility(tabKey, canCustomize, initialFieldSelection);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const { showToast } = useToast();
  const { activeForm } = useTabForm();
  const customizerTitleId = useId();

  // Ultrasound only: gestational age from Personal's LMP, server-seeded where possible; a failed fetch is non-blocking.
  const [personalLmp, setPersonalLmp] = useState<string | null>(initialPersonalLmp ?? null);
  useEffect(() => {
    if (tabKey !== "ultrasound" || initialPersonalLmp !== undefined) return;
    let cancelled = false;
    fetch(`/api/patients/${patientId}/personal`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setPersonalLmp(json?.data?.lmp ?? null);
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the seed is only read on mount; tab changes remount this view
  }, [tabKey, patientId]);

  // Close the field-customizer overlay on Escape, same as ConfirmDialog.
  useEffect(() => {
    if (!showCustomizer) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowCustomizer(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCustomizer]);

  // If fetching field-visibility preferences fails, fall back to defaults and notify.
  useEffect(() => {
    if (fieldVisibility.loadError) {
      showToast(fieldVisibility.loadError, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldVisibility.loadError]);

  // Staff editing view uses the hospital's field configuration; patient read-only view shows whatever has data.
  const visibleFieldNames = useMemo(() => {
    if (!tab) return null;
    if (readOnly) return getFieldsWithData(tab, record.data);
    if (!canCustomize) return null; // Robson/Treatments: no filtering, show everything
    return resolveVisibleFieldNames(tab, fieldVisibility.storedSelection);
  }, [tab, readOnly, canCustomize, record.data, fieldVisibility.storedSelection]);

  const fieldsWithData = useMemo(() => (tab ? getFieldsWithData(tab, record.data) : new Set<string>()), [tab, record.data]);

  if (!tab) return <ErrorBanner>Unknown tab &ldquo;{tabKey}&rdquo;.</ErrorBanner>;

  // Matches the server-render skeleton shape to avoid a skeleton-to-spinner flicker.
  if (record.loading || (canCustomize && fieldVisibility.loading)) {
    return <FormSkeleton />;
  }
  if (record.loadError) return <ErrorBanner>{record.loadError}</ErrorBanner>;

  // Reads the live, currently-edited Robson answers so the result updates before saving.
  const robsonResult =
    tab.key === "robson"
      ? computeRobsonGroup(activeForm?.tabKey === "robson" ? activeForm.data : record.data)
      : null;

  // Same live-read pattern as Robson, for Delivery's term/premature/late classification.
  const deliveryTiming =
    tab.key === "delivery"
      ? classifyDeliveryTiming(
          (activeForm?.tabKey === "delivery" ? activeForm.data : record.data)?.pogOnDeliveryWeeks
        )
      : null;

  const ga = tab.key === "ultrasound" ? computeGestationalAge(personalLmp) : null;

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
        ga={ga}
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
          ) : tab.key === "delivery" ? (
            <div
              className={`panel border-l-2 ${deliveryTiming?.tone === "warn" ? "border-gold-200" : "border-brand-300"}`}
              aria-live="polite"
            >
              <p className="text-sm text-ink-soft">Delivery timing</p>
              <p className={`mt-1 font-display text-xl italic ${deliveryTiming?.tone === "warn" ? "text-gold-600" : "text-brand-700"}`}>
                {deliveryTiming ? deliveryTiming.label : "—"}
              </p>
              {!deliveryTiming && (
                <p className="mt-1 text-xs text-ink-faint">Enter &ldquo;POG on Delivery (Weeks)&rdquo; above to classify.</p>
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
