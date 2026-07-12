"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StockLogo } from "@/components/StockLogo";
import { LazyWhyRankDetails } from "@/components/LazyWhyRankDetails";
import {
  getModelConfidence,
  matchesConfidenceFilter,
  matchesPriceMoveFilter,
} from "@/lib/research-explainability";
import type { StableRankingRow } from "@/lib/stable-rankings";

export type MobileRankingItem = StableRankingRow & { dailyMove: number | null };

type Filters = {
  q: string;
  sector: string;
  move: string;
  score: string;
  priceMove: string;
  confidence: string;
};

function moveMatches(row: StableRankingRow, filter: string) {
  if (!filter || filter === "all") return true;
  const rank = Number(row.rank);
  const previous = Number(row.previous_rank);
  if (!Number.isFinite(previous) || !Number.isFinite(rank)) return filter === "none";
  if (filter === "up") return rank < previous;
  if (filter === "down") return rank > previous;
  return filter === "flat" ? rank === previous : true;
}

function score(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number).toLocaleString() : "—";
}

function price(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : "Unavailable";
}

export function RankingsMobileBatchList({
  initialItems,
  initialPage,
  totalPages,
  filters,
  locked,
}: {
  initialItems: MobileRankingItem[];
  initialPage: number;
  totalPages: number;
  filters: Filters;
  locked: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadNext() {
    if (isPending || page >= totalPages) return;
    startTransition(async () => {
      setError(null);
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: String(nextPage), q: filters.q, sector: filters.sector, score: filters.score });
      try {
        const response = await fetch(`/api/rankings/page?${params.toString()}`, { headers: { Accept: "application/json" } });
        const payload = await response.json().catch(() => null) as { rows?: StableRankingRow[]; dailyMoves?: Record<string, number | null> } | null;
        if (!response.ok) throw new Error("Could not load the next rankings batch.");
        const nextRows = (payload?.rows ?? [])
          .map((row) => ({ ...row, dailyMove: payload?.dailyMoves?.[row.ticker ?? ""] ?? null }))
          .filter((row) => moveMatches(row, filters.move) && matchesPriceMoveFilter(row.dailyMove, filters.priceMove) && matchesConfidenceFilter(row, filters.confidence));
        setItems((current) => [...current, ...nextRows.filter((row) => !current.some((item) => item.id === row.id))]);
        setPage(nextPage);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load the next rankings batch.");
      }
    });
  }

  if (items.length === 0) return <div className="rounded-2xl bg-[#faf6f0] px-4 py-10 text-center text-[13px] font-bold text-[#072116]/55">No stocks match these filters in the current batch. Reset filters or load the next batch.</div>;

  return <div className="overflow-hidden rounded-2xl border border-[#ddb159]/14 bg-[#0a2a1d]">
    {items.map((stock) => {
      const confidence = getModelConfidence(stock);
      return <article key={stock.id} className="border-b border-[#ddb159]/10 p-3 last:border-b-0">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-[#ddb159] text-[11px] font-black text-[#061b12]">{stock.rank ?? "—"}</span>
          <Link href={`/stock/${stock.ticker}`} className="flex min-w-0 items-center gap-2"><StockLogo ticker={stock.ticker} company={stock.company} size={34} /><span className="min-w-0"><span className="block truncate text-[14px] font-black text-[#faf6f0]">{stock.ticker}</span><span className="block truncate text-[10px] font-semibold text-[#faf6f0]/45">{stock.company}</span></span></Link>
          <span className="rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black text-[#061b12]">{score(stock.score)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#faf6f0]/52"><span>{stock.dailyMove == null ? "1D unavailable" : `${stock.dailyMove >= 0 ? "+" : ""}${stock.dailyMove.toFixed(1)}%`}</span><span>·</span><span>{price(stock.price)}</span><span>·</span><span>{confidence.label} confidence</span>{stock.sector && <><span>·</span><span className="truncate">{stock.sector}</span></>}</div>
        <div className="mt-2 flex justify-end"><LazyWhyRankDetails stock={stock} dailyMove={stock.dailyMove} light /></div>
      </article>;
    })}
    {!locked && page < totalPages && <div className="p-3"><button type="button" onClick={loadNext} disabled={isPending} className="h-12 w-full rounded-2xl bg-[#ddb159] text-[11px] font-black text-[#061b12] disabled:opacity-50">{isPending ? "Loading next 50…" : "Load next 50"}</button>{error && <p className="mt-2 text-center text-[11px] font-semibold text-[#e7c56c]">{error}</p>}<p className="mt-2 text-center text-[9px] font-semibold text-[#faf6f0]/38">Loaded through page {page} of {totalPages}</p></div>}
  </div>;
}
