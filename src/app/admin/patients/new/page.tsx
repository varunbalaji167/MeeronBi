"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useToast } from "@/context/ToastContext";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { UserPlus, ArrowLeft, User } from "lucide-react";

export default function NewPatientPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      if (!res.ok) {
        throw await toApiError(res, "Failed to create patient.");
      }
      const json = await res.json();
      showToast(`${fullName} added. Continue their record on the Personal tab.`, "success");
      router.push(`/admin/patients/${json.patient.id}/personal`);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Failed to create patient."));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
        <ArrowLeft className="h-3.5 w-3.5" /> All patients
      </Link>
      <h2 className="mt-3 font-display text-2xl italic text-ink">New Patient</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Just a name to get started — MRD, contact number, and everything else is filled in
        once, on the Personal tab, right after.
      </p>
      <form onSubmit={handleSubmit} className="panel mt-6 flex flex-col gap-4">
        <div>
          <label className="label-text">Full Name *</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              required
              autoFocus
              className="input-field pl-9"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Meikam Tombi Meitei"
            />
          </div>
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button className="btn-primary mt-1" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" light /> : <UserPlus className="h-4 w-4" />}
          {saving ? "Creating…" : "Create & Continue to Personal Tab"}
        </button>
      </form>
    </div>
  );
}
