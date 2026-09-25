import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // SUPER_ADMIN is a strict superset of ADMIN — reuses the same hospital
    // staff UI, so it belongs on the ADMIN branch here too (the actual
    // per-facility scoping/bypass logic lives server-side in
    // server/auth/guards.ts, not in this redirect check).
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
      // Only require *a* valid token here; the role check above handles
      // fine-grained access so we can redirect to /login with context.
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

// Public routes (/, /public/*, /login, /researcher-access/*, /api/public/*,
// /api/researcher-access/*, /api/auth/*) are intentionally excluded — this
// is what makes the trends page and the researcher-access request form
// reachable with no login, same as /login itself.
export const config = {
  matcher: ["/admin/:path*", "/patient/:path*", "/researcher/:path*"],
};
