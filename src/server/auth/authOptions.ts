import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // Keep people signed in for 30 days so normal navigation across the app
    // never has to re-authenticate — the JWT cookie itself carries role,
    // patientId and facilityId, so every server component/API route can
    // trust it directly (see server/auth/guards.ts) without a database
    // round trip per request.
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { patient: true, researcherProfile: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // A RESEARCHER account exists as soon as access is requested (see
        // server/researchers/researcherAccessService.ts) — the password
        // check above can succeed for someone genuinely still awaiting
        // review. Block sign-in here with a SPECIFIC message rather than
        // letting them through with a role the rest of the app isn't ready
        // to treat as authorized yet. Thrown here (not returned as null),
        // since NextAuth's credentials provider surfaces a thrown Error's
        // message back to the client via `signIn(...).error` — a plain
        // `return null` always collapses to the generic "CredentialsSignin"
        // string, which is what the login page falls back to when it sees
        // that value (see app/login/page.tsx).
        if (user.role === "RESEARCHER") {
          if (user.researcherProfile?.status === "PENDING") {
            throw new Error("Your researcher access request is still pending approval — you'll be notified once it's reviewed.");
          }
          if (user.researcherProfile?.status !== "APPROVED") {
            throw new Error("Your researcher access request was not approved. Contact the MeeronBi team if you have questions.");
          }
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          patientId: user.patient?.id ?? null,
          facilityId: user.facilityId,
          researcherStatus: user.researcherProfile?.status ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.patientId = (user as any).patientId;
        token.facilityId = (user as any).facilityId;
        token.researcherStatus = (user as any).researcherStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).patientId = token.patientId;
        (session.user as any).facilityId = token.facilityId;
        (session.user as any).researcherStatus = token.researcherStatus;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
