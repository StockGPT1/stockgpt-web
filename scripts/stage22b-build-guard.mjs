// Local-config is a replacement config, not a project identity boundary.
// Never load .env.local or infer the destination from the checkout's link.
export function stagingProofBuildAllowed(env) {
  return env.VERCEL === "1"
    && env.NODE_ENV === "production"
    && env.VERCEL_PROJECT_ID === "prj_AxbNJT8VObcG020Abob7Vu5XhdMo"
    && env.VERCEL_ENV === "production" && env.VERCEL_TARGET_ENV === "production"
    && env.VERCEL_GIT_COMMIT_REF === "codex/broker-sync-foundation";
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!stagingProofBuildAllowed(process.env)) {
    console.error("stage22b_build_scope_rejected");
    process.exitCode = 1;
  }
}
