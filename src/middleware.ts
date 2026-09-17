import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/patient") && role !== "PATIENT") {
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

// Public routes (/, /public/*, /login, /api/public/*, /api/auth/*) are
// intentionally excluded — this is what makes the trends page accessible
// with no login for "general users" per the product requirements.
export const config = {
  matcher: ["/admin/:path*", "/patient/:path*"],
};
