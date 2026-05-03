import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  serverExternalPackages: ["better-sqlite3", "argon2", "pino", "@react-pdf/renderer"],
  async rewrites() {
    return [
      {
        source: "/storage/:path*",
        destination: "/api/storage/:path*",
      },
    ];
  },
};

export default nextConfig;
