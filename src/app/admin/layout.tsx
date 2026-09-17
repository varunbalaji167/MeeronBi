import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/guards";
import AppSidebar from "@/components/layout/AppSidebar";

// Explicit, not just inferred: this whole section reads the session via
// cookies on every request (auth-gated, per-user data), so it must never be
// statically cached. Next.js would infer this automatically from the
// `getSession()` call below, but stating it directly documents the
// decision instead of relying on a reader knowing that inference rule.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login?role=admin");

  return (
    // `lg:h-screen lg:overflow-hidden` pins the viewport height at desktop
    // width so ONLY <main> scrolls internally — without it, the sidebar
    // (a normal flex sibling, not fixed at this breakpoint) scrolled away
    // with the rest of the page on any tab with enough content to scroll,
    // leaving nav links and branding out of view and just the footer
    // floating mid-screen. Mobile is unaffected (natural page scroll, with
    // the sidebar as its own fixed-position drawer regardless).
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:flex-row lg:overflow-hidden">
      <AppSidebar role="admin" />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
