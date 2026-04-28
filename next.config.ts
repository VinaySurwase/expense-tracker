import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
