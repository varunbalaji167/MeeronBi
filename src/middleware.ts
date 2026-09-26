import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // SUPER_ADMIN reuses the ADMIN UI; facility scoping is enforced in server/auth/guards.ts.
    if (pathname.startsWith("/admin") && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/patient") && role !== "PATIENT") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/researcher") && role !== "RESEARCHER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      // Only checks a token exists; the role check above handles fine-grained access.
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

// Public routes (/, /public/*, /login, /researcher-access/*, /api/public/*, /api/auth/*) are excluded.
export const config = {
  matcher: ["/admin/:path*", "/patient/:path*", "/researcher/:path*"],
};
