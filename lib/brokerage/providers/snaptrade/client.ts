import "server-only";

import { Snaptrade, SnaptradeAuth } from "snaptrade-typescript-sdk";

export function createSnapTradeClient() {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId || !consumerKey) throw new Error("SnapTrade sandbox configuration unavailable");
  return new Snaptrade({ auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }) });
}

export type SnapTradeClient = ReturnType<typeof createSnapTradeClient>;
