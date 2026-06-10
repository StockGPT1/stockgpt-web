import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";
import { getJsonCache, rememberJson, setJsonCache } from "@/lib/redis-cache";
import { createAdminClient } from "@/utils/supabase/admin";

const PORTFOLIO_SNAPSHOT_TTL_MS = Number(
  process.env.PORTFOLIO_SNAPSHOT_TTL_MS ?? 2 * 60 * 1000,
);
const PORTFOLIO_SNAPSHOT_TTL_SECONDS = Math.max(
  30,
  Math.round(PORTFOLIO_SNAPSHOT_TTL_MS / 1000),
);
const PORTFOLIO_SHARED_CACHE_TTL_SECONDS = Number(
  process.env.PORTFOLIO_SHARED_CACHE_TTL_SECONDS ?? 5 * 60,
);

export type PortfolioSnapshotPayload = {
  enriched: unknown;
  summary: unknown;
  chartData: unknown;
  portfolioNews: unknown;
};

type SnapshotRow = {
  portfolio_id: string;
  owner_id: string;
  input_hash: string;
  snapshot: PortfolioSnapshotPayload;
  updated_at: string | null;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function isFresh(updatedAt: string | null, ttlMs: number) {
  if (!updatedAt) return false;
  const time = new Date(updatedAt).getTime();
  return Number.isFinite(time) && Date.now() - time < ttlMs;
}

function portfolioSnapshotKey({
  ownerId,
  portfolioId,
  inputHash,
}: {
  ownerId: string;
  portfolioId: string;
  inputHash: string;
}) {
  return `portfolio:snapshot:${ownerId}:${portfolioId}:${inputHash}`;
}

export function hashPortfolioInputs(input: unknown) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

export async function getPortfolioPageSnapshot({
  portfolioId,
  ownerId,
  inputHash,
}: {
  portfolioId: string;
  ownerId: string;
  inputHash: string;
}): Promise<PortfolioSnapshotPayload | null> {
  const redisKey = portfolioSnapshotKey({ ownerId, portfolioId, inputHash });
  const redisSnapshot = await getJsonCache<PortfolioSnapshotPayload>(redisKey);
  if (redisSnapshot) return redisSnapshot;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("portfolio_page_snapshots")
      .select("portfolio_id,owner_id,input_hash,snapshot,updated_at")
      .eq("portfolio_id", portfolioId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as SnapshotRow;
    if (row.input_hash !== inputHash) return null;
    if (!isFresh(row.updated_at, PORTFOLIO_SNAPSHOT_TTL_MS)) return null;

    await setJsonCache(redisKey, row.snapshot, PORTFOLIO_SNAPSHOT_TTL_SECONDS);
    return row.snapshot;
  } catch (err) {
    console.warn("Portfolio snapshot read failed", err);
    return null;
  }
}

export async function savePortfolioPageSnapshot({
  portfolioId,
  ownerId,
  inputHash,
  snapshot,
}: {
  portfolioId: string;
  ownerId: string;
  inputHash: string;
  snapshot: PortfolioSnapshotPayload;
}) {
  const redisKey = portfolioSnapshotKey({ ownerId, portfolioId, inputHash });
  await setJsonCache(redisKey, snapshot, PORTFOLIO_SNAPSHOT_TTL_SECONDS);

  try {
    const supabase = createAdminClient();
    await supabase.from("portfolio_page_snapshots").upsert(
      {
        portfolio_id: portfolioId,
        owner_id: ownerId,
        input_hash: inputHash,
        snapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "portfolio_id" },
    );
  } catch (err) {
    console.warn("Portfolio snapshot write failed", err);
  }
}

const getPortfolioStockUniverseFromSupabase = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stock_rankings")
      .select("ticker, company, sector, rank, score, price")
      .order("rank", { ascending: true })
      .limit(500);

    if (error) throw error;
    return data ?? [];
  },
  ["portfolio-stock-universe-v2"],
  { revalidate: 5 * 60 },
);

export async function getCachedPortfolioStockUniverse() {
  return rememberJson({
    key: "portfolio:stock-universe:v2",
    ttlSeconds: PORTFOLIO_SHARED_CACHE_TTL_SECONDS,
    getFresh: getPortfolioStockUniverseFromSupabase,
  });
}

const getPortfolioNewsFromSupabase = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("news_articles")
      .select("id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at")
      .order("published_at", { ascending: false })
      .limit(180);

    if (error) throw error;
    return data ?? [];
  },
  ["portfolio-news-v2"],
  { revalidate: 5 * 60 },
);

export async function getCachedPortfolioNews() {
  return rememberJson({
    key: "portfolio:news:v2",
    ttlSeconds: PORTFOLIO_SHARED_CACHE_TTL_SECONDS,
    getFresh: getPortfolioNewsFromSupabase,
  });
}

export function startPortfolioTimer(label: string) {
  const startedAt = performance.now();
  const marks: Array<{ label: string; ms: number }> = [];

  return {
    mark(step: string) {
      marks.push({ label: step, ms: Math.round(performance.now() - startedAt) });
    },
    end(extra: Record<string, unknown> = {}) {
      const totalMs = Math.round(performance.now() - startedAt);
      console.info(`[perf:${label}]`, { totalMs, marks, ...extra });
    },
  };
}
