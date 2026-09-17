"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PatientPortalAccess from "./PatientPortalAccess";
import ConfirmDialog from "../ui/ConfirmDialog";
import Spinner from "../ui/Spinner";
import { useTabForm } from "@/context/TabFormContext";
import { useToast } from "@/context/ToastContext";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { KeyRound, Trash2 } from "lucide-react";

export default function PatientHeader({
  patientId,
  fullName,
  mrn,
  contactNo,
  currentEmail,
}: {
  patientId: string;
  fullName: string;
  mrn: string | null;
  contactNo: string | null;
  currentEmail: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showAccess, setShowAccess] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { activeForm } = useTabForm();

  // While the Personal tab is open and being edited, reflect the name as
  // it's typed — not just after a save + page refresh. Falls back to the
  // last-saved (server-provided) name on every other tab, or if the field
  // is currently empty.
  const liveName =
    activeForm?.tabKey === "personal" && typeof activeForm.data?.fullName === "string" && activeForm.data.fullName.trim()
      ? activeForm.data.fullName
      : fullName;

  // Same live-reflection mechanism as the name above: while the Personal
  // tab is open and being edited, show the MRD as it's typed rather than
  // only after a save + page refresh. Falls back to the last-saved MRD on
  // every other tab, or while the field is empty.
  const liveMrn =
    activeForm?.tabKey === "personal" && typeof activeForm.data?.mrn === "string" && activeForm.data.mrn.trim()
      ? activeForm.data.mrn
      : mrn;

  async function handleDeletePatient() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`, { method: "DELETE" });
      if (!res.ok) {
        throw await toApiError(res, "Failed to delete patient.");
      }
      showToast(`${liveName}'s entire record has been deleted.`, "success");
      router.push("/admin");
    } catch (err) {
      showToast(friendlyErrorMessage(err, "Failed to delete patient."), "error");
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-faint">Patient record</p>
          <h2 className="font-display text-2xl italic text-ink">{liveName}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {liveMrn ? `MRD ${liveMrn}` : "No MRD on file"}
            {contactNo ? ` · ${contactNo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAccess((v) => !v)}
            className="btn-ghost border border-line text-xs"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {showAccess ? "Hide" : "Manage"} patient portal login
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete entire patient
          </button>
        </div>
      </div>
      {showAccess && (
        <div className="mt-3">
          <PatientPortalAccess patientId={patientId} currentEmail={currentEmail} />
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this patient's entire record?"
        message={`This permanently removes ${liveName}'s record — all 7 tabs, every draft and completed entry, and their portal login if one exists. This cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete Everything"}
        danger
        loading={deleting}
        onConfirm={handleDeletePatient}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
