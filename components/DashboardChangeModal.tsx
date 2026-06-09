"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StockLogo } from "@/components/StockLogo";

type DailyChangeItem = {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  score: string;
  rankLabel: string;
  rankTone: "up" | "down" | "flat" | "none";
  rankTitle: string;
  dailyMoveLabel: string;
  dailyMoveTone: "positive" | "negative" | "neutral";
};

type Side = "gainers" | "losers";

function parseMove(value: string) {
  const parsed = Number(value.replace("%", "").replace("+", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function moveTextClass(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "text-emerald-600";
  if (tone === "negative") return "text-red-500";
  return "text-[#072116]/45";
}

function moveTriangle(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "▲";
  if (tone === "negative") return "▼";
  return "•";
}

function tabClass(active: boolean) {
  return [
    "h-9 flex-1 rounded-full text-[12px] font-black transition sm:h-10 sm:text-[13px] lg:h-[clamp(30px,4dvh,38px)] lg:text-[clamp(10px,0.82vw,13px)]",
    active
      ? "bg-[#faf6f0]/78 text-[#072116]"
      : "text-[#faf6f0]/58 hover:bg-[#faf6f0]/8 hover:text-[#faf6f0]",
  ].join(" ");
}

function MoverTile({ item }: { item: DailyChangeItem }) {
  return (
    <Link
      href={`/stock/${item.ticker}`}
      className="group grid min-w-0 justify-items-center gap-1 rounded-2xl p-1.5 text-center transition hover:bg-[#faf6f0]/7"
      title={`${item.company} · ${item.dailyMoveLabel} · ${item.sector}`}
    >
      <div className="grid size-[46px] place-items-center rounded-full bg-[#faf6f0] ring-1 ring-white/10 transition group-hover:scale-[1.03] sm:size-[54px] lg:size-[clamp(38px,5.6dvh,52px)]">
        <StockLogo ticker={item.ticker} company={item.company} size={34} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[12px] font-black leading-none tracking-[-0.02em] text-[#faf6f0] sm:text-[13px] lg:text-[clamp(10px,0.9vw,13px)]">
          {item.ticker}
        </p>
        <p
          className={`mt-1 truncate text-[11px] font-black leading-none tabular-nums sm:text-[12px] lg:text-[clamp(9px,0.82vw,12px)] ${moveTextClass(
            item.dailyMoveTone,
          )}`}
        >
          <span className="mr-1 text-[9px]">{moveTriangle(item.dailyMoveTone)}</span>
          {item.dailyMoveLabel}
        </p>
      </div>
    </Link>
  );
}

export function DashboardChangeModal({ items }: { items: DailyChangeItem[] }) {
  const [side, setSide] = useState<Side>("gainers");

  const { gainers, losers } = useMemo(() => {
    const usable = items.filter((item) => item.dailyMoveLabel !== "—");
    return {
      gainers: usable
        .filter((item) => parseMove(item.dailyMoveLabel) >= 0)
        .sort((a, b) => parseMove(b.dailyMoveLabel) - parseMove(a.dailyMoveLabel))
        .slice(0, 8),
      losers: usable
        .filter((item) => parseMove(item.dailyMoveLabel) < 0)
        .sort((a, b) => parseMove(a.dailyMoveLabel) - parseMove(b.dailyMoveLabel))
        .slice(0, 8),
    };
  }, [items]);

  const activeItems = side === "gainers" ? gainers : losers;
  const emptyCopy =
    side === "gainers"
      ? "No positive 1D movers available yet."
      : "No negative 1D movers available yet.";

  return (
    <section className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#151c1d] p-3 text-[#faf6f0] sm:p-4 lg:h-full lg:min-h-0 lg:p-[clamp(12px,1.1vw,16px)]">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Link
          href="/top-movers"
          className="group min-w-0 truncate text-[18px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]/78 transition hover:text-[#ddb159] sm:text-[22px] lg:text-[clamp(18px,1.55vw,22px)]"
        >
          Today&apos;s top movers
          <span className="ml-2 inline-block text-[#faf6f0]/55 transition group-hover:translate-x-0.5 group-hover:text-[#ddb159]">
            ›
          </span>
        </Link>

        <p className="hidden shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70 sm:block lg:text-[clamp(8px,0.62vw,9px)]">
          1D · S&amp;P 500
        </p>
      </div>

      <div className="mt-3 flex rounded-full bg-[#faf6f0]/9 p-1 ring-1 ring-white/5">
        <button
          type="button"
          onClick={() => setSide("gainers")}
          className={tabClass(side === "gainers")}
        >
          Top gainers
        </button>
        <button
          type="button"
          onClick={() => setSide("losers")}
          className={tabClass(side === "losers")}
        >
          Top losers
        </button>
      </div>

      <div className="mt-3 min-h-0 overflow-hidden">
        {activeItems.length > 0 ? (
          <div className="grid h-full min-h-0 grid-cols-4 content-between gap-x-2 gap-y-3">
            {activeItems.map((item) => (
              <MoverTile key={`${side}-${item.ticker}`} item={item} />
            ))}
          </div>
        ) : (
          <Link
            href="/top-movers"
            className="grid h-full min-h-[86px] place-items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/5 px-4 text-center text-[12px] font-bold text-[#faf6f0]/45 transition hover:border-[#ddb159]/35 hover:bg-[#ddb159]/8"
          >
            {emptyCopy}
          </Link>
        )}
      </div>
    </section>
  );
}
