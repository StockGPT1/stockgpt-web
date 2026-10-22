import "server-only";
import { APPROVED_BROKER_COHORTS } from "./capability";
import { evaluatePilotAiAccess, type PilotAiFeature, type PilotAiApproval } from "./pilot-feature-policy";

// No participant or feature is activated. Populate only after separate reviewed
// product, provider and regulatory decisions. Never read request/JWT metadata.
export const APPROVED_PILOT_AI: readonly PilotAiApproval[] = Object.freeze([]);

export function pilotAiAccess(userId: string | null, feature: PilotAiFeature) {
  return evaluatePilotAiAccess({
    userId,
    feature,
    participants: APPROVED_BROKER_COHORTS,
    draftApprovals: APPROVED_PILOT_AI,
    asOf: new Date(),
  });
}

export function pilotDraftAccess(userId: string | null) {
  return pilotAiAccess(userId, "portfolio_draft");
}
