import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project directory so it resolves correctly
    // in any environment (local, CI, Vercel) instead of a hardcoded path.
    root: import.meta.dirname,
  },
};

export default nextConfig;
