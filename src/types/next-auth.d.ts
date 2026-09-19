import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "ADMIN" | "PATIENT";
      patientId: string | null;
      // The tenant boundary — see prisma/schema.prisma's Facility model and
      // server/auth/guards.ts, which is where this actually gets enforced
      // (never trust this for access control anywhere else; it's a cache of
      // what's already been verified server-side against the database).
      facilityId: string;
    };
  }
  interface User {
    id: string;
    role: "ADMIN" | "PATIENT";
    patientId: string | null;
    facilityId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "ADMIN" | "PATIENT";
    patientId: string | null;
    facilityId: string;
  }
}
