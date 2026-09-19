"use client";

import { useEffect, useMemo, useState } from "react";
import { TabConfig, isGridSection, isRepeatingSection } from "@/domain/tabs";
import { getIncompleteReasons, getFieldLevelErrors } from "@/domain/validation";
import { GestationalAge } from "@/domain/gestationalAge";
import PlainSection from "./sections/PlainSection";
import GridSection from "./sections/GridSection";
import RepeatingSection from "./sections/RepeatingSection";
import Spinner from "../ui/Spinner";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useTabForm } from "@/context/TabFormContext";
import { useToast } from "@/context/ToastContext";
import { friendlyErrorMessage } from "@/lib/apiClient";
import { Save, CheckCircle2, Trash2, Clock } from "lucide-react";

type Status = "DRAFT" | "COMPLETE";

interface Props {
  tab: TabConfig;
  initialData: Record<string, any>;
  initialStatus: Status;
  readOnly?: boolean;
  /** null/undefined = show every plain-section field (no customization applies). */
  visibleFieldNames?: Set<string> | null;
  onSave: (data: Record<string, any>, status: Status) => Promise<Record<string, string> | void>;
  onDelete?: () => Promise<void>;
  /** e.g. a "Classify" result panel for Robson — rendered after all sections. */
  extra?: React.ReactNode;
  /** e.g. a "Customize fields" button — rendered next to the status badge. */
  headerActions?: React.ReactNode;
  /** The patient's current gestational age (from Personal's LMP) — only passed by Ultrasound, for its `recommendedWindow` badges. See GestationalWindowBadge. */
  ga?: GestationalAge | null;
}

