import { describe, it, expect } from "vitest";
import { resolveGoogleSignIn, type AccountSummary } from "./googleSignIn";

const admin: AccountSummary = { userId: "admin-1", role: "ADMIN", researcherStatus: null };
const superAdmin: AccountSummary = { userId: "super-1", role: "SUPER_ADMIN", researcherStatus: null };
const patient: AccountSummary = { userId: "patient-1", role: "PATIENT", researcherStatus: null };
const pendingResearcher: AccountSummary = { userId: "res-pending", role: "RESEARCHER", researcherStatus: "PENDING" };
const approvedResearcher: AccountSummary = { userId: "res-approved", role: "RESEARCHER", researcherStatus: "APPROVED" };
const rejectedResearcher: AccountSummary = { userId: "res-rejected", role: "RESEARCHER", researcherStatus: "REJECTED" };

describe("resolveGoogleSignIn", () => {
  it("rejects an unverified Google email even when a linked user exists", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: false,
        signupAllowed: false,
        linkedUser: admin,
        userByEmail: null,
      })
    ).toEqual({ kind: "reject", reason: "email-unverified" });
  });

  it("rejects an unverified Google email even when signup would otherwise be allowed", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: false,
        signupAllowed: true,
        linkedUser: null,
        userByEmail: null,
      })
    ).toEqual({ kind: "reject", reason: "email-unverified" });
  });

  for (const account of [admin, superAdmin, patient, approvedResearcher]) {
    it(`allows a linked ${account.role} (${account.researcherStatus ?? "no researcher status"})`, () => {
      expect(
        resolveGoogleSignIn({
          emailVerifiedByGoogle: true,
          signupAllowed: false,
          linkedUser: account,
          userByEmail: null,
        })
      ).toEqual({ kind: "allow", userId: account.userId });
    });
  }

  it("rejects a linked PENDING researcher as 'pending'", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: pendingResearcher,
        userByEmail: null,
      })
    ).toEqual({ kind: "reject", reason: "pending" });
  });

  it("rejects a linked REJECTED researcher as 'not-approved'", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: rejectedResearcher,
        userByEmail: null,
      })
    ).toEqual({ kind: "reject", reason: "not-approved" });
  });

  // Any role found by email (no OAuthAccount row yet) links and signs in — authorization came
  // from provisioning, not from Google.
  it("links-then-allows an ADMIN found by email", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: null,
        userByEmail: admin,
      })
    ).toEqual({ kind: "link-then-allow", userId: admin.userId });
  });

  it("links-then-allows a SUPER_ADMIN found by email", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: null,
        userByEmail: superAdmin,
      })
    ).toEqual({ kind: "link-then-allow", userId: superAdmin.userId });
  });

  it("links-then-allows a PATIENT found by email", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: null,
        userByEmail: patient,
      })
    ).toEqual({ kind: "link-then-allow", userId: patient.userId });
  });

  it("applies the researcher gate on the email-matched path too: PENDING rejects rather than linking", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: null,
        userByEmail: pendingResearcher,
      })
    ).toEqual({ kind: "reject", reason: "pending" });
  });

  it("links-then-allows an APPROVED researcher found by email", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: null,
        userByEmail: approvedResearcher,
      })
    ).toEqual({ kind: "link-then-allow", userId: approvedResearcher.userId });
  });

  it("returns needs-researcher-signup when no match and signup is allowed", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: true,
        linkedUser: null,
        userByEmail: null,
      })
    ).toEqual({ kind: "needs-researcher-signup" });
  });

  // Proves the tenant boundary stays out of Google's hands: the "google" provider id never creates.
  it("rejects as no-account when no match and signup is disallowed", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: null,
        userByEmail: null,
      })
    ).toEqual({ kind: "reject", reason: "no-account" });
  });

  it("prefers linkedUser over a different userByEmail", () => {
    expect(
      resolveGoogleSignIn({
        emailVerifiedByGoogle: true,
        signupAllowed: false,
        linkedUser: admin,
        userByEmail: patient,
      })
    ).toEqual({ kind: "allow", userId: admin.userId });
  });
});
