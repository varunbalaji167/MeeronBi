import Link from "next/link";
import { allTabs } from "@/domain/tabs";
import { Clock, CheckCircle2, ArrowRight } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

interface PatientRow {
  id: string;
  fullName: string;
  mrn: string | null;
  contactNo: string | null;
  updatedAt: Date;
  facility?: { name: string; slug: string } | null;
}

interface Props {
  patients: PatientRow[];
  isSuperAdmin: boolean;
  q: string;
  facilityId: string;
}

const statusOf = (p: PatientRow, key: string) =>
  (p as unknown as Record<string, { status: string } | null | undefined>)[key]?.status;

const formatUpdated = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

function EmptyPatients({ isSuperAdmin, q, facilityId }: Pick<Props, "isSuperAdmin" | "q" | "facilityId">) {
  const filtered = !!q;
  const title = filtered
    ? `No patients match "${q}".`
    : isSuperAdmin && facilityId
      ? "No patients at this facility yet."
      : isSuperAdmin
        ? "No patients across any facility yet."
        : "No patients yet.";

  return (
    <div className="rounded-lg border border-line bg-white shadow-panel">
      <EmptyState
        illustration={filtered ? "results" : "patients"}
        title={title}
        description={filtered ? "Check the spelling, or try a name, MRD or phone number." : "Register the first patient to start their antenatal record."}
        action={
          filtered ? (
            <Link href="/admin" className={buttonClasses("secondary", "md")}>
              Clear search
            </Link>
          ) : (
            <Link href="/admin/patients/new" className={buttonClasses("primary", "md")}>
              New Patient
            </Link>
          )
        }
      />
    </div>
  );
}

export default function PatientTable({ patients, isSuperAdmin, q, facilityId }: Props) {
  if (patients.length === 0) return <EmptyPatients isSuperAdmin={isSuperAdmin} q={q} facilityId={facilityId} />;

  return (
    <>
      <ul className="flex flex-col gap-3 sm:hidden">
        {patients.map((p, i) => (
          <li
            key={p.id}
            className="animate-rise-in panel flex flex-col gap-3"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/patients/${p.id}/personal`}
                  className="block truncate text-base font-medium text-brand-700 hover:underline"
                >
                  {p.fullName}
                </Link>
                <p className="mt-0.5 text-xs text-ink-soft">
                  MRD {p.mrn || "—"} · {p.contactNo || "no contact"}
                </p>
                {isSuperAdmin && <p className="text-xs text-ink-faint">{p.facility?.name || "—"}</p>}
              </div>
              <Link href={`/admin/patients/${p.id}/personal`} className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-600">
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTabs.map((t) => {
                const status = statusOf(p, t.key);
                const tone =
                  status === "COMPLETE"
                    ? "bg-brand-50 text-brand-700"
                    : status === "DRAFT"
                      ? "bg-gold-50 text-gold-600"
                      : "bg-paper text-ink-faint";
                return (
                  <Link
                    key={t.key}
                    href={`/admin/patients/${p.id}/${t.route}`}
                    title={`Open ${t.label}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
                  >
                    {status === "COMPLETE" ? <CheckCircle2 className="h-3 w-3" /> : status === "DRAFT" ? <Clock className="h-3 w-3" /> : null}
                    {t.label}
                    <span className="sr-only">{status === "COMPLETE" ? "complete" : status === "DRAFT" ? "draft" : "not started"}</span>
                  </Link>
                );
              })}
            </div>
            <p className="text-xs text-ink-faint">Updated {formatUpdated(p.updatedAt)}</p>
          </li>
        ))}
      </ul>

    <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-panel sm:block">
      <table className="w-full min-w-[950px] table-auto text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-left text-ink-faint">
            <th className="px-4 py-3 font-medium">Name</th>
            {isSuperAdmin && <th className="px-4 py-3 font-medium">Facility</th>}
            <th className="px-4 py-3 font-medium">MRD</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            {allTabs.map((t) => (
              <th key={t.key} className="px-4 py-3 font-medium">
                {t.label}
              </th>
            ))}
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p, i) => (
            <tr
              key={p.id}
              className={`border-b border-line last:border-0 hover:bg-brand-50/40 ${i % 2 === 1 ? "bg-paper/60" : ""}`}
            >
              <td className="px-4 py-3 font-medium">
                <Link href={`/admin/patients/${p.id}/personal`} className="text-brand-700 hover:underline">
                  {p.fullName}
                </Link>
              </td>
              {isSuperAdmin && <td className="px-4 py-3 text-ink-soft">{p.facility?.name || "—"}</td>}
              <td className="px-4 py-3 text-ink-soft">{p.mrn || "—"}</td>
              <td className="px-4 py-3 text-ink-soft">{p.contactNo || "—"}</td>
              {allTabs.map((t) => {
                const status = statusOf(p, t.key);
                return (
                  <td key={t.key} className="px-4 py-3">
                    <Link href={`/admin/patients/${p.id}/${t.route}`} title={`Open ${t.label}`}>
                      {status === "COMPLETE" ? (
                        <span className="badge-complete">
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </span>
                      ) : status === "DRAFT" ? (
                        <span className="badge-draft">
                          <Clock className="h-3 w-3" /> Draft
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint/50 hover:text-ink-faint">Start</span>
                      )}
                    </Link>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-ink-faint">
                {formatUpdated(p.updatedAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/patients/${p.id}/personal`}
                  className="inline-flex items-center gap-1 text-brand-600"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
