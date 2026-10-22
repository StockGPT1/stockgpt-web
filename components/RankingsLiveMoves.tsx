"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LazyWhyRankDetails } from "@/components/LazyWhyRankDetails";
import { parseRankingLiveQuotes, rankingQuoteTickers, resolveRankingLiveQuote, type RankingLiveQuotes } from "@/lib/rankings-live-moves";
import type { StableRankingRow } from "@/lib/stable-rankings";

const LiveMoves = createContext<{ quotes: RankingLiveQuotes; request: (tickers: string[]) => void }>({ quotes: {}, request: () => {} });

export function RankingsLiveMoves({ tickers, enabled, children }: { tickers: string[]; enabled: boolean; children: ReactNode }) {
  const [quotes, setQuotes] = useState<RankingLiveQuotes>({});
  const requested = useRef(new Set<string>());
  const requests = useRef(new Set<AbortController>());
  const request = useCallback((values: string[]) => {
    if (!enabled) return;
    const pending = rankingQuoteTickers(values).filter(ticker => !requested.current.has(ticker));
    if (!pending.length) return;
    pending.forEach(ticker => requested.current.add(ticker));
    const controller = new AbortController();
    requests.current.add(controller);
    void fetch(`/api/rankings/live-moves?tickers=${encodeURIComponent(pending.join(","))}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async response => {
        if (!response.ok) return;
        const payload = await response.json() as { quotes?: unknown };
        if (controller.signal.aborted) return;
        const fresh = parseRankingLiveQuotes(payload.quotes, pending);
        setQuotes(current => ({ ...current, ...fresh }));
      })
      .catch(() => { /* Missing live quotes leave the stored rows usable. */ })
      .finally(() => requests.current.delete(controller));
  }, [enabled]);
  const encodedTickers = JSON.stringify(tickers);
  useEffect(() => { request(JSON.parse(encodedTickers) as string[]); }, [encodedTickers, request]);
  useEffect(() => {
    const active = requests.current;
    const sent = requested.current;
    return () => { active.forEach(controller => controller.abort()); active.clear(); sent.clear(); };
  }, []);
  const value = useMemo(() => ({ quotes, request }), [quotes, request]);
  return <LiveMoves.Provider value={value}>{children}</LiveMoves.Provider>;
}

export function useRankingsLiveMoves() { return useContext(LiveMoves); }

export function RankingDailyMove({ ticker, initialMove }: { ticker: string | null; initialMove?: number | null }) {
  const { quotes } = useRankingsLiveMoves();
  const value = resolveRankingLiveQuote(ticker, null, initialMove, quotes).dailyMove;
  return <span title="1D price move" className={`inline-block shrink-0 text-[10px] font-black tabular-nums ${value == null ? "text-[#072116]/35" : value >= 0 ? "text-emerald-700" : "text-red-700"}`}>{value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}</span>;
}

export function RankingPrice({ ticker, storedPrice }: { ticker: string | null; storedPrice: StableRankingRow["price"] }) {
  const { quotes } = useRankingsLiveMoves();
  const price = Number(resolveRankingLiveQuote(ticker, storedPrice, null, quotes).price);
  return <>{Number.isFinite(price) && price > 0 ? `$${price.toFixed(2)}` : "—"}</>;
}

export function RankingWhy({ stock, initialMove }: { stock: StableRankingRow; initialMove?: number | null }) {
  const { quotes } = useRankingsLiveMoves();
  const { price, dailyMove } = resolveRankingLiveQuote(stock.ticker, stock.price, initialMove, quotes);
  return <LazyWhyRankDetails stock={{ ...stock, price }} dailyMove={dailyMove} />;
}
