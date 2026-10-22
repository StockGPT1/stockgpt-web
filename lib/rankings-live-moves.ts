export type RankingLiveQuote = { changePct: number | null; currentPrice: number | null };
export type RankingLiveQuotes = Record<string, RankingLiveQuote>;

export function rankingQuoteTickers(values: string[], limit = 50) {
  return [...new Set(values.map(value => value.trim().toUpperCase()).filter(value => /^[A-Z0-9][A-Z0-9.=-]{0,14}$/.test(value)))].slice(0, limit);
}

export function parseRankingLiveQuotes(value: unknown, tickers: string[]): RankingLiveQuotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const quotes: RankingLiveQuotes = {};
  for (const ticker of rankingQuoteTickers(tickers)) {
    const entry = (value as Record<string, unknown>)[ticker];
    if (!entry || typeof entry !== "object") continue;
    const quote = entry as Record<string, unknown>;
    quotes[ticker] = {
      changePct: typeof quote.changePct === "number" && Number.isFinite(quote.changePct) ? quote.changePct : null,
      currentPrice: typeof quote.currentPrice === "number" && Number.isFinite(quote.currentPrice) && quote.currentPrice > 0 ? quote.currentPrice : null,
    };
  }
  return quotes;
}

export function resolveRankingLiveQuote(ticker: string | null, storedPrice: unknown, storedMove: number | null | undefined, quotes: RankingLiveQuotes) {
  const live = quotes[ticker?.toUpperCase() ?? ""];
  const price = Number(storedPrice);
  return {
    price: Number.isFinite(price) && price > 0 ? price : live?.currentPrice ?? null,
    dailyMove: live?.changePct ?? (typeof storedMove === "number" && Number.isFinite(storedMove) ? storedMove : null),
  };
}

// Only an explicit day-move filter needs quotes before deciding which rows
// belong in the result. Normal rankings render stored prices/scores first.
export async function rankingMovesForFilter<T>(tickers: string[], filter: string, fetchMoves: (tickers: string[]) => Promise<Map<string, T>>): Promise<Map<string, T>> {
  return !filter || filter === "all" ? new Map() : fetchMoves(tickers);
}
