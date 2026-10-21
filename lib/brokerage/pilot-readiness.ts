import type { BrokerSyncCandidate } from "./sync-candidate";

/** Planning/rehearsal receipt, not a credential or runtime activation mechanism.
 * A real pilot still needs separately reviewed operational authorization. */
export type InternalPilotReceipt = Readonly<{
  purpose: "synthetic_rehearsal";
  participantId: string;
  providerId: string;
  connectionId: string;
  externalConnectionId: string;
  externalInstitutionId: string;
  externalAccountIds: readonly string[];
  permission: "read";
  operatorReference: string;
  participantInformationReference: string;
  providerReviewReference: string;
  privacyReviewReference: string;
  validFrom: string;
  validUntil: string;
  maxCollections: 1;
  maxDurationSeconds: number;
}>;

export type PilotReadinessCode = "rehearsal_ready" | "real_activation_not_authorized"
  | "identity_invalid" | "scope_invalid" | "permission_invalid"
  | "operator_or_approval_missing" | "window_invalid" | "budget_invalid" | "stopped";

/** No real-person consent or provider/legal clearance is inferred from a Boolean.
 * References in synthetic receipts are rehearsal placeholders only. */
export function evaluateInternalPilotReadiness(input: {
  receipt: InternalPilotReceipt;
  mode: "synthetic" | "real";
  asOf: Date;
  stopped: boolean;
}): { ready: boolean; code: PilotReadinessCode; canActivateRealPilot: false } {
  const refuse = (code: PilotReadinessCode) => ({ ready: false, code, canActivateRealPilot: false as const });
  if (input.stopped) return refuse("stopped");
  if (input.mode !== "synthetic" || input.receipt.purpose !== "synthetic_rehearsal") return refuse("real_activation_not_authorized");
  const r = input.receipt;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  if (![r.participantId, r.providerId, r.connectionId].every((id) => uuid.test(id))) return refuse("identity_invalid");
  // V1 rehearsal deliberately limits one participant, connection and account.
  const identities = [r.externalConnectionId, r.externalInstitutionId, ...r.externalAccountIds];
  if (r.externalAccountIds.length !== 1 || identities.some((id) => !id || id !== id.trim() || id.length > 200)) return refuse("scope_invalid");
  if (r.permission !== "read") return refuse("permission_invalid");
  if (![r.operatorReference, r.participantInformationReference, r.providerReviewReference, r.privacyReviewReference]
    .every((reference) => /^synthetic:[a-z0-9-]{1,80}$/u.test(reference))) return refuse("operator_or_approval_missing");
  const from = Date.parse(r.validFrom), until = Date.parse(r.validUntil), now = input.asOf.getTime();
  if (![from, until, now].every(Number.isFinite) || from >= until || now < from || now >= until
    || until - from > 3_600_000) return refuse("window_invalid");
  if (r.maxCollections !== 1 || !Number.isInteger(r.maxDurationSeconds)
    || r.maxDurationSeconds < 1 || r.maxDurationSeconds > 240) return refuse("budget_invalid");
  return { ready: true, code: "rehearsal_ready", canActivateRealPilot: false };
}

/** Scope check only; the accepted broker validator remains financial authority.
 * Does not alter quantities, prices, provenance or alias identities. */
export function assertInternalPilotCandidateScope(candidate: BrokerSyncCandidate, receipt: InternalPilotReceipt): void {
  if (candidate.accounts.length !== receipt.externalAccountIds.length
    || new Set(candidate.accounts.map((account) => account.externalAccountId)).size !== candidate.accounts.length
    || candidate.accounts.some((account) => !receipt.externalAccountIds.includes(account.externalAccountId)
      || account.externalInstitutionId !== receipt.externalInstitutionId)) {
    throw new Error("pilot_candidate_scope_rejected");
  }
}
