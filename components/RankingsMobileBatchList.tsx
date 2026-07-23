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

function dailyMove(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "1D unavailable";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

const glassShellClass =
  "relative isolate overflow-hidden rounded-[22px] border border-[#ddb159]/22 bg-[linear-gradient(145deg,rgba(250,246,240,0.058)_0%,rgba(11,43,29,0.64)_34%,rgba(3,24,15,0.82)_100%)] shadow-[0_16px_38px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl";

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
      <div className={`${glassShellClass} px-4 py-10 text-center`}>
        <p className="text-[13px] font-bold leading-5 text-[#faf6f0]/58">
          No stocks match these filters in the current batch. Reset filters or load the next batch.
        </p>
      </div>
    );
  }

  return (
    <div className={glassShellClass}>
      {items.map((stock) => {
        const confidence = getModelConfidence(stock);
        const rowKey = String(stock.id ?? stock.ticker ?? stock.rank ?? "ranking-row");
        const isWhyOpen = openWhyKey === rowKey;

        return (
          <article
            key={rowKey}
            data-expanded={isWhyOpen ? "true" : "false"}
            className="relative border-b border-[#ddb159]/12 bg-transparent px-3 py-3 transition-colors duration-150 last:border-b-0 hover:bg-[#ddb159]/[0.035] active:bg-[#ddb159]/[0.055] data-[expanded=true]:bg-[#ddb159]/[0.028]"
          >
            <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ddb159] text-[11px] font-black tabular-nums text-[#061b12] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                {stock.rank ?? "—"}
              </span>

              <Link
                href={`/stock/${stock.ticker}`}
                className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
              >
                <StockLogo ticker={stock.ticker} company={stock.company} size={34} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-black leading-5 text-[#faf6f0]">
                    {stock.ticker}
                  </span>
                  <span className="block truncate text-[10px] font-semibold leading-4 text-[#faf6f0]/48">
                    {stock.company}
                  </span>
                </span>
              </Link>

              <span className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black tabular-nums text-[#061b12] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                {score(stock.score)}
              </span>
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] font-semibold text-[#faf6f0]/56">
              <span className="shrink-0 tabular-nums">{dailyMove(stock.dailyMove)}</span>
              <span aria-hidden="true" className="shrink-0 text-[#faf6f0]/22">·</span>
              <span className="shrink-0 tabular-nums">{price(stock.price)}</span>
              <span aria-hidden="true" className="shrink-0 text-[#faf6f0]/22">·</span>
              <span className="min-w-0 truncate">{confidence.label} confidence</span>
            </div>

            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span className="min-w-0 truncate text-[10px] font-semibold text-[#faf6f0]/44">
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
        <div className="border-t border-[#ddb159]/12 bg-[#02150d]/24 p-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={loadNext}
            disabled={isPending}
            className="h-12 w-full rounded-2xl bg-[#ddb159] text-[11px] font-black text-[#061b12] shadow-[0_8px_20px_rgba(221,177,89,0.14)] transition hover:brightness-105 disabled:opacity-50"
          >
            {isPending ? "Loading next 50…" : "Load next 50"}
          </button>
          {error && (
            <p className="mt-2 text-center text-[11px] font-semibold text-[#e7c56c]">{error}</p>
          )}
          <p className="mt-2 text-center text-[9px] font-semibold text-[#faf6f0]/38">
            Loaded through page {page} of {totalPages}
          </p>
        </div>
      )}
    </div>
  );
}
