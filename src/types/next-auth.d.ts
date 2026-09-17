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
    };
  }
  interface User {
    id: string;
    role: "ADMIN" | "PATIENT";
    patientId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "ADMIN" | "PATIENT";
    patientId: string | null;
  }
}
