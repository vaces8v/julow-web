import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["10.148.162.160"],
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
