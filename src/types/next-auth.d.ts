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
      // Tenant boundary; enforced server-side in server/auth/guards.ts, never trust this alone.
      facilityId: string;
      // Display-only for RESEARCHER; access control re-checks this fresh from the database.
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
