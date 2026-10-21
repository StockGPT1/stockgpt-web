import "server-only";
import { evaluateBrokerRollout, isBrokerSyncStopped, type BrokerCohortApproval, type BrokerRolloutOperation } from "./rollout-policy";

// Deliberately empty. Admission requires a separately approved, reviewed server-side change.
// A customer cannot enroll through form/query data, email domain, plan or user_metadata.
export const APPROVED_BROKER_COHORTS: readonly BrokerCohortApproval[] = Object.freeze([]);

export function brokerRolloutAccess(input: {
  userId: string | null;
  subscriptionStatus: string | null | undefined;
  operation: BrokerRolloutOperation;
}) {
  return evaluateBrokerRollout({
    ...input,
    enabled: process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED,
    mode: process.env.STOCKGPT_BROKER_ROLLOUT_MODE,
    stopped: process.env.STOCKGPT_BROKER_ROLLOUT_STOPPED,
    approvals: APPROVED_BROKER_COHORTS,
    asOf: new Date(),
  });
}

export function brokerConnectionsEnabled() {
  return process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED === "true";
}

export function brokerSyncStopped() {
  return isBrokerSyncStopped(process.env.STOCKGPT_BROKER_SYNC_STOPPED);
}

export function brokerPortalSandboxRestriction(): "SANDBOX" | undefined {
  return process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX === "true" ? "SANDBOX" : undefined;
}

export function brokerReturnUrl() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("Broker connection configuration unavailable");
  const url = new URL("/portfolio/connections/return", origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Broker connection configuration unavailable");
  }
  return url.toString();
}
