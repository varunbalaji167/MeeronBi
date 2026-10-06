"use client";

import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import Spinner from "../ui/Spinner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { ShieldCheck, Mail, Lock, Send } from "lucide-react";

type Method = "password" | "invite";

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
  const [method, setMethod] = useState<Method>("password");
  const [savedEmail, setSavedEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          method: method === "password" ? { kind: "password", password } : { kind: "invite" },
        }),
      });
      if (!res.ok) {
        throw await toApiError(res, "Failed to set up portal access.");
      }
      const json = await res.json();
      showToast(
        method === "password"
          ? `Portal login ready for ${json.email}. Share the password securely.`
          : `A set-up link was emailed to ${json.email}.`,
        "success"
      );
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
      <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3">
        <div>
          <label className="label-text">Patient&apos;s Email</label>
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

        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="method" checked={method === "password"} onChange={() => setMethod("password")} />
            Give them a password now
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="method" checked={method === "invite"} onChange={() => setMethod("invite")} />
            Email them a set-up link
          </label>
          {method === "invite" && (
            <p className="ml-6 text-xs text-ink-faint">
              Only if this address belongs to the patient — whoever can read that inbox can open the record.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {method === "password" && (
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
          )}
          <button className="btn-primary" disabled={saving}>
            {saving ? (
              <Spinner className="h-4 w-4" light />
            ) : method === "password" ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {saving ? "Saving…" : method === "password" ? (savedEmail ? "Update Login" : "Create Login") : "Send Invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
