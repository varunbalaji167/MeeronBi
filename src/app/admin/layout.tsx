import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/guards";
import AppSidebar from "@/components/layout/AppSidebar";

// Auth-gated, per-user data — never statically cache this route.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login?role=admin");
  }

  // Pins viewport height at desktop width so only <main> scrolls internally.
  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:flex-row lg:overflow-hidden">
      <AppSidebar role="admin" />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
