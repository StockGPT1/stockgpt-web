import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type BrokerUserCredential = { providerUserId: string; userSecret: string };

export async function storeBrokerUserSecret(
  client: SupabaseClient<Database>,
  input: { userId: string; providerId: string; providerUserId: string; userSecret: string },
) {
  const { error } = await client.rpc("store_broker_user_secret", {
    p_user_id: input.userId,
    p_provider_id: input.providerId,
    p_provider_user_id: input.providerUserId,
    p_user_secret: input.userSecret,
  });
  if (error) throw new Error("Unable to store broker credential");
}

export async function retrieveBrokerUserSecret(
  client: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
): Promise<BrokerUserCredential> {
  const { data, error } = await client.rpc("get_broker_user_secret", {
    p_user_id: input.userId,
    p_provider_id: input.providerId,
  });
  if (error || !data?.[0]?.provider_user_id || !data[0].user_secret) {
    throw new Error("Broker credential unavailable");
  }
  return { providerUserId: data[0].provider_user_id, userSecret: data[0].user_secret };
}

export async function revokeBrokerUserSecret(
  client: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
) {
  const { data, error } = await client.rpc("revoke_broker_user_secret", {
    p_user_id: input.userId,
    p_provider_id: input.providerId,
  });
  if (error) throw new Error("Unable to revoke broker credential");
  return data;
}
