import type { NextConfig } from "next";
import { securityHeaders } from "@/lib/security/headers";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
