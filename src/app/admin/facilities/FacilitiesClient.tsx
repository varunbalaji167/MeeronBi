"use client";

import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { ApiError, toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { Building2, Plus, Send } from "lucide-react";

export interface Facility {
  id: string;
  name: string;
  slug: string;
  admin: { id: string; email: string; inviteAccepted: boolean } | null;
}

const EMPTY_FORM = { name: "", slug: "", stateCode: "", adminName: "", adminEmail: "" };

export default function FacilitiesClient({ initialFacilities }: { initialFacilities: Facility[] }) {
  const { showToast } = useToast();
  const [facilities, setFacilities] = useState<Facility[] | null>(initialFacilities);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resendingFor, setResendingFor] = useState<string | null>(null);

  function load() {
    setLoadError(null);
    fetch("/api/facilities")
      .then(async (r) => {
        if (!r.ok) throw await toApiError(r, "Failed to load facilities.");
        return r.json();
      })
      .then((json) => setFacilities(json.facilities))
      .catch((err) => setLoadError(friendlyErrorMessage(err, "Failed to load facilities.")));
  }

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          stateCode: form.stateCode || undefined,
          adminName: form.adminName || undefined,
          adminEmail: form.adminEmail,
        }),
      });
      if (!res.ok) throw await toApiError(res, "Failed to create facility.");
      const json = await res.json();
      showToast(`"${json.facility.name}" created — admin login sent to ${json.adminEmail}.`, "success");
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setFieldErrors(err.fieldErrors);
      setFormError(friendlyErrorMessage(err, "Failed to create facility."));
    } finally {
      setSaving(false);
    }
  }

  async function resendInvite(adminId: string) {
    setResendingFor(adminId);
    try {
      const res = await fetch(`/api/facilities/${adminId}/resend-invite`, { method: "POST" });
      if (!res.ok) throw await toApiError(res, "Failed to resend the invite.");
      const json = await res.json();
      showToast(`A fresh invite link was sent to ${json.email}.`, "success");
    } catch (err) {
      showToast(friendlyErrorMessage(err, "Failed to resend the invite."), "error");
    } finally {
      setResendingFor(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Facilities"
        icon={<Building2 className="h-6 w-6 text-brand-500" />}
        description="Create a new facility and hand it its first admin login in one step — there's no approval step here, unlike researcher requests, since only a super admin can reach this page."
      />

      <form onSubmit={handleSubmit} className="panel mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text">Facility Name *</label>
            <input
              required
              className="input-field"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., City General Hospital"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="label-text">Slug (optional)</label>
            <input
              className="input-field"
              value={form.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              placeholder="auto-generated from name if left blank"
            />
            {fieldErrors.slug && <p className="mt-1 text-xs text-rose-600">{fieldErrors.slug}</p>}
          </div>
          <div>
            <label className="label-text">State Code (optional)</label>
            <input
              className="input-field"
              value={form.stateCode}
              onChange={(e) => updateField("stateCode", e.target.value)}
              placeholder="e.g., MN"
            />
          </div>
          <div>
            <label className="label-text">Admin Name (optional)</label>
            <input
              className="input-field"
              value={form.adminName}
              onChange={(e) => updateField("adminName", e.target.value)}
              placeholder="e.g., Dr. Singh"
            />
          </div>
          <div>
            <label className="label-text">Admin Email *</label>
            <input
              required
              type="email"
              className="input-field"
              value={form.adminEmail}
              onChange={(e) => updateField("adminEmail", e.target.value)}
              placeholder="admin@facility.org"
            />
            {fieldErrors.adminEmail && <p className="mt-1 text-xs text-rose-600">{fieldErrors.adminEmail}</p>}
          </div>
        </div>
        {formError && <ErrorBanner>{formError}</ErrorBanner>}
        <button className="btn-primary self-start" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" light /> : <Plus className="h-4 w-4" />}
          {saving ? "Creating…" : "Create Facility & Admin"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {loadError && <ErrorBanner>{loadError}</ErrorBanner>}
        {!loadError && facilities === null && (
          <div className="panel flex items-center justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        )}
        {facilities?.length === 0 && (
          <div className="panel py-6 text-center text-sm text-ink-faint">No facilities yet.</div>
        )}
        {facilities && facilities.length > 0 && (
          <div className="panel divide-y divide-line !p-0">
            {facilities.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-ink">{f.name}</span>
                  <span className="ml-2 text-xs text-ink-faint">{f.slug}</span>
                </div>
                {f.admin && !f.admin.inviteAccepted && (
                  <button
                    className="btn-secondary !py-1 text-xs"
                    disabled={resendingFor === f.admin.id}
                    onClick={() => resendInvite(f.admin!.id)}
                    title={`${f.admin.email} hasn't set a password yet`}
                  >
                    {resendingFor === f.admin.id ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    Resend invite
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
