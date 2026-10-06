import { SignJWT, jwtVerify } from "jose";
import { tokenInvalidError } from "./errors";

// Short-lived JWT carrying the Google identity still pending researcher signup details. Signed
// with NEXTAUTH_SECRET, so no separate secret needs managing.
const PURPOSE = "researcher-signup";
const TTL_SECONDS = 15 * 60;

export const GOOGLE_RESEARCHER_SIGNUP_COOKIE = "mb_google_researcher_signup";

export interface ResearcherSignupClaims {
  sub: string;
  email: string;
  name: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function mintResearcherSignupToken(claims: ResearcherSignupClaims): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Verifies signature, expiry, and that this token was minted for researcher signup specifically —
 * scoped by `purpose` so it can't be replayed against anything else verified with the same secret. */
export async function verifyResearcherSignupToken(rawToken: string): Promise<ResearcherSignupClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(rawToken, secretKey()));
  } catch {
    throw tokenInvalidError();
  }
  if (payload.purpose !== PURPOSE || typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw tokenInvalidError();
  }
  return { sub: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : payload.email };
}
