"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import SignOutButton from "./SignOutButton";
import { Menu, X, Users, BarChart3, FileHeart, ShieldCheck, LineChart, type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

type SidebarRole = "admin" | "patient" | "researcher";

// Icon components can't be passed as props from a Server Component into a
// Client Component (they're functions under the hood, and the RSC
// serialization boundary rejects functions) — see the layouts that render
// this. So instead of accepting a `navItems` prop built by a server layout,
// this component takes a plain, serializable `role` string and resolves its
// own nav config (icons included) entirely on the client side.
const NAV_CONFIG: Record<SidebarRole, { roleLabel: string; items: NavItem[] }> = {
  admin: {
    roleLabel: "Hospital Staff",
    items: [
      { href: "/admin", label: "Patients", icon: Users, exact: true },
      { href: "/public/trends", label: "Public Trends", icon: BarChart3 },
    ],
  },
  patient: {
    roleLabel: "Patient Portal",
    items: [
      { href: "/patient", label: "My Record", icon: FileHeart, exact: true },
      { href: "/public/trends", label: "Public Trends", icon: BarChart3 },
    ],
  },
  researcher: {
    roleLabel: "Researcher",
    items: [
      { href: "/researcher", label: "Analytics", icon: LineChart, exact: true },
      { href: "/public/trends", label: "Public Trends", icon: BarChart3 },
    ],
  },
};

// SUPER_ADMIN-only — reviewing researcher access requests isn't a
// per-facility hospital-admin task, so it's added conditionally rather
// than living in NAV_CONFIG.admin.items directly (which every ADMIN,
// facility-scoped or not, would otherwise see).
const SUPER_ADMIN_ITEM: NavItem = { href: "/admin/researchers", label: "Researcher Requests", icon: ShieldCheck };

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return chars.toUpperCase();
}

export default function AppSidebar({ role }: { role: SidebarRole }) {
  const pathname = usePathname();
  const { user, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const { roleLabel: baseRoleLabel, items: baseItems } = NAV_CONFIG[role];
  const roleLabel = role === "admin" && isSuperAdmin ? "MeeronBi Team" : baseRoleLabel;
  const items = role === "admin" && isSuperAdmin ? [...baseItems, SUPER_ADMIN_ITEM] : baseItems;

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const navLinks = items.map((item) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group relative mb-1 flex items-center gap-2.5 rounded-md py-2 pl-3 pr-3 text-sm font-medium transition-all duration-150 ${
          active
            ? "bg-brand-50 text-brand-700"
            : "text-ink-soft hover:translate-x-0.5 hover:bg-paper hover:text-ink"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-0 w-0.5 rounded-full bg-brand-500 transition-opacity ${
            active ? "opacity-100" : "opacity-0"
          }`}
        />
        <Icon className={`h-4 w-4 shrink-0 transition-transform ${active ? "" : "group-hover:scale-110"}`} />
        {item.label}
      </Link>
    );
  });

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-paper"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-display text-base italic text-ink">MeeronBi</span>
        <div className="w-[34px]" />
      </div>

      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 z-30 bg-ink/30 backdrop-blur-[1px] transition-opacity duration-200 lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-600">MeeronBi</p>
            <h1 className="mt-1 font-display text-lg italic leading-tight text-ink">{roleLabel}</h1>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1 text-ink-faint transition-colors hover:bg-paper lg:hidden"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4" aria-label="Primary">
          {navLinks}
        </nav>

        <div className="border-t border-line px-4 py-4">
          {user && (
            <div className="mb-3 flex items-center gap-2.5 overflow-hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                {initialsFor(user.email)}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-ink-faint">Signed in as</p>
                <p className="truncate text-sm font-medium text-ink" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
          )}
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
