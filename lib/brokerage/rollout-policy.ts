import { hasActiveSubscription } from "../subscription";

export type BrokerRolloutOperation = "connect" | "discover" | "project";

export type BrokerCohortApproval = Readonly<{
  userId: string;
  approvalReference: string;
  validFrom: string;
  validUntil: string;
  operations: readonly BrokerRolloutOperation[];
}>;

export type BrokerRolloutDecision = Readonly<{
  allowed: boolean;
  reason: "allowed" | "disabled" | "stopped" | "authentication_required" | "subscription_required" | "not_admitted";
}>;

/** Dedicated worker stop switch. Absence preserves the accepted ordinary worker;
 * an explicit or malformed stop value refuses new claims, never deletes facts.
 */
export function isBrokerSyncStopped(value: string | undefined) {
  return value !== undefined && value !== "false";
}

/** Pure policy. Registry/environment must come from trusted server code, never request data or JWT user_metadata. */
export function evaluateBrokerRollout(input: {
  enabled: string | undefined;
  mode: string | undefined;
  stopped: string | undefined;
  userId: string | null;
  subscriptionStatus: string | null | undefined;
  operation: BrokerRolloutOperation;
  approvals: readonly BrokerCohortApproval[];
  asOf: Date;
}): BrokerRolloutDecision {
  if (input.enabled !== "true" || input.mode !== "cohort") return { allowed: false, reason: "disabled" };
  // Invalid switch values fail closed. Absence is safe because mode + explicit owner approval are still mandatory.
  if (input.stopped !== undefined && input.stopped !== "false") return { allowed: false, reason: "stopped" };
  if (!input.userId) return { allowed: false, reason: "authentication_required" };
  if (!hasActiveSubscription(input.subscriptionStatus)) return { allowed: false, reason: "subscription_required" };
  const now = input.asOf.getTime();
  if (!Number.isFinite(now)) return { allowed: false, reason: "not_admitted" };
  const matches = input.approvals.filter((approval) => approval.userId === input.userId);
  // Duplicate/conflicting approvals are not silently selected.
  if (matches.length !== 1) return { allowed: false, reason: "not_admitted" };
  const approval = matches[0];
  const from = Date.parse(approval.validFrom);
  const until = Date.parse(approval.validUntil);
  if (!approval.approvalReference.trim() || !Number.isFinite(from) || !Number.isFinite(until)
    || from >= until || now < from || now >= until || !approval.operations.includes(input.operation)) {
    return { allowed: false, reason: "not_admitted" };
  }
  return { allowed: true, reason: "allowed" };
}
