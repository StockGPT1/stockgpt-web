export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "basic",
  "core",
  "premium",
  "max",
  "alpha",
  "trialing",
  "active",
]);

export function hasActiveSubscription(status: string | null | undefined) {
  if (!status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status.toLowerCase());
}

export function displayPlanName(status: string | null | undefined) {
  const normalised = status?.toLowerCase();

  if (normalised === "max") return "StockGPT Max";
  if (normalised === "premium") return "Premium";
  if (normalised === "core" || normalised === "basic") return "Core";
  if (normalised === "alpha") return "Alpha";
  if (normalised === "trialing") return "Trial";
  if (normalised === "active") return "Active plan";

  return "No active plan";
}
