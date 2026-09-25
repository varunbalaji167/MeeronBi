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
  /** Only meaningful when role === "RESEARCHER" — display convenience only, never trust for access control (see server/auth/guards.ts's requireResearcherSession, which always re-checks fresh). */
  researcherStatus: ResearcherStatus | null;
  /** True while NextAuth is still resolving the session from the cookie. */
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** SUPER_ADMIN is a strict superset of ADMIN — this is true for both, matching how server/auth/guards.ts's requireAdminSession treats them. Use isSuperAdmin to distinguish SUPER_ADMIN-only UI (like the researcher-requests review page). */
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

/**
 * Single source of truth for "who is signed in and what can they see."
 *
 * This sits on top of NextAuth's <SessionProvider>, which reads the signed
 * JWT session cookie on mount. Because the role/patientId are embedded in
 * that cookie (see src/lib/auth.ts jwt/session callbacks), every page under
 * <AuthProvider> gets the current user instantly from React context —
 * no extra network round trip, and no repeated login prompts when
 * navigating between pages. The cookie (and therefore the session) persists
 * across page loads for 30 days (see authOptions.session.maxAge), so normal
 * navigation never re-triggers sign-in.
 */
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
