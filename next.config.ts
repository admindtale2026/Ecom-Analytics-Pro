import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // These packages ship native/wasm assets or are server-only; keep them out
  // of the bundler so their file resolution works at runtime.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "postgres",
    "bcryptjs",
  ],
  // Pin the workspace root (a stray lockfile exists above the project).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
