import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Resolve the build's commit SHA for the landing footer. Vercel sets
// VERCEL_GIT_COMMIT_SHA automatically; locally we shell out to git;
// non-git contexts (e.g. tarball builds) fall back to "dev".
let commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
if (!commitSha) {
  try {
    commitSha = execSync("git rev-parse HEAD").toString().trim();
  } catch {
    commitSha = "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
  },
  experimental: {
    serverActions: {
      // Default Next 16 cap is 1MB. Headroom over the 10MB MAX_BYTES
      // app gate covers FormData overhead + the PDF preview blob
      // (~1-2MB). Files between 10-12MB pass to the action and are
      // rejected there with the friendly "File is over 10 MB." copy.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