export default function DynamicForm({
  tab,
  initialData,
  initialStatus,
  readOnly,
  visibleFieldNames,
  onSave,
  onDelete,
  extra,
  headerActions,
  ga,
}: Props) {
  const [data, setData] = useState<Record<string, any>>(initialData || {});
  const [status, setStatus] = useState<Status>(initialStatus || "DRAFT");
  const [saving, setSaving] = useState<Status | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  // Errors the SERVER rejected on the last save (e.g. an MRD already used
  // by another patient) — client-side validation can't know about this
  // ahead of time. Merged into the same field-name -> message map as
  // client-side errors so they render identically (red text under the
  // box), and cleared the moment the person edits that field again.
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const { setActiveForm } = useTabForm();
  const { showToast } = useToast();

  const errors = useMemo(
    () => ({ ...getFieldLevelErrors(tab, data), ...serverFieldErrors }),
    [tab, data, serverFieldErrors]
  );

  function touch(name: string) {
    setTouched((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  }

  useEffect(() => {
    setData(initialData || {});
    setStatus(initialStatus || "DRAFT");
    setDirty(false);
    setServerFieldErrors({});
  }, [initialData, initialStatus]);

  function setField(name: string, value: any) {
    setData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
    // A server-side error (e.g. MRD conflict) about this field is no
    // longer necessarily true once the person changes it — clear it so it
    // doesn't linger and get confused with a fresh, unrelated attempt.
    setServerFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function setRepeatingCell(sectionName: string, rowIndex: number, fieldName: string, value: any) {
    setData((prev) => {
      const rows: any[] = Array.isArray(prev[sectionName]) ? [...prev[sectionName]] : [];
      rows[rowIndex] = { ...(rows[rowIndex] || {}), [fieldName]: value };
      return { ...prev, [sectionName]: rows };
    });
    setDirty(true);
  }

  function addRepeatingRow(sectionName: string) {
    setData((prev) => {
      const rows: any[] = Array.isArray(prev[sectionName]) ? [...prev[sectionName]] : [];
      rows.push({});
      return { ...prev, [sectionName]: rows };
    });
    setDirty(true);
  }

  function removeRepeatingRow(sectionName: string, rowIndex: number) {
    setData((prev) => {
      const rows: any[] = Array.isArray(prev[sectionName]) ? [...prev[sectionName]] : [];
      rows.splice(rowIndex, 1);
      return { ...prev, [sectionName]: rows };
    });
    setDirty(true);
  }

  async function handleSave(nextStatus: Status, opts: { toastMessage?: string | null } = {}) {
    if (nextStatus === "COMPLETE") {
      const reasons = getIncompleteReasons(tab, data);
      const fieldErrorNames = Object.keys(errors);
      if (reasons.length > 0 || fieldErrorNames.length > 0) {
        setTouched(new Set(fieldErrorNames));
        showToast(
          fieldErrorNames.length > 0
            ? "Please fix the highlighted fields before marking this tab complete."
            : reasons.join(" "),
          "error"
        );
        return;
      }
    }
    setSaving(nextStatus);
    try {
      const returnedFieldErrors = await onSave(data, nextStatus);
      setStatus(nextStatus);
      setSavedAt(new Date());
      setDirty(false);

      if (returnedFieldErrors && Object.keys(returnedFieldErrors).length > 0) {
        setServerFieldErrors(returnedFieldErrors);
        setTouched((prev) => new Set([...prev, ...Object.keys(returnedFieldErrors)]));
        showToast(`${tab.label} saved, but check the highlighted field.`, "error");
        return;
      }

      const message =
        opts.toastMessage !== undefined
          ? opts.toastMessage
          : nextStatus === "COMPLETE"
          ? `${tab.label} marked complete.`
          : `${tab.label} saved as draft.`;
      if (message) showToast(message, "success");
    } catch (err) {
      showToast(
        friendlyErrorMessage(err, `Failed to save ${tab.label}. Your changes are still on this page — try again.`),
        "error"
      );
      throw new Error("save failed");
    } finally {
      setSaving(null);
    }
  }

  function requestDelete() {
    if (!onDelete) return;
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      showToast(`${tab.label} data deleted.`, "success");
      setConfirmDeleteOpen(false);
    } catch (err) {
      showToast(friendlyErrorMessage(err, `Failed to delete ${tab.label} data.`), "error");
    } finally {
      setDeleting(false);
    }
  }

  // Register this form with the shared TabFormContext so tab navigation can
  // autosave a draft before leaving the page, and other UI (e.g. the
  // patient header's live name) can reactively read what's currently being
  // typed, and warn on a hard page close.
  useEffect(() => {
    if (readOnly) return;
    setActiveForm({
      tabKey: tab.key,
      dirty,
      data,
      saveDraft: () => handleSave("DRAFT", { toastMessage: `${tab.label} auto-saved as draft.` }),
    });
    return () => setActiveForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, dirty, data]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [readOnly, dirty]);

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <h2 className="font-display text-xl italic text-ink">{tab.label}</h2>
        <div className="flex items-center gap-3">
          {status === "DRAFT" ? (
            <span className="badge-draft">
              <Clock className="h-3 w-3" /> Draft
            </span>
          ) : (
            <span className="badge-complete">
              <CheckCircle2 className="h-3 w-3" /> Complete
            </span>
          )}
          {savedAt && !dirty && (
            <span className="text-xs text-ink-faint">Saved {savedAt.toLocaleTimeString()}</span>
          )}
          {dirty && <span className="text-xs font-medium text-gold-600">Unsaved changes</span>}
          {headerActions}
        </div>
      </div>

      {tab.sections.map((section, idx) => {
        if (isGridSection(section)) {
          return (
            <GridSection key={idx} section={section} data={data} setField={setField} readOnly={readOnly} ga={ga} />
          );
        }
        if (isRepeatingSection(section)) {
          return (
            <RepeatingSection
              key={idx}
              section={section}
              rows={Array.isArray(data[section.name]) ? data[section.name] : []}
              onCellChange={(r, f, v) => setRepeatingCell(section.name, r, f, v)}
              onAddRow={() => addRepeatingRow(section.name)}
              onRemoveRow={(r) => removeRepeatingRow(section.name, r)}
              readOnly={readOnly}
            />
          );
        }
        return (
          <PlainSection
            key={idx}
            section={section}
            data={data}
            setField={setField}
            readOnly={readOnly}
            errors={errors}
            touched={touched}
            onBlurField={touch}
            visibleFieldNames={visibleFieldNames}
            ga={ga}
          />
        );
      })}

      {extra}

      {!readOnly && (
        // `left-0 right-0` (not `inset-x-0`) so `lg:left-60` can override
        // just the left edge at desktop width to start after the sidebar
        // (AppSidebar is `lg:w-60`) — with `inset-x-0`, this bar's
        // translucent bg-white/95 painted across the FULL viewport width,
        // sitting on top of the sidebar's bottom strip (where Sign Out
        // lives) even though only the *inner* content was padded clear of
        // it. Geometrically constraining the bar itself, not just its
        // content, is what actually stops the overlap.
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 flex justify-center border-t border-line bg-white/95 py-3 backdrop-blur">
          <div className="flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              className="btn-primary"
              disabled={saving !== null || deleting || !dirty}
              onClick={() => handleSave("DRAFT")}
              title={dirty ? "Save your progress without requiring every field to be filled in" : "No changes to save"}
            >
              {saving === "DRAFT" ? <Spinner className="h-4 w-4" light /> : <Save className="h-4 w-4" />}
              {saving === "DRAFT" ? "Saving…" : "Save as Draft"}
            </button>
            <button
              className="btn-secondary"
              disabled={saving !== null || deleting || (status === "COMPLETE" && !dirty)}
              onClick={() => handleSave("COMPLETE")}
              title={status === "COMPLETE" && !dirty ? "Already marked complete" : undefined}
            >
              {saving === "COMPLETE" ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving === "COMPLETE" ? "Saving…" : "Mark Complete"}
            </button>
            {onDelete && (
              <button
                className="btn-danger ml-auto"
                disabled={saving !== null || deleting}
                onClick={requestDelete}
              >
                {deleting ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${tab.label} data?`}
        message={`This removes all "${tab.label}" data for this patient. This cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
