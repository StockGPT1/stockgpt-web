import type {
  Account,
  AccountPosition,
  AccountUniversalActivity,
  Balance,
  BrokerageAuthorization,
  AllAccountPositionsResponse,
} from "snaptrade-typescript-sdk";
import { brokerActivityFingerprint } from "@/lib/brokerage/activity-fingerprint";
import type {
  BrokerAccountSyncCandidate,
  BrokerActivityCandidate,
  BrokerCandidateAvailability,
  BrokerPositionCandidate,
} from "@/lib/brokerage/sync-candidate";
import { resolveInstrumentAlias, type InstrumentAlias } from "@/lib/instruments";

const iso = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const finite = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const currency = (value: string | null | undefined) => value && /^[A-Z]{3}$/u.test(value.toUpperCase()) ? value.toUpperCase() : null;
const evidence = (value: string | null | undefined) => value?.trim() || null;

export function snapTradeProviderUserId(stockgptUserId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(stockgptUserId)) {
    throw new Error("Invalid StockGPT user identity");
  }
  return `stockgpt-${stockgptUserId.toLowerCase()}`;
}

export type SnapTradeAccountSource = {
  account: Account;
  connection: BrokerageAuthorization;
  positions: AllAccountPositionsResponse | null;
  balances: Balance[] | null;
  activities: AccountUniversalActivity[] | null;
  activitiesComplete: boolean;
};

function resolve(id: string | null, scope: string | null, aliases: InstrumentAlias[], asOf: string) {
  if (!id) return null;
  return resolveInstrumentAlias(aliases, {
    namespace: "snaptrade.instrument",
    scope: scope ?? "",
    value: id,
    asOf,
  });
}

export function normalizeSnapTradeAccount(
  source: SnapTradeAccountSource,
  aliases: InstrumentAlias[],
  fetchedAt: string,
): BrokerAccountSyncCandidate {
  const { account, connection } = source;
  const holdings = account.sync_status?.holdings;
  const unavailable = connection.disabled === true || holdings?.holdings_unavailable === true;
  const initialIncomplete = holdings?.initial_sync_completed !== true;
  const positionsState: BrokerCandidateAvailability = unavailable ? "unavailable" : initialIncomplete ? "incomplete" :
    source.positions && Array.isArray(source.positions.results) && iso(source.positions.data_freshness?.as_of) ? "complete" : "unavailable";
  const balancesState: BrokerCandidateAvailability = unavailable ? "unavailable" : initialIncomplete ? "incomplete" :
    Array.isArray(source.balances) ? "complete" : "unavailable";
  const asOf = iso(source.positions?.data_freshness?.as_of) ?? iso(holdings?.last_successful_sync) ?? fetchedAt;
  const positionItems: BrokerPositionCandidate[] = positionsState === "complete"
    ? source.positions!.results.map((position: AccountPosition, index) => {
        const instrument = position.instrument;
        const externalInstrumentId = "id" in instrument ? evidence(instrument.id) : null;
        const symbol = "symbol" in instrument ? evidence(instrument.symbol) : null;
        const description = "description" in instrument ? evidence(instrument.description) : null;
        const instrumentCurrency = "currency" in instrument ? currency(instrument.currency) : null;
        const price = finite(position.price);
        const quantity = finite(position.units);
        const priceCurrency = currency(position.currency) ?? instrumentCurrency;
        return {
          positionKey: externalInstrumentId ? `instrument:${externalInstrumentId}` : `symbol:${instrument.kind}:${symbol ?? index}`,
          externalPositionId: null,
          externalInstrumentId,
          instrumentId: resolve(externalInstrumentId, "", aliases, asOf),
          symbol,
          description,
          assetType: instrument.kind,
          quantity: quantity ?? Number.NaN,
          price: price !== null && price > 0 ? price : null,
          priceCurrency,
          marketValue: null,
          marketValueCurrency: null,
          asOf,
        };
      })
    : [];

  const balanceItems = balancesState === "complete"
    ? source.balances!.filter((balance) => finite(balance.cash) !== null && currency(balance.currency?.code)).map((balance) => ({
        currency: currency(balance.currency?.code)!,
        amount: finite(balance.cash)!,
        asOf: iso(holdings?.last_successful_sync) ?? fetchedAt,
      }))
    : [];
  if (balancesState === "complete" && source.balances!.some((balance) => finite(balance.cash) === null || !currency(balance.currency?.code))) {
    throw new Error("SnapTrade balance facts unavailable");
  }

  const activitiesState: BrokerCandidateAvailability = source.activities === null ? "unavailable" : source.activitiesComplete ? "complete" : "incomplete";
  const activities: BrokerActivityCandidate[] = source.activities?.map((activity) => {
    const externalInstrumentId = evidence(activity.symbol?.id ?? activity.option_symbol?.id);
    const activityCurrency = currency(activity.currency?.code);
    const occurredAt = iso(activity.trade_date);
    const quantity = finite(activity.units);
    const price = finite(activity.price);
    const amount = finite(activity.amount);
    const activityType = evidence(activity.type)?.toLowerCase() ?? "unknown";
    const externalActivityId = evidence(activity.id);
    return {
      externalActivityId,
      fingerprint: brokerActivityFingerprint({
        providerKey: "snaptrade",
        externalAccountId: account.id,
        externalActivityId,
        activityType,
        occurredAt,
        externalInstrumentId,
        quantity: quantity?.toString(),
        price: price?.toString(),
        grossAmount: amount?.toString(),
        netAmount: amount?.toString(),
        currency: activityCurrency,
      }),
      fingerprintVersion: "sha256-v1",
      instrumentId: resolve(externalInstrumentId, "", aliases, occurredAt ?? fetchedAt),
      activityType,
      occurredAt,
      quantity,
      price: price !== null && price > 0 ? price : null,
      grossAmount: amount,
      netAmount: amount,
      currency: activityCurrency,
      description: evidence(activity.description),
    };
  }) ?? [];

  return {
    externalAccountId: account.id,
    externalInstitutionId: evidence(connection.brokerage?.id),
    institutionName: evidence(account.institution_name ?? connection.brokerage?.name),
    name: evidence(account.name) ?? `Broker account ${account.id.slice(0, 8)}`,
    accountType: evidence(account.raw_type ?? account.account_category),
    baseCurrency: currency(account.balance?.total?.currency),
    status: account.status === "closed" || account.status === "archived" ? "closed" :
      account.status === "unavailable" || unavailable ? "inaccessible" : "active",
    positions: { state: positionsState, items: positionItems },
    balances: { state: balancesState, items: balanceItems },
    activities: { state: activitiesState, items: activities },
  };
}
