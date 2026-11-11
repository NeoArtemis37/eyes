import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "http://localhost:3000",
    "https://*.space-z.ai",
    "http://*.space-z.ai",
  ],
};

export default nextConfig;
