import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { consumeToken } from "@/server/http/rateLimit";

const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

// `authorize()` below throws bare `Error` rather than `AppError`, as an exception to CLAUDE.md
// rule 4: NextAuth's credentials provider only forwards `Error.message` to the client and never
// passes through `withApiErrorHandling`, so the typed hierarchy has no effect here.

/** Rate-limits login attempts directly via `consumeToken` (NextAuth's authorize isn't wrapped by withRateLimit). */
function rateLimitLogin(headers: Record<string, any> | undefined): void {
  const forwardedFor: string | undefined = headers?.["x-forwarded-for"];
  const ip = forwardedFor?.split(",")[0]?.trim() || headers?.["x-real-ip"] || "unknown";
  const allowed = consumeToken(`auth.login:${ip}`, LOGIN_RATE_LIMIT.limit, LOGIN_RATE_LIMIT.windowMs);
  if (!allowed) {
    throw new Error("Too many sign-in attempts — please wait a minute and try again.");
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // JWT carries role, patientId and facilityId, so routes trust it without a DB round trip.
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
      async authorize(credentials, req) {
        rateLimitLogin(req?.headers);
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { patient: true, researcherProfile: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Block sign-in for researchers not yet approved; thrown (not null) so the specific message reaches the client.
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
