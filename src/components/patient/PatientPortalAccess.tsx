"use client";

import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import Spinner from "../ui/Spinner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { ShieldCheck, Mail, Lock } from "lucide-react";

export default function PatientPortalAccess({
  patientId,
  currentEmail,
}: {
  patientId: string;
  currentEmail: string | null;
}) {
  const { showToast } = useToast();
  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
  const [savedEmail, setSavedEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        throw await toApiError(res, "Failed to set up portal access.");
      }
      const json = await res.json();
      showToast(`Portal login ready for ${json.email}. Share the password securely.`, "success");
      setSavedEmail(json.email);
      setPassword("");
    } catch (err) {
      showToast(friendlyErrorMessage(err, "Failed to set up portal access."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel border-l-2 border-brand-200">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <ShieldCheck className="h-4 w-4 text-brand-600" /> Patient Portal Access
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        {savedEmail
          ? `This patient's only login is ${savedEmail}. Saving a new email below replaces it — there is never more than one login per patient.`
          : "Give this patient a login so they can view (but not edit) their own record."}
      </p>
      <form onSubmit={handleCreate} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label-text">Patient's Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="email"
              required
              className="input-field pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label-text">{savedEmail ? "New Password" : "Temporary Password"}</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              required
              minLength={6}
              className="input-field pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-primary" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" light /> : <ShieldCheck className="h-4 w-4" />}
          {saving ? "Saving…" : savedEmail ? "Update Login" : "Create Login"}
        </button>
      </form>
    </div>
  );
}
