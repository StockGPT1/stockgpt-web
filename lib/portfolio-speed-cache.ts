import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";
import { getJsonCache, rememberJson, setJsonCache } from "@/lib/redis-cache";
import { isRedisConfigured, redisCommand } from "@/lib/redis";
import { createAdminClient } from "@/utils/supabase/admin";

const PORTFOLIO_SNAPSHOT_TTL_MS = Number(
  process.env.PORTFOLIO_SNAPSHOT_TTL_MS ?? 15 * 60 * 1000,
);
const PORTFOLIO_SNAPSHOT_TTL_SECONDS = Math.max(
  30,
  Math.round(PORTFOLIO_SNAPSHOT_TTL_MS / 1000),
);
const PORTFOLIO_SHARED_CACHE_TTL_SECONDS = Number(
  process.env.PORTFOLIO_SHARED_CACHE_TTL_SECONDS ?? 10 * 60,
);
const PORTFOLIO_STALE_SNAPSHOT_MAX_AGE_MS = Number(
  process.env.PORTFOLIO_STALE_SNAPSHOT_MAX_AGE_MS ?? 24 * 60 * 60 * 1000,
);
const PORTFOLIO_STALE_SNAPSHOT_TTL_SECONDS = Math.max(
  60,
  Math.round(PORTFOLIO_STALE_SNAPSHOT_MAX_AGE_MS / 1000),
);
const PORTFOLIO_REFRESH_LOCK_TTL_SECONDS = Number(
  process.env.PORTFOLIO_REFRESH_LOCK_TTL_SECONDS ?? 90,
);

export type PortfolioSnapshotPayload = {
  enriched: unknown;
  summary: unknown;
  chartData: unknown;
  chartMeta?: unknown;
  portfolioNews: unknown;
};

type SnapshotRow = {
  portfolio_id: string;
  owner_id: string;
  input_hash: string;
  snapshot: PortfolioSnapshotPayload;
  updated_at: string | null;
};

type PortfolioSnapshotCacheEntry = SnapshotRow;

export type PortfolioPageSnapshotLookup = {
  snapshot: PortfolioSnapshotPayload | null;
  mode: "exact" | "stale" | "miss";
  inputHashMatched: boolean;
  updatedAt: string | null;
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

function latestPortfolioSnapshotKey({
  ownerId,
  portfolioId,
}: {
  ownerId: string;
  portfolioId: string;
}) {
  return `portfolio:snapshot:latest:${ownerId}:${portfolioId}`;
}

function portfolioSnapshotRefreshLockKey({
  ownerId,
  portfolioId,
}: {
  ownerId: string;
  portfolioId: string;
}) {
  return `portfolio:snapshot:refresh-lock:${ownerId}:${portfolioId}`;
}

export function hashPortfolioInputs(input: unknown) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

export async function getExactPortfolioPageSnapshot({
  portfolioId,
  ownerId,
  inputHash,
}: {
  portfolioId: string;
  ownerId: string;
  inputHash: string;
}): Promise<{ snapshot: PortfolioSnapshotPayload; updatedAt: string | null } | null> {
  const redisKey = portfolioSnapshotKey({ ownerId, portfolioId, inputHash });
  const redisSnapshot = await getJsonCache<PortfolioSnapshotPayload>(redisKey);
  if (redisSnapshot) return { snapshot: redisSnapshot, updatedAt: null };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("portfolio_page_snapshots")
      .select("portfolio_id,owner_id,input_hash,snapshot,updated_at")
      .eq("portfolio_id", portfolioId)
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as SnapshotRow;
    if (row.input_hash !== inputHash) return null;
    if (!isFresh(row.updated_at, PORTFOLIO_SNAPSHOT_TTL_MS)) return null;

    void setJsonCache(redisKey, row.snapshot, PORTFOLIO_SNAPSHOT_TTL_SECONDS);
    void setJsonCache(
      latestPortfolioSnapshotKey({ ownerId, portfolioId }),
      row,
      PORTFOLIO_STALE_SNAPSHOT_TTL_SECONDS,
    );
    return { snapshot: row.snapshot, updatedAt: row.updated_at };
  } catch (err) {
    console.warn("Portfolio snapshot read failed", err);
    return null;
  }
}

