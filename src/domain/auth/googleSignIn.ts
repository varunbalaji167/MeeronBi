// Pure Google sign-in policy — no Prisma import, so this file stays framework-free.
// The role/status unions are redeclared locally rather than imported from @prisma/client.

export type AppRole = "SUPER_ADMIN" | "ADMIN" | "PATIENT" | "RESEARCHER";
export type ResearcherStatus = "PENDING" | "APPROVED" | "REJECTED";

// Canonical provider value for every Google identity, regardless of which NextAuth provider id
// ("google" or "google-signup") started the flow — both share one OAuth client and one `sub`.
export const GOOGLE_OAUTH_PROVIDER = "google";

export interface AccountSummary {
  userId: string;
  role: AppRole;
  researcherStatus: ResearcherStatus | null;
}

export type GoogleVerdict =
  | { kind: "allow"; userId: string }
  | { kind: "link-then-allow"; userId: string }
  | { kind: "needs-researcher-signup" }
  | { kind: "reject"; reason: "email-unverified" | "no-account" | "pending" | "not-approved" };

/** Same researcher-approval gate as credentials `authorize()`; other roles pass straight through. */
function applyGate(account: AccountSummary): GoogleVerdict {
  if (account.role === "RESEARCHER") {
    if (account.researcherStatus === "PENDING") return { kind: "reject", reason: "pending" };
    if (account.researcherStatus !== "APPROVED") return { kind: "reject", reason: "not-approved" };
  }
  return { kind: "allow", userId: account.userId };
}

/** Resolves what a Google sign-in attempt may do. Authorization always comes from the database,
 * never the Google profile; `needs-researcher-signup` creates nothing — the caller does, if at all. */
export function resolveGoogleSignIn(input: {
  emailVerifiedByGoogle: boolean;
  signupAllowed: boolean;
  linkedUser: AccountSummary | null;
  userByEmail: AccountSummary | null;
}): GoogleVerdict {
  // Checked before `linkedUser` too, so an already-linked account can't bypass it.
  if (!input.emailVerifiedByGoogle) return { kind: "reject", reason: "email-unverified" };

  if (input.linkedUser) return applyGate(input.linkedUser);

  if (input.userByEmail) {
    const verdict = applyGate(input.userByEmail);
    return verdict.kind === "allow" ? { kind: "link-then-allow", userId: verdict.userId } : verdict;
  }

  if (input.signupAllowed) return { kind: "needs-researcher-signup" };

  return { kind: "reject", reason: "no-account" };
}
