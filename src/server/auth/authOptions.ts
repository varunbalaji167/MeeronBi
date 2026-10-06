import type { NextAuthOptions, Account } from "next-auth";
import type { GoogleProfile } from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { consumeToken } from "@/server/http/rateLimit";
import { log } from "@/server/http/logger";
import { googleConfig } from "@/config/env";
import { resolveGoogleSignIn, GOOGLE_OAUTH_PROVIDER, type AccountSummary } from "@/domain/auth/googleSignIn";
import { linkGoogleAccount } from "@/server/auth/credentialFlows";
import { mintResearcherSignupToken } from "@/server/auth/googleResearcherSignupToken";

const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

// Two provider ids, one OAuth client: "google" only signs in, "google-signup" may also register a researcher.
const GOOGLE_SIGNIN_PROVIDER_ID = "google";
const GOOGLE_SIGNUP_PROVIDER_ID = "google-signup";

function isGoogleAccount(account: Account | null): account is Account {
  return !!account && (account.provider === GOOGLE_SIGNIN_PROVIDER_ID || account.provider === GOOGLE_SIGNUP_PROVIDER_ID);
}

function toAccountSummary(user: {
  id: string;
  role: "SUPER_ADMIN" | "ADMIN" | "PATIENT" | "RESEARCHER";
  researcherProfile: { status: "PENDING" | "APPROVED" | "REJECTED" } | null;
}): AccountSummary {
  return { userId: user.id, role: user.role, researcherStatus: user.researcherProfile?.status ?? null };
}

/** Loads the local account linked to this Google `sub`, if any — select shape matches `toAccountSummary`. */
async function findLinkedAccount(providerAccountId: string) {
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE_OAUTH_PROVIDER, providerAccountId } },
    select: { user: { select: { id: true, role: true, researcherProfile: { select: { status: true } } } } },
  });
  return linked?.user ? toAccountSummary(linked.user) : null;
}

async function findAccountByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, researcherProfile: { select: { status: true } } },
  });
  return user ? toAccountSummary(user) : null;
}

