import Link from "next/link";
import { FileQuestion } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

// User-facing half of the tenant boundary: identical copy for "doesn't exist" and "other facility" — never split them.
export default function PatientNotAvailable() {
  return (
    <div className="panel">
      <EmptyState
        icon={<FileQuestion className="h-8 w-8" />}
        title="That patient record isn't available."
        action={
          <Link href="/admin" className={buttonClasses("secondary", "md")}>
            Back to patient list
          </Link>
        }
      />
    </div>
  );
}
