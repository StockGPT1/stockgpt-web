import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { runBoundedBrokerSyncWorker as runBrokerSyncRunner } from "@/lib/brokerage/sync-runner";
import { fetchSnapTradeSyncCandidate } from "@/lib/brokerage/providers/snaptrade/service";

export async function runBoundedBrokerSyncWorker(admin: SupabaseClient<Database>) {
  return runBrokerSyncRunner(admin, { fetchSnapTrade: fetchSnapTradeSyncCandidate });
}
