"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Session is a 30-day JWT cookie; no need to re-poll the server for it.
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
