"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // refetchOnWindowFocus/refetchInterval are disabled: the session is a
    // signed JWT cookie valid for 30 days (see authOptions), so there is no
    // need to keep re-validating it against the server as the person
    // switches tabs or navigates around the app — that polling is what
    // caused the app to feel like it was silently re-checking/re-prompting
    // for auth.
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
