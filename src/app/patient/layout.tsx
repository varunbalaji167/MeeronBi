import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/guards";
import AppSidebar from "@/components/layout/AppSidebar";

export const metadata = { title: "My record" };

export const dynamic = "force-dynamic";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "PATIENT") redirect("/login?role=patient");

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:flex-row lg:overflow-hidden">
      <AppSidebar role="patient" />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
