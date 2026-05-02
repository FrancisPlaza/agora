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
      // Default Next 16 cap is 1MB. Sized to fit Vercel's 4.5MB
      // platform body limit with a small buffer above the 3MB
      // MAX_BYTES app gate. Anything between 3 and 4MB is rejected
      // by the validation layer with the friendly "File is over
      // 3 MB." copy; anything above 4MB is rejected here.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
