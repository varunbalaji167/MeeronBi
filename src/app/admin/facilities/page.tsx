"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { Building2, Plus } from "lucide-react";

interface Facility {
  id: string;
  name: string;
  slug: string;
}

const EMPTY_FORM = { name: "", slug: "", stateCode: "", adminName: "", adminEmail: "", adminPassword: "" };

export default function FacilitiesPage() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!isSuperAdmin) return;
    setLoadError(null);
    fetch("/api/facilities")
      .then(async (r) => {
        if (!r.ok) throw await toApiError(r, "Failed to load facilities.");
        return r.json();
      })
      .then((json) => setFacilities(json.facilities))
      .catch((err) => setLoadError(friendlyErrorMessage(err, "Failed to load facilities.")));
  }

  useEffect(load, [isSuperAdmin]);

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
          adminPassword: form.adminPassword,
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

  if (authLoading) return null;

  if (!isSuperAdmin) {
    return (
      <div className="panel">
        <p className="text-sm text-ink-soft">This page is only available to MeeronBi super admins.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Building2 className="h-6 w-6 text-brand-500" />
        <h1 className="font-display text-2xl italic text-ink">Facilities</h1>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Create a new facility and hand it its first admin login in one step — there&apos;s no approval
        step here, unlike researcher requests, since only a super admin can reach this page.
      </p>

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
          <div>
            <label className="label-text">Admin Password *</label>
            <input
              required
              type="password"
              className="input-field"
              value={form.adminPassword}
              onChange={(e) => updateField("adminPassword", e.target.value)}
              placeholder="At least 6 characters"
            />
            {fieldErrors.adminPassword && <p className="mt-1 text-xs text-rose-600">{fieldErrors.adminPassword}</p>}
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
                <span className="font-medium text-ink">{f.name}</span>
                <span className="text-xs text-ink-faint">{f.slug}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
