import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { retrieveBrokerUserSecret } from "@/lib/brokerage/secret-store";
import {
  listSnapTradeConnections,
  registerSnapTradeUser,
} from "@/lib/brokerage/providers/snaptrade/service";
import type { SnapTradeClient } from "@/lib/brokerage/providers/snaptrade/client";

export async function ensureSnapTradeRegistration(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
  sdk?: SnapTradeClient,
) {
  try {
    await retrieveBrokerUserSecret(admin, input);
  } catch {
    await registerSnapTradeUser(admin, input, sdk);
  }
}

export async function discoverSnapTradeConnections(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
  sdk?: SnapTradeClient,
) {
  const discovered = await listSnapTradeConnections(admin, input, sdk);
  const normalized = [];

  for (const item of discovered) {
    const externalConnectionId = item.id?.trim();
    const externalInstitutionId = item.brokerage?.id?.trim();
    const institutionName = (item.brokerage?.display_name || item.brokerage?.name || item.brokerage?.slug)?.trim();
    if (!externalConnectionId || !externalInstitutionId || !institutionName || item.type !== "read") continue;

    const alias = await admin.from("brokerage_institution_aliases")
      .select("institution_id")
      .eq("provider_id", input.providerId)
      .eq("external_institution_id", externalInstitutionId)
      .maybeSingle();
    if (alias.error) throw new Error("Broker institution mapping unavailable");

    let institutionId = alias.data?.institution_id;
    if (!institutionId) {
      const institution = await admin.from("brokerage_institutions")
        .insert({ name: institutionName })
        .select("id")
        .single();
      if (institution.error) throw new Error("Broker institution creation failed");
      institutionId = institution.data.id;
      const mapping = await admin.from("brokerage_institution_aliases").insert({
        provider_id: input.providerId,
        external_institution_id: externalInstitutionId,
        institution_id: institutionId,
      });
      if (mapping.error) throw new Error("Broker institution mapping failed");
    }

    const status = item.disabled ? "disconnected" as const : "pending" as const;
    const connection = await admin.from("broker_connections").upsert({
      user_id: input.userId,
      provider_id: input.providerId,
      institution_id: institutionId,
      external_connection_id: externalConnectionId,
      status,
      connected_at: item.created_date ?? null,
      disconnected_at: item.disabled ? (item.disabled_date ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider_id,external_connection_id" }).select("id,status").single();
    if (connection.error) throw new Error("Broker connection discovery failed");

    if (!item.disabled) {
      const queued = await admin.rpc("enqueue_broker_sync", {
        p_user_id: input.userId,
        p_connection_id: connection.data.id,
      });
      if (queued.error) throw new Error("Broker initial sync queue failed");
    }
    normalized.push(connection.data);
  }
  return normalized;
}
