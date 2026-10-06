import Link from "next/link";
import AuthShell from "@/components/layout/AuthShell";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <AuthShell>
      <div className="panel">
        <EmptyState
          illustration="notFound"
          title="Page not found"
          description="The link may be out of date, or the page may have moved."
          action={
            <Link href="/" className={buttonClasses("primary", "md")}>
              Back to home
            </Link>
          }
        />
      </div>
    </AuthShell>
  );
}
