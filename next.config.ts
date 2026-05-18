import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["10.148.162.160"],
  /**
   * `standalone` — Next.js собирает минимальный self-contained server
   * bundle в .next/standalone/ (server.js + только нужные node_modules).
   * Это критично для Docker-образа: размер уменьшается с ~1GB до ~150MB,
   * runtime не зависит от исходного `node_modules`. См. Dockerfile,
   * стадия `runner` — копирует именно `.next/standalone/`.
   */
  output: "standalone",
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
