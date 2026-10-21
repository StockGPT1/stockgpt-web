import { CUSTOMER_PROJECT_ID, FOUNDATION_BRANCH, IGNORE_COMMAND } from "./customer-project-ignore-build.mjs";

export const TEAM_ID = "team_eUm0mdcYHHHcNo4D5tMm9cHQ";
export const STAGING_PROJECT_ID = "prj_AxbNJT8VObcG020Abob7Vu5XhdMo";
export const ROOT_CONFIG_SHA256 = "029aab74a8f285c0bbf601d4651c346732dd48b18555fc512a8b6acfbf0f4e69";
const SHA = /^[a-f0-9]{40}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]+$/;

// Pure release preflight, never a push/deploy command or an authorization source.
// A reviewer supplies a secret-free receipt from fresh read-only project/API
// metadata and approves the exact candidate. Tests use synthetic receipts only.
export function evaluatePublicationGate(receipt, { candidateSha, remoteSha, now } = {}) {
  const blocked = [];
  const requireFact = (valid, code) => { if (!valid) blocked.push(code); };
  const r = receipt ?? {};
  const customer = r.customer ?? {};
  const staging = r.staging ?? {};
  const observedAt = Date.parse(r.observedAt);
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  requireFact(Number.isFinite(nowMs) && Number.isFinite(observedAt)
    && observedAt <= nowMs && nowMs - observedAt <= 15 * 60_000, "metadata_not_fresh");
  requireFact(r.metadataSource === "authenticated_vercel_read_only", "metadata_source_unverified");
  requireFact(SHA.test(candidateSha ?? "") && r.candidateSha === candidateSha, "candidate_sha_mismatch");
  requireFact(SHA.test(remoteSha ?? "") && r.expectedRemoteSha === remoteSha, "remote_sha_mismatch");
  requireFact(r.branch === FOUNDATION_BRANCH && r.remoteBranch === FOUNDATION_BRANCH, "branch_mismatch");
  requireFact(r.repository === "StockGPT1/stockgpt-web", "repository_mismatch");
  requireFact(r.worktreeClean === true && r.secretScanPassed === true, "source_inventory_unverified");
  requireFact(r.rootConfigSha256 === ROOT_CONFIG_SHA256 && r.rootCronCount === 10, "customer_root_config_changed");
  requireFact(r.approvalRegistriesEmpty === true, "approval_registry_not_empty");
  requireFact(r.pushApprovedForSha === candidateSha && SHA.test(candidateSha ?? ""), "push_not_approved");
  for (const [name, project, expectedId] of [["customer", customer, CUSTOMER_PROJECT_ID], ["staging", staging, STAGING_PROJECT_ID]]) {
    requireFact(project.id === expectedId && project.teamId === TEAM_ID, `${name}_scope_unverified`);
    requireFact(project.repository === "StockGPT1/stockgpt-web", `${name}_repository_unverified`);
    requireFact(project.target === "production" && project.productionBranch === "main", `${name}_production_target_unverified`);
    requireFact(DEPLOYMENT.test(project.productionDeploymentId ?? "") && SHA.test(project.productionSha ?? ""), `${name}_deployment_unverified`);
    requireFact(project.protectionUnchanged === true, `${name}_protection_unverified`);
    requireFact(project.environmentScopesReviewed === true, `${name}_environment_scopes_unverified`);
    requireFact(project.otherDeploymentTriggersReviewed === true, `${name}_other_triggers_unverified`);
  }
  // Narrow supported proposal: exact Dashboard command, no source override and
  // no pre-existing ignore policy to overwrite. Existing rules need separately
  // reviewed composition, not a caller-controlled shell command in this tool.
  requireFact(customer.foundationTarget === "preview" && customer.automaticGitDeployments === true,
    "customer_preview_classification_unverified");
  requireFact(customer.effectiveIgnoreCommand === IGNORE_COMMAND
    && customer.sourceIgnoreCommandPresent === false
    && customer.priorIgnoreCommand === null, "effective_ignore_policy_unverified");
  requireFact(customer.systemMetadataVerified === true && customer.skipPredicateVerified === true
    && customer.mainPredicatePreserved === true, "ignore_predicates_unverified");
  requireFact(staging.automaticGitDeployments === false && staging.cronEnabled === false
    && staging.scheduleCount === 0 && staging.proofActivated === false, "staging_not_stopped");
  requireFact(r.githubCiConsequencesReviewed === true && r.customerPreviewSkippedBuildAccepted === true,
    "publication_consequences_unapproved");
  return { allowed: blocked.length === 0, blockers: blocked };
}
