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
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : "—";
}

function dailyMove(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function dailyMoveTone(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#faf6f0]/38";
  return value >= 0 ? "text-emerald-400" : "text-red-400";
}

function rankMove(row: StableRankingRow) {
  const rank = Number(row.rank);
  const previous = Number(row.previous_rank);
  if (!Number.isFinite(rank) || !Number.isFinite(previous)) return null;
  const delta = previous - rank;
  if (delta === 0) return { label: "—", tone: "text-[#faf6f0]/36" };
  return delta > 0
    ? { label: `↑${Math.abs(delta)}`, tone: "text-emerald-400" }
    : { label: `↓${Math.abs(delta)}`, tone: "text-red-400" };
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
  const [openWhyKey, setOpenWhyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadNext() {
    if (isPending || page >= totalPages) return;
    startTransition(async () => {
      setError(null);
      const nextPage = page + 1;
      const params = new URLSearchParams({
        page: String(nextPage),
        q: filters.q,
        sector: filters.sector,
        score: filters.score,
      });

      try {
        const response = await fetch(`/api/rankings/page?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as {
          rows?: StableRankingRow[];
          dailyMoves?: Record<string, number | null>;
        } | null;

        if (!response.ok) throw new Error("Could not load the next rankings batch.");

        const nextRows = (payload?.rows ?? [])
          .map((row) => ({
            ...row,
            dailyMove: payload?.dailyMoves?.[row.ticker ?? ""] ?? null,
          }))
          .filter(
            (row) =>
              moveMatches(row, filters.move) &&
              matchesPriceMoveFilter(row.dailyMove, filters.priceMove) &&
              matchesConfidenceFilter(row, filters.confidence),
          );

        setItems((current) => [
          ...current,
          ...nextRows.filter((row) => !current.some((item) => item.id === row.id)),
        ]);
        setPage(nextPage);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load the next rankings batch.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[20px] border border-[#ddb159]/16 bg-[#081f15]/58 px-4 py-9 text-center">
        <p className="text-[13px] font-bold leading-5 text-[#faf6f0]/58">
          No stocks match these filters. Reset them or load another rankings batch.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((stock) => {
        const confidence = getModelConfidence(stock);
        const rowKey = String(stock.id ?? stock.ticker ?? stock.rank ?? "ranking-row");
        const isWhyOpen = openWhyKey === rowKey;
        const movement = rankMove(stock);
        const rankNumber = Number(stock.rank);
        const topRank = Number.isFinite(rankNumber) && rankNumber <= 3;

        return (
          <article
            key={rowKey}
            data-expanded={isWhyOpen ? "true" : "false"}
            className="relative overflow-hidden rounded-[19px] border border-[#ddb159]/13 bg-[linear-gradient(145deg,rgba(11,43,29,0.78),rgba(3,24,15,0.92))] px-3.5 py-3 shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition active:scale-[0.992] data-[expanded=true]:border-[#ddb159]/28"
          >
            <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3">
              <span
                className={[
                  "grid size-9 shrink-0 place-items-center rounded-[12px] text-[12px] font-black tabular-nums",
                  topRank
                    ? "bg-[#ddb159] text-[#061b12] shadow-[0_8px_20px_rgba(221,177,89,0.14)]"
                    : "border border-[#ddb159]/18 bg-[#ddb159]/7 text-[#ddb159]",
                ].join(" ")}
              >
                {stock.rank ?? "—"}
              </span>

              <Link
                href={`/stock/${stock.ticker}`}
                className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
              >
                <StockLogo ticker={stock.ticker} company={stock.company} size={36} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[15px] font-black leading-5 text-[#faf6f0]">
                      {stock.ticker}
                    </span>
                    {movement && (
                      <span className={`shrink-0 text-[9px] font-black tabular-nums ${movement.tone}`}>
                        {movement.label}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[10px] font-semibold leading-4 text-[#faf6f0]/44">
                    {stock.company}
                  </span>
                </span>
              </Link>

              <span className="shrink-0 text-right">
                <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/32">
                  AI score
                </span>
                <span className="mt-0.5 block text-[16px] font-black tabular-nums text-[#ddb159]">
                  {score(stock.score)}
                </span>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_1fr_1.2fr] gap-2 rounded-[14px] border border-[#faf6f0]/6 bg-[#020f09]/28 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[7.5px] font-black uppercase tracking-[0.11em] text-[#faf6f0]/30">1D</span>
                <span className={`mt-0.5 block text-[11px] font-black tabular-nums ${dailyMoveTone(stock.dailyMove)}`}>
                  {dailyMove(stock.dailyMove)}
                </span>
              </span>
              <span className="min-w-0 border-l border-[#faf6f0]/7 pl-2">
                <span className="block text-[7.5px] font-black uppercase tracking-[0.11em] text-[#faf6f0]/30">Price</span>
                <span className="mt-0.5 block truncate text-[11px] font-black tabular-nums text-[#faf6f0]/78">
                  {price(stock.price)}
                </span>
              </span>
              <span className="min-w-0 border-l border-[#faf6f0]/7 pl-2">
                <span className="block text-[7.5px] font-black uppercase tracking-[0.11em] text-[#faf6f0]/30">Confidence</span>
                <span className="mt-0.5 block truncate text-[11px] font-black text-[#faf6f0]/78">
                  {confidence.label}
                </span>
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span className="min-w-0 truncate text-[9.5px] font-semibold text-[#faf6f0]/38">
                {stock.sector || "Sector unavailable"}
              </span>
              <LazyWhyRankDetails
                stock={stock}
                dailyMove={stock.dailyMove}
                variant="inline"
                expanded={isWhyOpen}
                onExpandedChange={(nextOpen) => setOpenWhyKey(nextOpen ? rowKey : null)}
              />
            </div>
          </article>
        );
      })}

      {!locked && page < totalPages && (
        <div className="pt-1">
          <button
            type="button"
            onClick={loadNext}
            disabled={isPending}
            data-native-haptic="medium"
            className="h-12 w-full rounded-[18px] bg-[#ddb159] text-[11px] font-black text-[#061b12] shadow-[0_8px_20px_rgba(221,177,89,0.14)] transition active:scale-[0.99] disabled:opacity-50"
          >
            {isPending ? "Loading next 50…" : "Load next 50"}
          </button>
          {error && (
            <p className="mt-2 text-center text-[11px] font-semibold text-[#e7c56c]">{error}</p>
          )}
          <p className="mt-2 text-center text-[9px] font-semibold text-[#faf6f0]/34">
            Page {page} of {totalPages}
          </p>
        </div>
      )}
    </div>
  );
}
