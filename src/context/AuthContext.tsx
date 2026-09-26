"use client";

import { createContext, useContext, useMemo } from "react";
import { useSession } from "next-auth/react";

export type Role = "SUPER_ADMIN" | "ADMIN" | "PATIENT" | "RESEARCHER";
export type ResearcherStatus = "PENDING" | "APPROVED" | "REJECTED";

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: Role | null;
  patientId: string | null;
  /** Only meaningful when role === "RESEARCHER"; display only, not for access control. */
  researcherStatus: ResearcherStatus | null;
  /** True while NextAuth is still resolving the session. */
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True for both ADMIN and SUPER_ADMIN; use to gate SUPER_ADMIN-only UI. */
  isSuperAdmin: boolean;
  isPatient: boolean;
  isResearcher: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  patientId: null,
  researcherStatus: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  isSuperAdmin: false,
  isPatient: false,
  isResearcher: false,
});

/** Exposes the current session (role, patientId, etc.) via context, backed by NextAuth's JWT cookie. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const value = useMemo<AuthContextValue>(() => {
    const sessionUser = session?.user;
    return {
      user: sessionUser ? { id: sessionUser.id, email: sessionUser.email, name: sessionUser.name } : null,
      role: sessionUser?.role ?? null,
      patientId: sessionUser?.patientId ?? null,
      researcherStatus: sessionUser?.researcherStatus ?? null,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated",
      isAdmin: sessionUser?.role === "ADMIN" || sessionUser?.role === "SUPER_ADMIN",
      isSuperAdmin: sessionUser?.role === "SUPER_ADMIN",
      isPatient: sessionUser?.role === "PATIENT",
      isResearcher: sessionUser?.role === "RESEARCHER",
    };
  }, [session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
