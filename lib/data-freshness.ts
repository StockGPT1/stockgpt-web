export const DATA_FRESHNESS_STALE_HOURS = 12;

export type FreshnessStatus = "fresh" | "stale" | "unknown";

export type FreshnessRecord = {
  label: string;
  table: string;
  column: string;
  latestAt: string | null;
  ageHours: number | null;
  status: FreshnessStatus;
};

export type DataFreshnessSummary = {
  generatedAt: string;
  staleAfterHours: number;
  rankings: FreshnessRecord;
  prices: FreshnessRecord;
  news: FreshnessRecord;
  hasStaleData: boolean;
  hasUnknownData: boolean;
};

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message?: string } | null;
};

type LimitBuilder = {
  limit: (count: number) => Promise<QueryResult>;
};

type OrderBuilder = {
  order: (
    column: string,
    options: { ascending: boolean; nullsFirst?: boolean },
  ) => LimitBuilder;
};

type SelectBuilder = {
  select: (columns: string) => OrderBuilder;
};

type FreshnessClient = {
  from: (table: string) => SelectBuilder;
};

function hoursSince(value: string | null, now: Date) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return null;

  return Math.max(0, (now.getTime() - timestamp) / 36e5);
}

function statusFor(latestAt: string | null, now: Date): FreshnessStatus {
  const ageHours = hoursSince(latestAt, now);

  if (ageHours == null) return "unknown";
  if (ageHours > DATA_FRESHNESS_STALE_HOURS) return "stale";
  return "fresh";
}

async function getLatestTimestamp(
  client: FreshnessClient,
  table: string,
  column: string,
) {
  const { data, error } = await client
    .from(table)
    .select(column)
    .order(column, { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    console.warn(`[data-freshness] Could not read ${table}.${column}`, error);
    return null;
  }

  const value = data?.[0]?.[column];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function makeRecord({
  label,
  table,
  column,
  latestAt,
  now,
}: {
  label: string;
  table: string;
  column: string;
  latestAt: string | null;
  now: Date;
}): FreshnessRecord {
  return {
    label,
    table,
    column,
    latestAt,
    ageHours: hoursSince(latestAt, now),
    status: statusFor(latestAt, now),
  };
}

export async function getDataFreshness(
  client: unknown,
): Promise<DataFreshnessSummary> {
  const supabase = client as FreshnessClient;
  const now = new Date();

  const [rankingTimestamp, priceTimestamp, latestNewsTimestamp] =
    await Promise.all([
      getLatestTimestamp(supabase, "stock_rankings", "last_ranking_update"),
      getLatestTimestamp(supabase, "stock_rankings", "last_price_update"),
      getLatestTimestamp(supabase, "news_articles", "created_at"),
    ]);

  const fallbackRankingTimestamp =
    rankingTimestamp ??
    (await getLatestTimestamp(supabase, "stock_rankings", "updated_at"));

  const rankings = makeRecord({
    label: "Rankings",
    table: "stock_rankings",
    column: rankingTimestamp ? "last_ranking_update" : "updated_at",
    latestAt: fallbackRankingTimestamp,
    now,
  });

  const prices = makeRecord({
    label: "Prices",
    table: "stock_rankings",
    column: "last_price_update",
    latestAt: priceTimestamp,
    now,
  });

  const news = makeRecord({
    label: "News",
    table: "news_articles",
    column: "created_at",
    latestAt: latestNewsTimestamp,
    now,
  });

  const records = [rankings, prices, news];

  return {
    generatedAt: now.toISOString(),
    staleAfterHours: DATA_FRESHNESS_STALE_HOURS,
    rankings,
    prices,
    news,
    hasStaleData: records.some((record) => record.status === "stale"),
    hasUnknownData: records.some((record) => record.status === "unknown"),
  };
}

export function getStaleFreshnessItems(summary: DataFreshnessSummary) {
  return [summary.rankings, summary.prices, summary.news].filter(
    (record) => record.status === "stale" || record.status === "unknown",
  );
}

export function formatFreshnessDate(value: string | null) {
  if (!value) return "Awaiting refresh";

  const timestamp = new Date(value);

  if (!Number.isFinite(timestamp.getTime())) return "Awaiting refresh";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function formatFreshnessAge(record: FreshnessRecord) {
  if (record.ageHours == null) return "not available";

  if (record.ageHours < 1) return "under 1h ago";
  if (record.ageHours < 24) return `${Math.round(record.ageHours)}h ago`;

  const days = Math.floor(record.ageHours / 24);
  return `${days}d ago`;
}