export async function getLatestPortfolioPageSnapshot({
  portfolioId,
  ownerId,
  maxAgeMs = PORTFOLIO_STALE_SNAPSHOT_MAX_AGE_MS,
}: {
  portfolioId: string;
  ownerId: string;
  maxAgeMs?: number;
}): Promise<PortfolioSnapshotCacheEntry | null> {
  const latestKey = latestPortfolioSnapshotKey({ ownerId, portfolioId });
  const redisEntry = await getJsonCache<PortfolioSnapshotCacheEntry>(latestKey);
  if (
    redisEntry?.portfolio_id === portfolioId &&
    redisEntry.owner_id === ownerId &&
    isFresh(redisEntry.updated_at, maxAgeMs)
  ) {
    return redisEntry;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("portfolio_page_snapshots")
      .select("portfolio_id,owner_id,input_hash,snapshot,updated_at")
      .eq("portfolio_id", portfolioId)
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as SnapshotRow;
    if (!isFresh(row.updated_at, maxAgeMs)) return null;

    void setJsonCache(latestKey, row, PORTFOLIO_STALE_SNAPSHOT_TTL_SECONDS);
    return row;
  } catch (err) {
    console.warn("Portfolio latest snapshot read failed", err);
    return null;
  }
}

export async function getPortfolioPageSnapshotWithFallback({
  portfolioId,
  ownerId,
  inputHash,
}: {
  portfolioId: string;
  ownerId: string;
  inputHash: string;
}): Promise<PortfolioPageSnapshotLookup> {
  const exact = await getExactPortfolioPageSnapshot({ portfolioId, ownerId, inputHash });
  if (exact) {
    return {
      snapshot: exact.snapshot,
      mode: "exact",
      inputHashMatched: true,
      updatedAt: exact.updatedAt,
    };
  }

  const latest = await getLatestPortfolioPageSnapshot({ portfolioId, ownerId });
  if (latest) {
    return {
      snapshot: latest.snapshot,
      mode: "stale",
      inputHashMatched: latest.input_hash === inputHash,
      updatedAt: latest.updated_at,
    };
  }

  return { snapshot: null, mode: "miss", inputHashMatched: false, updatedAt: null };
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
  return (await getExactPortfolioPageSnapshot({ portfolioId, ownerId, inputHash }))?.snapshot ?? null;
}

export async function tryStartPortfolioPageSnapshotRefresh({
  portfolioId,
  ownerId,
}: {
  portfolioId: string;
  ownerId: string;
}) {
  if (!isRedisConfigured()) return true;

  const result = await redisCommand<string>([
    "SET",
    portfolioSnapshotRefreshLockKey({ ownerId, portfolioId }),
    String(Date.now()),
    "NX",
    "EX",
    Math.max(1, Math.round(PORTFOLIO_REFRESH_LOCK_TTL_SECONDS)),
  ]);

  return result === "OK";
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
  const latestKey = latestPortfolioSnapshotKey({ ownerId, portfolioId });
  const updatedAt = new Date().toISOString();
  const latestEntry: PortfolioSnapshotCacheEntry = {
    portfolio_id: portfolioId,
    owner_id: ownerId,
    input_hash: inputHash,
    snapshot,
    updated_at: updatedAt,
  };
  const redisWrite = setJsonCache(redisKey, snapshot, PORTFOLIO_SNAPSHOT_TTL_SECONDS);
  const latestRedisWrite = setJsonCache(
    latestKey,
    latestEntry,
    PORTFOLIO_STALE_SNAPSHOT_TTL_SECONDS,
  );
  const supabaseWrite = (async () => {
    try {
      const supabase = createAdminClient();
      await supabase.from("portfolio_page_snapshots").upsert(
        {
          portfolio_id: portfolioId,
          owner_id: ownerId,
          input_hash: inputHash,
          snapshot,
          updated_at: updatedAt,
        },
        { onConflict: "portfolio_id" },
      );
    } catch (err) {
      console.warn("Portfolio snapshot write failed", err);
    }
  })();

  await Promise.allSettled([redisWrite, latestRedisWrite, supabaseWrite]);
}

export async function invalidatePortfolioPageSnapshot({
  portfolioId,
  ownerId,
}: {
  portfolioId: string;
  ownerId: string;
}) {
  const latestKey = latestPortfolioSnapshotKey({ ownerId, portfolioId });
  const redisDelete = redisCommand<number>(["DEL", latestKey]);
  const supabaseDelete = (async () => {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("portfolio_page_snapshots")
        .delete()
        .eq("portfolio_id", portfolioId)
        .eq("owner_id", ownerId);

      if (error) console.warn("Portfolio page snapshot invalidation failed", error.message ?? error);
    } catch (err) {
      console.warn("Portfolio page snapshot invalidation failed", err);
    }
  })();

  await Promise.allSettled([redisDelete, supabaseDelete]);
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
      const compactMarks = marks.map((mark) => `${mark.label}:${mark.ms}`).join(",");
      const compactExtra = Object.entries(extra)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(",");
      console.info(`[perf:${label}] totalMs=${totalMs} marks=${compactMarks} ${compactExtra}`);
    },
  };
}
