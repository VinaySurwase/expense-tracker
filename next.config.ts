import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling the native C++ addon — it must be loaded at runtime.
  serverExternalPackages: ["better-sqlite3"],

  // Rewrite /expenses → /api/expenses so both paths work.
  // The assignment specifies POST/GET /expenses; Next.js convention uses /api/.
  async rewrites() {
    return [
      {
        source: "/expenses",
        destination: "/api/expenses",
      },
    ];
  },

  // Security headers — applied to all responses.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
