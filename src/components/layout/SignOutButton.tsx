"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
