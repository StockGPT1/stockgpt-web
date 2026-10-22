import type { BrokerCohortApproval } from "./rollout-policy";

export type PilotAiFeature = "portfolio_draft" | "ask_explanations";
export type PilotAiApproval = Readonly<{
  userId: string;
  approvalReference: string;
  validFrom: string;
  validUntil: string;
  revokedAt: string | null;
  features: readonly PilotAiFeature[];
}>;

export const PILOT_DRAFT_UNAVAILABLE = "AI Portfolio Drafts are unavailable during this read-only pilot.";
export const PILOT_ASK_UNAVAILABLE = "Ask StockGPT is unavailable during this read-only pilot. Your factual Portfolio views remain available.";

/** Cohort identity is trusted server configuration, not a browser-selected mode.
 * Expiry, revocation or malformed cohort approval must not lift the restriction.
 * A distinct reviewed product/provider/regulatory approval is required per AI feature.
 * No entry can authorize personalized transaction instructions.
 */
export function evaluatePilotAiAccess(input: {
  userId: string | null;
  participants: readonly BrokerCohortApproval[];
  draftApprovals: readonly PilotAiApproval[];
  asOf: Date;
  feature: PilotAiFeature;
}): { allowed: boolean; reason: "authentication_required" | "ordinary_customer" | "pilot_restricted" | "separately_approved" } {
  if (!input.userId) return { allowed: false, reason: "authentication_required" };
  const participants = input.participants.filter((row) => row.userId === input.userId);
  if (participants.length === 0) return { allowed: true, reason: "ordinary_customer" };
  const now = input.asOf.getTime();
  const approvals = input.draftApprovals.filter((row) => row.userId === input.userId);
  const participant = participants[0];
  const approval = approvals[0];
  function current(from: string, until: string) {
    const start = Date.parse(from);
    const end = Date.parse(until);
    return Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end)
      && start < end && start <= now && now < end;
  }
  if (participants.length !== 1 || approvals.length !== 1
    || !participant.approvalReference.trim()
    || !current(participant.validFrom, participant.validUntil)
    || !approval.approvalReference.trim() || approval.revokedAt !== null || !approval.features.includes(input.feature)
    || !current(approval.validFrom, approval.validUntil)) {
    return { allowed: false, reason: "pilot_restricted" };
  }
  return { allowed: true, reason: "separately_approved" };
}

export function evaluatePilotDraftAccess(input: Omit<Parameters<typeof evaluatePilotAiAccess>[0], "feature">) {
  return evaluatePilotAiAccess({ ...input, feature: "portfolio_draft" });
}
