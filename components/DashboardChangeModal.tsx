"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileSheet } from "@/components/MobileSheet";
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

type MoverMode = "gainers" | "losers";

function parseMoveValue(label: string) {
  const value = Number(String(label).replace("%", ""));
  return Number.isFinite(value) ? value : 0;
}

function sortMovers(items: DailyChangeItem[], mode: MoverMode) {
  return [...items]
    .sort((a, b) => {
      const aValue = parseMoveValue(a.dailyMoveLabel);
      const bValue = parseMoveValue(b.dailyMoveLabel);
      return mode === "gainers" ? bValue - aValue : aValue - bValue;
    })
    .filter((item) =>
      mode === "gainers"
        ? parseMoveValue(item.dailyMoveLabel) >= 0
        : parseMoveValue(item.dailyMoveLabel) < 0,
    );
}

function directionIcon(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "negative") return "▼";
  if (tone === "positive") return "▲";
  return "•";
}

function moveToneClass(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "text-emerald-600";
  if (tone === "negative") return "text-red-500";
  return "text-[#072116]/45";
}

function moveToneClassDark(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "text-emerald-300";
  if (tone === "negative") return "text-red-300";
  return "text-[#faf6f0]/45";
}

function moveBadgeClass(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (tone === "negative") return "border-red-500/25 bg-red-500/10 text-red-700";
  return "border-[#072116]/10 bg-[#072116]/5 text-[#072116]/55";
}

function moveBadgeClassDark(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "border-emerald-400/28 bg-emerald-400/12 text-emerald-300";
  if (tone === "negative") return "border-red-400/28 bg-red-400/12 text-red-300";
  return "border-[#faf6f0]/10 bg-[#faf6f0]/6 text-[#faf6f0]/55";
}

function rankToneClass(tone: DailyChangeItem["rankTone"]) {
  if (tone === "up") return "text-emerald-700 bg-emerald-500/10 border-emerald-500/20";
  if (tone === "down") return "text-red-700 bg-red-500/10 border-red-500/20";
  return "text-[#072116]/55 bg-[#072116]/5 border-[#072116]/10";
}

function rankToneClassDark(tone: DailyChangeItem["rankTone"]) {
  if (tone === "up") return "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";
  if (tone === "down") return "text-red-300 bg-red-400/10 border-red-400/20";
  return "text-[#faf6f0]/55 bg-[#faf6f0]/6 border-[#faf6f0]/10";
}

function MoverLogoTile({ item, onOpen }: { item: DailyChangeItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-0 min-w-0 flex-col items-center justify-center text-center outline-none"
      title={`${item.ticker} ${item.dailyMoveLabel}`}
    >
      <div className="grid size-[clamp(36px,4.5vw,52px)] place-items-center rounded-full bg-white shadow-[0_6px_14px_rgba(7,33,22,0.12)] ring-1 ring-[#072116]/8 transition group-hover:scale-[1.03] group-hover:ring-[#ddb159]/45">
        <StockLogo ticker={item.ticker} company={item.company} size={32} />
      </div>
      <p className="mt-1.5 max-w-full truncate text-[clamp(10px,0.95vw,12px)] font-black leading-none tracking-[-0.03em] text-[#072116]">
        {item.ticker}
      </p>
      <p
        className={`mt-1 flex max-w-full items-center justify-center gap-1 truncate text-[clamp(9px,0.86vw,11px)] font-black leading-none tabular-nums ${moveToneClass(
          item.dailyMoveTone,
        )}`}
      >
        <span className="text-[8px]">{directionIcon(item.dailyMoveTone)}</span>
        <span className="truncate">{item.dailyMoveLabel}</span>
      </p>
    </button>
  );
}

function FilterPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      disabled={!active}
      className={[
        "inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-black transition",
        active
          ? "bg-[#ddb159] text-[#072116] shadow-[0_8px_18px_rgba(221,177,89,0.22)]"
          : "cursor-not-allowed border border-[#faf6f0]/8 bg-[#faf6f0]/5 text-[#faf6f0]/25",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function MoverList({
  listItems,
  mode,
  onClose,
  mobile = false,
}: {
  listItems: DailyChangeItem[];
  mode: MoverMode;
  onClose: () => void;
  mobile?: boolean;
}) {
  if (listItems.length === 0) {
    return <div className="p-6 text-center text-white/50">No mover data available yet.</div>;
  }

  return (
    <div className={mobile ? "grid gap-3" : "overflow-hidden rounded-[24px] bg-white/[0.055] ring-1 ring-white/8"}>
      {listItems.map((item) => (
        <Link
          key={`${mode}-list-${item.ticker}`}
          href={`/stock/${item.ticker}`}
          onClick={onClose}
          className={[
            mobile
              ? "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[24px] border border-[#ddb159]/14 bg-[#faf6f0]/[0.055] p-4 text-[#faf6f0] shadow-[0_14px_34px_rgba(0,0,0,0.2)]"
              : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/8 px-4 py-4 transition last:border-b-0 hover:bg-[#ddb159]/8 sm:px-5",
          ].join(" ")}
        >
          <div className="grid size-12 place-items-center rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,0.22)] sm:size-14">
            <StockLogo ticker={item.ticker} company={item.company} size={38} />
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[17px] font-black leading-tight tracking-[-0.03em] sm:text-[20px]">
                  {item.company}
                </p>
                <p className="mt-1 truncate text-[13px] font-bold text-white/48 sm:text-[14px]">
                  {item.ticker} · {item.sector}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[18px] font-black tabular-nums sm:text-[22px]">{item.price}</p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-black tabular-nums sm:text-[15px] ${
                    mobile ? moveBadgeClassDark(item.dailyMoveTone) : moveBadgeClass(item.dailyMoveTone)
                  }`}
                >
                  {directionIcon(item.dailyMoveTone)} {item.dailyMoveLabel}
                </p>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              <span
                title={item.rankTitle}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                  mobile ? rankToneClassDark(item.rankTone) : rankToneClass(item.rankTone)
                }`}
              >
                Rank {item.rankLabel}
              </span>
              <span className="rounded-full border border-[#ddb159]/24 bg-[#ddb159]/10 px-2.5 py-1 text-[10px] font-black text-[#ddb159]">
                Score {item.score}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function DashboardChangeModal({ items }: { items: DailyChangeItem[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MoverMode>("gainers");

  const movers = useMemo(() => sortMovers(items, mode), [items, mode]);
  const previewItems = movers.slice(0, 8);
  const listItems = movers.length > 0 ? movers : items;

  return (
    <>
      <section className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-3 text-[#072116] shadow-[0_12px_30px_rgba(0,0,0,0.18)] sm:p-4 lg:h-full lg:min-h-0 lg:p-[clamp(11px,1vw,15px)]">
        <button type="button" onClick={() => setOpen(true)} className="min-w-0 shrink-0 text-left">
          <h2 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[22px] font-black leading-none tracking-[-0.05em] sm:text-[26px] lg:text-[clamp(20px,1.72vw,26px)]">
            Today&apos;s top movers <span className="text-[#072116]/55">›</span>
          </h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#9e8745]">
            1D · S&amp;P 500
          </p>
        </button>

        <div className="mt-3 grid grid-cols-2 rounded-full bg-[#072116]/8 p-1">
          {(["gainers", "losers"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={[
                "h-[clamp(34px,4.4dvh,42px)] rounded-full text-[13px] font-black capitalize transition sm:text-[14px] lg:text-[clamp(12px,1vw,14px)]",
                mode === tab
                  ? "bg-white text-[#072116] shadow-[0_6px_16px_rgba(7,33,22,0.12)]"
                  : "text-[#072116]/52 hover:text-[#072116]",
              ].join(" ")}
            >
              Top {tab}
            </button>
          ))}
        </div>

        <div className="mt-3 grid min-h-0 grid-cols-4 auto-rows-fr content-stretch gap-x-3 gap-y-3 overflow-hidden pb-1 pt-1">
          {previewItems.length > 0 ? (
            previewItems.map((item) => (
              <MoverLogoTile key={`${mode}-${item.ticker}`} item={item} onOpen={() => setOpen(true)} />
            ))
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="col-span-4 h-full rounded-2xl border border-[#072116]/8 bg-white/72 px-3 py-4 text-left text-[11px] font-bold text-[#072116]/45"
            >
              No {mode === "gainers" ? "positive" : "negative"} daily movers available yet.
            </button>
          )}
        </div>
      </section>

      <MobileSheet
        open={open}
        variant="full"
        eyebrow="Daily market movement"
        title="Top Movers"
        description="Best and worst performing stocks from the selected period, with StockGPT rank and score context."
        onClose={() => setOpen(false)}
      >
        <div className="grid min-h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
          <div className="flex flex-wrap gap-2">
            <FilterPill label="All" active />
            <FilterPill label="1 day" active />
            <FilterPill label="1 week" />
            <FilterPill label="1 month" />
            <FilterPill label="AI rank movers" />
          </div>

          <div className="grid grid-cols-2 rounded-full bg-[#faf6f0]/8 p-1">
            {(["gainers", "losers"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={[
                  "h-11 rounded-full text-[14px] font-black capitalize transition",
                  mode === tab
                    ? "bg-[#faf6f0]/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-white/50 hover:text-white",
                ].join(" ")}
              >
                Top {tab}
              </button>
            ))}
          </div>

          <MoverList listItems={listItems} mode={mode} onClose={() => setOpen(false)} mobile />
        </div>
      </MobileSheet>

      {open && (
        <div className="hidden lg:fixed lg:inset-0 lg:z-[90] lg:flex lg:items-center lg:justify-center lg:bg-[#020806]/82 lg:px-3 lg:py-4 lg:backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-[#ddb159]/28 bg-[#050706] text-[#f8f4e8] shadow-[0_28px_90px_rgba(0,0,0,0.58)]">
            <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Daily market movement
                </p>
                <h3 className="mt-2 text-[34px] font-black leading-none tracking-[-0.06em] sm:text-[44px]">
                  Top Movers
                </h3>
                <p className="mt-3 max-w-2xl text-[13px] font-semibold leading-5 text-[#f8f4e8]/58 sm:text-[14px]">
                  Best and worst performing stocks from the selected period, with StockGPT rank and score context.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/8 text-[22px] font-black text-white transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                aria-label="Close top movers"
              >
                ×
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 px-5 pb-4 sm:px-6">
              <FilterPill label="All" active />
              <FilterPill label="1 day" active />
              <FilterPill label="1 week" />
              <FilterPill label="1 month" />
              <FilterPill label="AI rank movers" />
            </div>

            <div className="flex shrink-0 px-5 pb-4 sm:px-6">
              <div className="grid w-full grid-cols-2 rounded-full bg-white/8 p-1">
                {(["gainers", "losers"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMode(tab)}
                    className={[
                      "h-11 rounded-full text-[14px] font-black capitalize transition",
                      mode === tab
                        ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-white/50 hover:text-white",
                    ].join(" ")}
                  >
                    Top {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
              <MoverList listItems={listItems} mode={mode} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
