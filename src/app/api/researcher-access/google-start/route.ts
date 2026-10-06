import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyResearcherSignupToken, GOOGLE_RESEARCHER_SIGNUP_COOKIE } from "@/server/auth/googleResearcherSignupToken";
import { appUrl } from "@/config/env";

const COOKIE_MAX_AGE_SECONDS = 15 * 60;

// Public by design: only reachable with a valid short-lived JWT minted by the Google signIn
// callback. Moves that proof out of the URL into an httpOnly cookie before the user lands on the form.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");

  if (!token) {
    return NextResponse.redirect(new URL("/researcher-access?error=google-link-invalid", appUrl));
  }

  try {
    await verifyResearcherSignupToken(token);
  } catch {
    return NextResponse.redirect(new URL("/researcher-access?error=google-link-invalid", appUrl));
  }

  cookies().set(GOOGLE_RESEARCHER_SIGNUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(new URL("/researcher-access/complete", appUrl));
}
