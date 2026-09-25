/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // `allowedOrigins` used to be a wildcard ("*") — flagged in
    // docs/SCALING_PLAN.md as a real gap, and specifically relevant now:
    // CVE-2025-55183 (Dec 2025 Next.js security advisory) is a
    // Server-Actions source/function leak that only affects apps that have
    // opted into this experimental flag, which this app has. A wildcard
    // origin widens that CVE's exploitable surface for no real benefit —
    // narrow this to the actual deployed domain(s) via
    // NEXT_PUBLIC_APP_ORIGIN once there's a real production domain; falls
    // back to localhost for local development in the meantime.
    serverActions: {
      allowedOrigins: [process.env.NEXT_PUBLIC_APP_ORIGIN || "localhost:3000"],
    },
  },
};

export default nextConfig;
