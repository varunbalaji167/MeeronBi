import Link from "next/link";
import { FileQuestion } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="panel w-full max-w-md">
        <EmptyState
          icon={<FileQuestion className="h-8 w-8" />}
          title="Page not found"
          description="The link may be out of date, or the page may have moved."
          action={
            <Link href="/" className={buttonClasses("primary", "md")}>
              Back to home
            </Link>
          }
        />
      </div>
    </main>
  );
}
