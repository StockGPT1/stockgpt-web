import { pathToFileURL } from "node:url";

// Proposal for the CUSTOMER project's Dashboard Ignored Build Step only.
// Not wired into vercel.json, npm build or CI. Team ownership is independently
// verified by the publication gate; VERCEL_ORG_ID is not assumed a system var.
export const CUSTOMER_PROJECT_ID = "prj_QzlZVgUZ5qIC5SwYz5k3ThQKkQNo";
export const FOUNDATION_BRANCH = "codex/broker-sync-foundation";
export const IGNORE_COMMAND = "node scripts/customer-project-ignore-build.mjs";

export function shouldSkipCustomerFoundationBuild(env) {
  return env?.VERCEL_PROJECT_ID === CUSTOMER_PROJECT_ID
    && env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_PROVIDER === "github"
    && env.VERCEL_GIT_REPO_OWNER === "StockGPT1"
    && env.VERCEL_GIT_REPO_SLUG === "stockgpt-web"
    && env.VERCEL_GIT_COMMIT_REF === FOUNDATION_BRANCH;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Vercel's contract is inverted: 0 skips; 1 continues. No values are logged.
  // Other branches/projects deliberately preserve their existing build decision.
  process.exitCode = shouldSkipCustomerFoundationBuild(process.env) ? 0 : 1;
}