// authorize() throws bare Error, not AppError: NextAuth forwards only Error.message to the client
// and never passes through withApiErrorHandling, so status/error codes would be discarded anyway.

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
    // No dedicated error page — reusing /login lets a Google sign-in failure show tab-appropriate
    // copy instead of NextAuth's generic built-in error screen (see src/app/login/page.tsx).
    error: "/login",
  },
  providers: [
    // No PrismaAdapter: it would auto-create users, bypassing the PENDING/approval model entirely.
    // Account creation stays in researcherAccessService.ts, via the signIn/jwt callbacks below.
    ...(googleConfig
      ? [
          GoogleProvider({
            id: GOOGLE_SIGNIN_PROVIDER_ID,
            clientId: googleConfig.clientId,
            clientSecret: googleConfig.clientSecret,
          }),
          GoogleProvider({
            id: GOOGLE_SIGNUP_PROVIDER_ID,
            clientId: googleConfig.clientId,
            clientSecret: googleConfig.clientSecret,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        rateLimitLogin(req?.headers);
        if (!credentials?.email || !credentials?.password) return null;

        // Only the errors deliberately thrown below should reach the client as-is; anything else
        // (e.g. the DB being unreachable) is caught and replaced with a generic message.
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
            include: { patient: true, researcherProfile: true },
          });
          if (!user) return null;

          // Must come before bcrypt.compare, which must never receive null: an invited user who hasn't
          // accepted their invite yet has no password to compare against.
          if (user.passwordHash === null) {
            throw new Error("You haven't set a password yet — check your email for the set-up link.");
          }

          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!valid) return null;

          // Before the PENDING check below, so an unverified researcher is told the actionable thing
          // (verify your email) rather than the generic "still pending" message.
          if (user.role === "RESEARCHER" && !user.emailVerifiedAt) {
            throw new Error("Please verify your email before signing in — check your inbox for the verification link, or request a new one.");
          }

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
            passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
          };
        } catch (err) {
          if (
            err instanceof Error &&
            (err.message.includes("pending approval") ||
              err.message.includes("was not approved") ||
              err.message.includes("haven't set a password") ||
              err.message.includes("verify your email"))
          ) {
            throw err;
          }
          log.error({ err: err instanceof Error ? err.stack ?? err.message : String(err) }, "Unhandled error in authorize()");
          throw new Error("Something went wrong while signing in. Please try again shortly.");
        }
      },
    }),
  ],
  callbacks: {
    // Google authenticates, the database authorizes — resolveGoogleSignIn (pure, exhaustively
    // tested) decides the verdict; this callback only executes it.
    async signIn({ account, profile }) {
      if (!isGoogleAccount(account)) return true;

      // Whatever is thrown here becomes `?error=<message>` on the /login redirect, shown verbatim
      // to the client, so infra failures must never leak through as a raw error message.
      try {
        const googleProfile = profile as GoogleProfile;
        const providerAccountId = account.providerAccountId;
        const email = googleProfile.email?.toLowerCase().trim() ?? null;

        const verdict = resolveGoogleSignIn({
          emailVerifiedByGoogle: googleProfile.email_verified === true,
          signupAllowed: account.provider === GOOGLE_SIGNUP_PROVIDER_ID,
          linkedUser: await findLinkedAccount(providerAccountId),
          userByEmail: email ? await findAccountByEmail(email) : null,
        });

        switch (verdict.kind) {
          case "allow":
            return true;
          case "link-then-allow":
            if (!email) return false;
            await linkGoogleAccount(verdict.userId, providerAccountId, email);
            return true;
          case "needs-researcher-signup": {
            if (!email) return false;
            const token = await mintResearcherSignupToken({
              sub: providerAccountId,
              email,
              name: googleProfile.name ?? email,
            });
            return `/api/researcher-access/google-start?t=${token}`;
          }
          case "reject":
            // Mapped to tab-appropriate copy by the login page.
            throw new Error(`google-${verdict.reason}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("google-")) throw err;
        log.error({ err: err instanceof Error ? err.stack ?? err.message : String(err) }, "Unhandled error in Google signIn callback");
        throw new Error("google-error");
      }
    },
    async jwt({ token, user, account }) {
      // With no PrismaAdapter, `user` after a Google sign-in is the Google profile: `user.id` is
      // the Google `sub`, not a MeeronBi user id. Left alone that would flow into every guard via
      // session.user.id, including facilityId — the tenant boundary.
      if (isGoogleAccount(account)) {
        const linked = await prisma.oAuthAccount.findUnique({
          where: { provider_providerAccountId: { provider: GOOGLE_OAUTH_PROVIDER, providerAccountId: account.providerAccountId } },
          include: { user: { include: { patient: true, researcherProfile: true } } },
        });
        // Shouldn't happen — signIn only returns true once an OAuthAccount row exists for this
        // `sub`. NextAuth won't forward this to the client, so logging is the only way to see it.
        if (!linked) {
          log.error({ providerAccountId: account.providerAccountId }, "jwt callback: no OAuthAccount found after a successful Google signIn");
          throw new Error("google-error");
        }

        const u = linked.user;
        token.sub = u.id;
        token.role = u.role;
        token.patientId = u.patient?.id ?? null;
        token.facilityId = u.facilityId;
        token.researcherStatus = u.researcherProfile?.status ?? null;
        token.passwordChangedAt = u.passwordChangedAt?.toISOString() ?? null;
        return token;
      }

      if (user) {
        token.role = (user as any).role;
        token.patientId = (user as any).patientId;
        token.facilityId = (user as any).facilityId;
        token.researcherStatus = (user as any).researcherStatus;
        token.passwordChangedAt = (user as any).passwordChangedAt;
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
        (session.user as any).passwordChangedAt = token.passwordChangedAt;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
