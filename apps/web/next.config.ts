import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone só no build de produção (Docker/Linux): symlinks do tracing
  // falham no Windows sem Developer Mode.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  transpilePackages: ["@sales4u/core","@sales4u/db","@sales4u/brain","@sales4u/emails","@sales4u/messaging","@sales4u/automation"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
