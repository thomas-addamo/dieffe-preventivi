import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  serverExternalPackages: [
    "argon2",
    "pino",
    "@react-pdf/renderer",
    "exceljs",
    "cloudinary",
  ],
};

export default nextConfig;
