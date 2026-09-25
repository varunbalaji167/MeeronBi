import "next-auth";
import "next-auth/jwt";

type AppRole = "SUPER_ADMIN" | "ADMIN" | "PATIENT" | "RESEARCHER";
type ResearcherStatus = "PENDING" | "APPROVED" | "REJECTED";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: AppRole;
      patientId: string | null;
      // The tenant boundary — see prisma/schema.prisma's Facility model and
      // server/auth/guards.ts, which is where this actually gets enforced
      // (never trust this for access control anywhere else; it's a cache of
      // what's already been verified server-side against the database).
      // Present for every role, including SUPER_ADMIN/RESEARCHER (anchored
      // to a seeded "HQ" facility) — see guards.ts for why those two roles'
      // guards don't actually use this value for scoping the way
      // ADMIN/PATIENT's do.
      facilityId: string;
      // Only meaningful when role === "RESEARCHER" — display/UX convenience
      // ONLY (e.g. showing "your request is pending" on their account
      // page). The actual access-control decision in
      // requireResearcherSession() always re-checks this fresh from the
      // database rather than trusting this cached cookie value, since
      // revoking a researcher's access should take effect immediately, not
      // whenever their 30-day session happens to expire.
      researcherStatus: ResearcherStatus | null;
    };
  }
  interface User {
    id: string;
    role: AppRole;
    patientId: string | null;
    facilityId: string;
    researcherStatus: ResearcherStatus | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppRole;
    patientId: string | null;
    facilityId: string;
    researcherStatus: ResearcherStatus | null;
  }
}
