import type { Database } from "@/lib/database.types";

type ConnectionLifecycleStatus =
  Database["public"]["Enums"]["broker_connection_status"];
type SyncJobStatus = Database["public"]["Enums"]["broker_sync_job_status"];

export type BrokerConnectionPresentationState =
  | "awaiting_discovery"
  | "syncing"
  | "connected"
  | "stale_error"
  | "disconnected"
  | "revoked";

export type BrokerConnectionPresentation = {
  state: BrokerConnectionPresentationState;
  label: string;
  detail: string;
};

const PRESENTATION: Record<
  BrokerConnectionPresentationState,
  Omit<BrokerConnectionPresentation, "state">
> = {
  awaiting_discovery: {
    label: "Awaiting discovery",
    detail: "Connection discovery is pending; showing the latest available normalized facts.",
  },
  syncing: {
    label: "Syncing",
    detail: "Sync is in progress; showing the latest available normalized facts.",
  },
  connected: {
    label: "Connected",
    detail: "Connected and showing last successfully normalized broker facts.",
  },
  stale_error: {
    label: "Stale / error",
    detail: "Connection needs attention; showing last-good normalized broker facts.",
  },
  disconnected: {
    label: "Disconnected",
    detail: "Connection is disconnected; showing last-good normalized broker facts.",
  },
  revoked: {
    label: "Revoked",
    detail: "Connection access was revoked; showing last-good normalized broker facts.",
  },
};

export function deriveBrokerConnectionPresentation(input: {
  lifecycleStatus: ConnectionLifecycleStatus;
  latestSyncJobStatus: SyncJobStatus | null;
  lastSuccessfulSyncAt: string | null;
}): BrokerConnectionPresentation {
  let state: BrokerConnectionPresentationState;

  if (input.lifecycleStatus === "disconnected") state = "disconnected";
  else if (input.lifecycleStatus === "revoked") state = "revoked";
  else if (
    input.lifecycleStatus === "error" ||
    input.latestSyncJobStatus === "retryable_failure" ||
    input.latestSyncJobStatus === "terminal_failure"
  ) state = "stale_error";
  else if (input.latestSyncJobStatus === "running") state = "syncing";
  else if (input.latestSyncJobStatus === "queued") {
    state = input.lastSuccessfulSyncAt ? "syncing" : "awaiting_discovery";
  } else if (input.lifecycleStatus === "active" && (
    input.lastSuccessfulSyncAt || input.latestSyncJobStatus === "succeeded"
  )) state = "connected";
  else state = "awaiting_discovery";

  return { state, ...PRESENTATION[state] };
}
