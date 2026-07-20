import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json exists in a parent folder; pin the root here.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      // Attachments are uploaded through server actions.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
