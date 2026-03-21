import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow API requests to the backend
  async rewrites() {
    return [];
  },
};

export default nextConfig;
