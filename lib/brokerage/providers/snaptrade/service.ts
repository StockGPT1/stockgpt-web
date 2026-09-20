import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { InstrumentAlias } from "@/lib/instruments";
import type { BrokerSyncCandidate } from "@/lib/brokerage/sync-candidate";
import { retrieveBrokerUserSecret, storeBrokerUserSecret } from "@/lib/brokerage/secret-store";
import { createSnapTradeClient, type SnapTradeClient } from "./client";
import { normalizeSnapTradeAccount, snapTradeProviderUserId } from "./normalize";

export async function registerSnapTradeUser(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
  sdk: SnapTradeClient = createSnapTradeClient(),
) {
  const providerUserId = snapTradeProviderUserId(input.userId);
  const response = await sdk.authentication.registerSnapTradeUser({ userId: providerUserId });
  if (response.data.userId !== providerUserId || !response.data.userSecret) {
    throw new Error("SnapTrade registration response invalid");
  }
  await storeBrokerUserSecret(admin, { ...input, providerUserId, userSecret: response.data.userSecret });
  return { providerUserId };
}

export async function createReadOnlySnapTradePortalLink(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string; customRedirect: string; reconnect?: string },
  sdk: SnapTradeClient = createSnapTradeClient(),
) {
  const credential = await retrieveBrokerUserSecret(admin, input);
  const response = await sdk.authentication.loginSnapTradeUser({
    userId: credential.providerUserId,
    userSecret: credential.userSecret,
    connectionType: "read",
    customRedirect: input.customRedirect,
    reconnect: input.reconnect,
    showCloseButton: true,
  });
  if (!("redirectURI" in response.data) || !response.data.redirectURI) {
    throw new Error("SnapTrade portal link unavailable");
  }
  return response.data.redirectURI;
}

export async function listSnapTradeConnections(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
  sdk: SnapTradeClient = createSnapTradeClient(),
) {
  const credential = await retrieveBrokerUserSecret(admin, input);
  const response = await sdk.connections.listBrokerageAuthorizations({
    userId: credential.providerUserId,
    userSecret: credential.userSecret,
  });
  if (!Array.isArray(response.data)) throw new Error("SnapTrade connections unavailable");
  return response.data;
}

export async function rotateSnapTradeUserSecret(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string },
  sdk: SnapTradeClient = createSnapTradeClient(),
) {
  const credential = await retrieveBrokerUserSecret(admin, input);
  const response = await sdk.authentication.resetSnapTradeUserSecret({
    userId: credential.providerUserId,
    userSecret: credential.userSecret,
  });
  if (response.data.userId !== credential.providerUserId || !response.data.userSecret) {
    throw new Error("SnapTrade credential rotation response invalid");
  }
  await storeBrokerUserSecret(admin, {
    ...input,
    providerUserId: credential.providerUserId,
    userSecret: response.data.userSecret,
  });
  return { providerUserId: credential.providerUserId };
}

const PAGE_SIZE = 1000;
const MAX_ACTIVITY_PAGES_PER_ACCOUNT = 10;

async function fetchAllActivities(sdk: SnapTradeClient, accountId: string, userId: string, userSecret: string) {
  const activities = [];
  for (let page = 0; page < MAX_ACTIVITY_PAGES_PER_ACCOUNT; page += 1) {
    const response = await sdk.accountInformation.getAccountActivities({
      accountId, userId, userSecret, offset: page * PAGE_SIZE, limit: PAGE_SIZE,
    });
    const data = response.data.data;
    const total = response.data.pagination?.total;
    if (!Array.isArray(data) || !Number.isInteger(total) || total! < 0) {
      throw new Error("SnapTrade activity pagination unavailable");
    }
    activities.push(...data);
    if (activities.length >= total!) return activities;
    if (data.length === 0) throw new Error("SnapTrade activity pagination incomplete");
  }
  throw new Error("SnapTrade activity pagination exceeds bounded account window");
}

export async function fetchSnapTradeSyncCandidate(
  admin: SupabaseClient<Database>,
  input: { userId: string; providerId: string; externalConnectionId: string },
  sdk: SnapTradeClient = createSnapTradeClient(),
): Promise<BrokerSyncCandidate> {
  const credential = await retrieveBrokerUserSecret(admin, input);
  const auth = { userId: credential.providerUserId, userSecret: credential.userSecret };
  const connections = (await sdk.connections.listBrokerageAuthorizations(auth)).data;
  if (!Array.isArray(connections)) throw new Error("SnapTrade connections unavailable");
  const connection = connections.find((item) => item.id === input.externalConnectionId);
  if (!connection) throw new Error("SnapTrade connection unavailable");

  const allAccounts = (await sdk.accountInformation.listUserAccounts(auth)).data;
  if (!Array.isArray(allAccounts)) throw new Error("SnapTrade accounts unavailable");
  const accounts = allAccounts.filter((account) => account.brokerage_authorization === input.externalConnectionId);
  if (accounts.length === 0) throw new Error("SnapTrade connection accounts unavailable");
  if (accounts.length > 25) throw new Error("SnapTrade account fan-out exceeds bounded worker window");

  const fetchedAt = new Date().toISOString();
  const sources = [];
  for (const account of accounts) {
    // Endpoint failures are not converted to empty financial facts.
    const positions = (await sdk.accountInformation.getAllAccountPositions({ accountId: account.id, ...auth })).data;
    const balances = (await sdk.accountInformation.getUserAccountBalance({ accountId: account.id, ...auth })).data;
    const activities = await fetchAllActivities(sdk, account.id, auth.userId, auth.userSecret);
    sources.push({ account, connection, positions, balances, activities, activitiesComplete: true });
  }

  const externalIds = [...new Set(sources.flatMap((source) => source.positions.results.map((position) =>
    "id" in position.instrument ? position.instrument.id : null,
  )).filter((id): id is string => Boolean(id)))];
  let aliases: InstrumentAlias[] = [];
  for (let index = 0; index < externalIds.length; index += 200) {
    const { data, error } = await admin.from("instrument_aliases")
      .select("instrument_id,namespace,scope,value,valid_from,valid_to")
      .eq("namespace", "snaptrade.instrument")
      .in("value", externalIds.slice(index, index + 200));
    if (error) throw new Error("Instrument alias loading failed");
    aliases = aliases.concat((data ?? []).map((row) => ({
      instrumentId: row.instrument_id,
      namespace: row.namespace,
      scope: row.scope,
      value: row.value,
      validFrom: row.valid_from,
      validTo: row.valid_to,
    })));
  }

  return {
    fetchedAt,
    providerFreshnessAt: new Date(Math.min(...sources.map((source) => Date.parse(source.positions.data_freshness.as_of)))).toISOString(),
    accounts: sources.map((source) => normalizeSnapTradeAccount(source, aliases, fetchedAt)),
  };
}
