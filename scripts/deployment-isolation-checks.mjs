import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CUSTOMER_PROJECT_ID, FOUNDATION_BRANCH, IGNORE_COMMAND, shouldSkipCustomerFoundationBuild } from "./customer-project-ignore-build.mjs";
import { evaluatePublicationGate, ROOT_CONFIG_SHA256, STAGING_PROJECT_ID, STAGING_PRODUCTION_BRANCH, TEAM_ID } from "./publication-gate.mjs";

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
const env = {
  VERCEL_PROJECT_ID: CUSTOMER_PROJECT_ID, VERCEL_ENV: "preview", VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "StockGPT1", VERCEL_GIT_REPO_SLUG: "stockgpt-web", VERCEL_GIT_COMMIT_REF: FOUNDATION_BRANCH,
};
check(shouldSkipCustomerFoundationBuild(env), "exact customer Preview skips");
for (const key of Object.keys(env)) {
  check(!shouldSkipCustomerFoundationBuild({ ...env, [key]: undefined }), `missing ${key} cannot claim isolation`);
  check(!shouldSkipCustomerFoundationBuild({ ...env, [key]: "wrong" }), `wrong ${key} cannot claim isolation`);
}
check(!shouldSkipCustomerFoundationBuild({ ...env, VERCEL_PROJECT_ID: STAGING_PROJECT_ID }), "Staging unaffected");
check(!shouldSkipCustomerFoundationBuild({ ...env, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }), "main unaffected");
check(!shouldSkipCustomerFoundationBuild({ ...env, VERCEL_GIT_COMMIT_REF: `${FOUNDATION_BRANCH}-other` }), "no prefix matching");
for (const [metadata, expected] of [[env, 0], [{ ...env, VERCEL_ENV: "production" }, 1], [{}, 1]]) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./customer-project-ignore-build.mjs", import.meta.url))], {
    env: { SystemRoot: process.env.SystemRoot, ...metadata }, encoding: "utf8",
  });
  check(result.status === expected && result.stdout === "" && result.stderr === "", "real exit contract, no logs");
}
// Execute the exact installed shell rule rather than merely emulating it in JS.
const shell = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/sh";
for (const [environment, branch, expected] of [
  ["preview", FOUNDATION_BRANCH, 0], ["production", FOUNDATION_BRANCH, 1],
  ["production", "main", 1], ["preview", "main", 1],
  ["preview", `${FOUNDATION_BRANCH}-other`, 1], ["preview", "other", 1],
  ["development", FOUNDATION_BRANCH, 1], ["", FOUNDATION_BRANCH, 1], ["preview", "", 1],
]) {
  const result = spawnSync(shell, ["-c", IGNORE_COMMAND], {
    env: { SystemRoot: process.env.SystemRoot, VERCEL_ENV: environment, VERCEL_GIT_COMMIT_REF: branch }, encoding: "utf8",
  });
  check(result.status === expected && result.stdout === "" && result.stderr === "", "installed shell exit contract, no logs");
}
const candidateSha = "a".repeat(40);
const remoteSha = "b".repeat(40);
const now = new Date("2026-10-21T21:00:00Z");
const project = { teamId: TEAM_ID, repository: "StockGPT1/stockgpt-web", target: "production", productionBranch: "main",
  productionDeploymentId: "dpl_SyntheticOnly", productionSha: remoteSha, protectionUnchanged: true,
  environmentScopesReviewed: true, otherDeploymentTriggersReviewed: true };
const valid = {
  metadataSource: "authenticated_vercel_read_only", observedAt: "2026-10-21T20:59:00Z", candidateSha,
  expectedRemoteSha: remoteSha, branch: FOUNDATION_BRANCH, remoteBranch: FOUNDATION_BRANCH,
  repository: "StockGPT1/stockgpt-web", worktreeClean: true, secretScanPassed: true,
  rootConfigSha256: ROOT_CONFIG_SHA256, rootCronCount: 10, approvalRegistriesEmpty: true,
  pushApprovedForSha: candidateSha, githubCiConsequencesReviewed: true, customerPreviewSkippedBuildAccepted: true,
  customer: { ...project, id: CUSTOMER_PROJECT_ID, automaticGitDeployments: true, foundationTarget: "preview",
    effectiveIgnoreCommand: IGNORE_COMMAND, sourceIgnoreCommandPresent: false, priorIgnoreCommand: null,
    systemMetadataVerified: true, systemEnvironmentVariablesExposed: true, skipPredicateVerified: true, mainPredicatePreserved: true },
  staging: { ...project, id: STAGING_PROJECT_ID, productionBranch: STAGING_PRODUCTION_BRANCH, automaticGitDeployments: false, cronEnabled: false,
    scheduleCount: 0, proofActivated: false },
};
const evaluate = (r) => evaluatePublicationGate(r, { candidateSha, remoteSha, now });
check(evaluate(valid).allowed, "complete SYNTHETIC receipt can pass");
check(!evaluate(undefined).allowed, "no receipt blocked");
for (const key of Object.keys(valid)) {
  check(!evaluate({ ...valid, [key]: undefined }).allowed, `missing receipt ${key} blocks`);
}
for (const section of ["customer", "staging"]) {
  for (const key of Object.keys(valid[section])) {
    check(!evaluate({ ...valid, [section]: { ...valid[section], [key]: undefined } }).allowed, `missing ${section}.${key} blocks`);
  }
}
for (const change of [
  { observedAt: "2026-10-21T20:44:59Z" }, { observedAt: "2026-10-21T21:01:00Z" },
  { candidateSha: remoteSha }, { expectedRemoteSha: candidateSha }, { rootCronCount: 11 },
  { rootConfigSha256: "0".repeat(64) }, { branch: "main" }, { pushApprovedForSha: remoteSha },
  { customer: { ...valid.customer, sourceIgnoreCommandPresent: true } },
  { customer: { ...valid.customer, priorIgnoreCommand: "existing-policy" } },
  { customer: { ...valid.customer, effectiveIgnoreCommand: "exit 0" } },
  { customer: { ...valid.customer, effectiveIgnoreCommand: "node scripts/customer-project-ignore-build.mjs" } },
  { customer: { ...valid.customer, systemEnvironmentVariablesExposed: false } },
  { customer: { ...valid.customer, productionBranch: FOUNDATION_BRANCH } },
  { customer: { ...valid.customer, teamId: "other" } },
  { staging: { ...valid.staging, id: CUSTOMER_PROJECT_ID } },
  { staging: { ...valid.staging, automaticGitDeployments: true } },
  { staging: { ...valid.staging, productionBranch: "main" } },
  { staging: { ...valid.staging, cronEnabled: true } },
  { staging: { ...valid.staging, scheduleCount: 1 } },
  { staging: { ...valid.staging, proofActivated: true } },
]) check(!evaluate({ ...valid, ...change }).allowed, "hostile or contradictory receipt blocks");
const configBytes = readFileSync(new URL("../vercel.json", import.meta.url));
check(createHash("sha256").update(configBytes.toString("utf8").replace(/\r\n/g, "\n")).digest("hex") === ROOT_CONFIG_SHA256, "customer root unchanged apart from Git newline conversion");
const config = JSON.parse(configBytes);
check(config.crons.length === 10 && !("ignoreCommand" in config) && !("git" in config), "no shared deployment policy mutation");
check(!readFileSync(new URL("./publication-gate.mjs", import.meta.url), "utf8").includes("child_process"), "gate cannot invoke publication");
console.log(`Deployment isolation: ${checks} deterministic checks passed; tests perform no cloud mutation or publication.`);
