import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { patientListHref, type PatientListQuery } from "./patientListHref";

interface Props extends Omit<PatientListQuery, "page"> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const edge = "btn-ghost border border-line";
const edgeDisabled = `${edge} cursor-not-allowed opacity-40`;

// data-pending-nav lets PatientListFrame dim the table while these real links navigate.
export default function Pagination({ page, pageSize, total, totalPages, q, facilityId }: Props) {
  if (total === 0) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hrefFor = (n: number) => patientListHref({ page: n, q, facilityId });

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | "ellipsis")[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
      acc.push(n);
      return acc;
    }, []);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-ink-faint">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} data-pending-nav className={edge}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
        ) : (
          <span aria-disabled="true" className={edgeDisabled}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </span>
        )}
        {pages.map((n, idx) =>
          n === "ellipsis" ? (
            <span key={`e${idx}`} className="px-2 text-ink-faint">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={hrefFor(n)}
              data-pending-nav
              aria-current={n === page ? "page" : undefined}
              className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm font-medium transition-colors ${
                n === page ? "bg-brand-500 text-white" : "text-ink-soft hover:bg-paper"
              }`}
            >
              {n}
            </Link>
          )
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} data-pending-nav className={edge}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span aria-disabled="true" className={edgeDisabled}>
            Next <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
