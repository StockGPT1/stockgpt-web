export type MarketMover = {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  score: string;
  rankLabel: string;
  rankTone: "up" | "down" | "flat" | "none";
  rankTitle: string;
  actualRankLabel?: string;
  dailyMoveLabel: string;
  dailyMoveTone: "positive" | "negative" | "neutral";
};

export type TopMoversSnapshot = {
  movers: MarketMover[];
  checkedAt: number;
};

type FetchMovers = (
  url: string,
  options: RequestInit,
) => Promise<Pick<Response, "ok" | "json">>;

function publicMover(item: unknown): MarketMover {
  if (!item || typeof item !== "object") throw new Error("Invalid market mover");
  const value = item as Record<string, unknown>;
  const strings = ["ticker", "company", "sector", "price", "score", "rankLabel", "rankTitle", "dailyMoveLabel"];
  if (strings.some((field) => typeof value[field] !== "string") ||
      !["up", "down", "flat", "none"].includes(String(value.rankTone)) ||
      !["positive", "negative", "neutral"].includes(String(value.dailyMoveTone))) {
    throw new Error("Invalid market mover");
  }

  // Cache only the public market fields consumed by the movers UI.
  return {
    ticker: value.ticker as string,
    company: value.company as string,
    sector: value.sector as string,
    price: value.price as string,
    score: value.score as string,
    rankLabel: value.rankLabel as string,
    rankTone: value.rankTone as MarketMover["rankTone"],
    rankTitle: value.rankTitle as string,
    ...(typeof value.actualRankLabel === "string" ? { actualRankLabel: value.actualRankLabel } : {}),
    dailyMoveLabel: value.dailyMoveLabel as string,
    dailyMoveTone: value.dailyMoveTone as MarketMover["dailyMoveTone"],
  };
}

export function createTopMoversClient({
  fetcher = (url, options) => fetch(url, options),
  now = Date.now,
  ttlMs = 60_000,
}: {
  fetcher?: FetchMovers;
  now?: () => number;
  ttlMs?: number;
} = {}) {
  let snapshot: TopMoversSnapshot | null = null;
  let pending: Promise<TopMoversSnapshot> | null = null;

  function load() {
    const age = snapshot ? now() - snapshot.checkedAt : Infinity;
    if (snapshot && age >= 0 && age < ttlMs) return Promise.resolve(snapshot);
    if (pending) return pending;

    pending = (async () => {
      const response = await fetcher("/api/top-movers?period=1d", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Market movers unavailable");
      const payload = await response.json() as { movers?: unknown[] } | null;
      if (!Array.isArray(payload?.movers)) throw new Error("Invalid market movers response");
      const next = { movers: payload.movers.map(publicMover), checkedAt: now() };
      snapshot = next;
      return next;
    })().finally(() => { pending = null; });
    return pending;
  }

  // A previous successful result stays available while an expired one refreshes.
  return { peek: () => snapshot, load };
}

// Document-local memory survives dashboard remounts, with no persistent storage.
export const topMoversClient = createTopMoversClient();
