import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getUsdFxQuote } from "@/lib/fx-rates";
import { assessConnectedPortfolioFacts } from "@/lib/connected-portfolio-intelligence-map";
import { deriveBrokerConnectionPresentation } from "@/lib/brokerage/connection-presentation-state";
import { loadConnectedPortfolioHistory } from "@/lib/connected-portfolio-history";
import { loadBrokerPositionAliasesSafely, resolveBrokerPositionIdentities, APPROVED_SANDBOX_FIXTURE_CONTRACTS, APPROVED_SANDBOX_CONNECTIONS, type SandboxFixtureContext } from "@/lib/instruments/broker-position-identity";
export { assessConnectedPortfolioFacts } from "@/lib/connected-portfolio-intelligence-map";
export type { ConnectedPortfolioFacts } from "@/lib/connected-portfolio-intelligence-map";

export async function loadConnectedPortfolioIntelligence(
  supabase: SupabaseClient<Database>, portfolioId: string, asOf: string,
) {
  const portfolio = await supabase.from("user_portfolios")
    .select("id,risk_tolerance,objective,time_horizon,broker_account_id,management_source")
    .eq("id", portfolioId).eq("management_source", "connected").maybeSingle();
  if (portfolio.error || !portfolio.data?.broker_account_id) return null;
  const account = await supabase.from("broker_accounts")
    .select("id,user_id,name,status,base_currency,last_successful_sync_at,connection_id")
    .eq("id", portfolio.data.broker_account_id).maybeSingle();
  if (account.error || !account.data) return null;
  const [connection, latestSyncJob, positions, cash, universe] = await Promise.all([
    supabase.from("broker_connections").select("id,user_id,provider_id,institution_id,external_connection_id,status,last_successful_sync_at,broker_providers(provider_key)").eq("id", account.data.connection_id).single(),
    supabase.from("broker_sync_jobs").select("status").eq("connection_id", account.data.connection_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("broker_positions").select("*").eq("account_id", account.data.id).order("position_key"),
    supabase.from("broker_cash_balances").select("*").eq("account_id", account.data.id).order("currency"),
    supabase.from("stock_rankings").select("rank", { count: "exact", head: true }).not("rank", "is", null),
  ]);
  if (connection.error || latestSyncJob.error || positions.error || cash.error || universe.error || !connection.data) throw new Error("Connected Portfolio facts unavailable");
  const provider = connection.data.broker_providers?.provider_key;
  if (!provider) throw new Error("Connected Portfolio identity unavailable");
  const approvals = APPROVED_SANDBOX_CONNECTIONS.filter((approval) => approval.provider === provider
    && approval.connectionId === connection.data.id);
  const fixtureContext: SandboxFixtureContext = {
    optIn: process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX === "true",
    deploymentEnvironment: process.env.VERCEL_ENV, nodeEnvironment: process.env.NODE_ENV,
    connection: null, approvals,
  };
  // Only a reviewed connection can enter the fixture path. A process-wide flag
  // must not change identity handling for unrelated provider connections.
  const fixtureRequested = approvals.length > 0;
  if (approvals.length === 1 && account.data.user_id === connection.data.user_id) {
    const institutionAlias = await supabase.from("brokerage_institution_aliases")
      .select("external_institution_id")
      .eq("provider_id", connection.data.provider_id).eq("institution_id", connection.data.institution_id)
      .eq("external_institution_id", approvals[0].externalInstitutionId).maybeSingle();
    if (!institutionAlias.error && institutionAlias.data) fixtureContext.connection = {
      provider, connectionId: connection.data.id, externalConnectionId: connection.data.external_connection_id,
      institutionId: connection.data.institution_id, externalInstitutionId: institutionAlias.data.external_institution_id,
      userId: connection.data.user_id, accountId: account.data.id,
    };
  }
  const aliasEvidence = fixtureRequested ? { aliases: [], available: true } : await loadBrokerPositionAliasesSafely(provider,
    (positions.data ?? []).flatMap((row) => row.external_instrument_id ? [row.external_instrument_id] : []),
    async (namespace, values, offset, limit) => {
      const response = await supabase.from("instrument_aliases")
        .select("id,instrument_id,namespace,scope,value,valid_from,valid_to", { count: "exact" })
        .eq("namespace", namespace).eq("scope", "").in("value", values)
        .order("id").range(offset, offset + limit - 1);
      if (response.error) throw new Error("Connected Portfolio aliases unavailable");
      return { count: response.count, rows: (response.data ?? []).map((row) => ({ instrumentId: row.instrument_id, namespace: row.namespace, scope: row.scope, value: row.value, validFrom: row.valid_from, validTo: row.valid_to })) };
    });
  const identities = aliasEvidence.available
    ? resolveBrokerPositionIdentities({ positions: positions.data ?? [], provider, aliases: aliasEvidence.aliases,
      environment: fixtureRequested ? "sandbox" : "normal", fixtureContext, fixtureContracts: APPROVED_SANDBOX_FIXTURE_CONTRACTS })
    : Object.fromEntries((positions.data ?? []).map((position) => [position.id, { instrumentId: null, provenance: "unresolved" as const }]));
  if (!aliasEvidence.available) console.warn("Connected Portfolio identity evidence unavailable");
  // Synthetic identities never request customer market rankings/diagnostics.
  const instrumentIds = [...new Set(Object.values(identities).filter((identity) => identity.provenance !== "sandbox_fixture")
    .map((identity) => identity.instrumentId).filter((id): id is string => Boolean(id)))];
  const rankings = instrumentIds.length ? await supabase.from("stock_rankings")
    .select("instrument_id,ticker,score,rank,last_ranking_update").in("instrument_id", instrumentIds) : { data: [], error: null };
  if (rankings.error) throw new Error("Connected Portfolio rankings unavailable");
  const tickers = (rankings.data ?? []).map((row) => row.ticker).filter((ticker): ticker is string => Boolean(ticker));
  const diagnostics = tickers.length ? await supabase.from("stock_factor_diagnostics")
    .select("ticker,current_score,previous_score,updated_at").in("ticker", tickers) : { data: [], error: null };
  if (diagnostics.error) throw new Error("Connected Portfolio diagnostics unavailable");
  const connected = assessConnectedPortfolioFacts({
    portfolio: portfolio.data, account: account.data, connection: connection.data,
    positions: positions.data ?? [], identities, cashBalances: cash.data ?? [], rankings: rankings.data ?? [],
    diagnostics: diagnostics.data ?? [], rankedUniverseSize: universe.count ?? 0,
    fxQuote: await getUsdFxQuote(),
    identityEvidenceUnavailable: !aliasEvidence.available,
  }, asOf);
  const history = await loadConnectedPortfolioHistory(supabase, account.data.id);
  return {
    ...connected,
    history,
    connectionPresentation: deriveBrokerConnectionPresentation({
      lifecycleStatus: connection.data.status,
      latestSyncJobStatus: latestSyncJob.data?.status ?? null,
      lastSuccessfulSyncAt: connection.data.last_successful_sync_at,
    }),
  };
}
