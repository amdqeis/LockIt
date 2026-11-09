import type { NextConfig } from "next";

const backend = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:3001";
const nextConfig: NextConfig = {
  distDir: process.env.EDUQUAS_FRONTEND_DIST_DIR || ".next",
  experimental: { useTypeScriptCli: false },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/uploads/exams/:path*", destination: `${backend}/uploads/exams/:path*` },
    ];
  },
};
export default nextConfig;
