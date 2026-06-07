"use client";

import Link from "next/link";
import { useState } from "react";

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

function moveToneClass(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "text-emerald-700 bg-emerald-500/10 border-emerald-500/20";
  if (tone === "negative") return "text-red-700 bg-red-500/10 border-red-500/20";
  return "text-[#072116]/55 bg-[#072116]/5 border-[#072116]/10";
}

function rankToneClass(tone: DailyChangeItem["rankTone"]) {
  if (tone === "up") return "text-emerald-700 bg-emerald-500/10 border-emerald-500/20";
  if (tone === "down") return "text-red-700 bg-red-500/10 border-red-500/20";
  return "text-[#072116]/55 bg-[#072116]/5 border-[#072116]/10";
}

function PreviewChangeRow({
  item,
  onOpen,
}: {
  item: DailyChangeItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid min-h-[48px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-xl border border-[#072116]/8 bg-white/72 px-3 py-2 text-left transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/8 lg:h-full lg:min-h-0"
    >
      <div className="min-w-0 overflow-hidden">
        <p className="flex min-w-0 items-baseline gap-1 text-[12px] font-black leading-tight">
          <span className="shrink-0">{item.ticker} ·</span>
          <span className="min-w-0 truncate">{item.company}</span>
        </p>
        <p className="mt-0.5 truncate text-[9px] font-bold leading-tight text-[#072116]/42">
          {item.sector}
        </p>
      </div>

      <span
        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black tabular-nums ${moveToneClass(
          item.dailyMoveTone,
        )}`}
      >
        {item.dailyMoveLabel}
      </span>
    </button>
  );
}

export function DashboardChangeModal({ items }: { items: DailyChangeItem[] }) {
  const [open, setOpen] = useState(false);
  const mobilePreviewItems = items.slice(0, 3);
  const desktopPreviewItems = items.slice(0, 2);

  return (
    <>
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-3 text-[#072116] shadow-[0_12px_30px_rgba(0,0,0,0.18)] lg:h-full lg:min-h-0">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/55">
              ✦ What changed today?
            </p>
            <h2 className="mt-1 truncate text-[18px] font-black tracking-[-0.04em]">
              Daily brief
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-[#ddb159] px-3 py-1.5 text-[10px] font-black text-[#072116] transition hover:brightness-105"
          >
            View all →
          </button>
        </div>

        <div className="mt-2 grid gap-2 lg:hidden">
          {mobilePreviewItems.length > 0 ? (
            mobilePreviewItems.map((item) => (
              <PreviewChangeRow key={item.ticker} item={item} onOpen={() => setOpen(true)} />
            ))
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-[#072116]/8 bg-white/72 px-3 py-3 text-left text-[11px] font-bold text-[#072116]/45"
            >
              No daily changes available yet.
            </button>
          )}
        </div>

        <div className="mt-2 hidden min-h-0 flex-1 gap-2 lg:grid lg:grid-rows-2">
          {desktopPreviewItems.length > 0 ? (
            desktopPreviewItems.map((item) => (
              <PreviewChangeRow key={item.ticker} item={item} onOpen={() => setOpen(true)} />
            ))
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="row-span-2 rounded-xl border border-[#072116]/8 bg-white/72 px-3 py-3 text-left text-[11px] font-bold text-[#072116]/45"
            >
              No daily changes available yet.
            </button>
          )}
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020806]/78 px-3 py-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[#ddb159]/35 bg-[#faf6f0] text-[#072116] shadow-[0_28px_90px_rgba(0,0,0,0.46)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#072116]/10 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Daily market movement
                </p>
                <h3 className="mt-1 text-[26px] font-black leading-none tracking-[-0.05em] sm:text-[34px]">
                  What changed today?
                </h3>
                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#072116]/58">
                  A fuller view of rank movement, daily price movement and score context from the top-ranked universe.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-[#072116]/10 bg-white text-[18px] font-black text-[#072116] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                aria-label="Close daily changes"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="grid gap-2">
                {items.length > 0 ? (
                  items.map((item) => (
                    <Link
                      key={item.ticker}
                      href={`/stock/${item.ticker}`}
                      onClick={() => setOpen(false)}
                      className="grid gap-3 rounded-2xl border border-[#072116]/8 bg-white px-3 py-3 transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="text-[15px] font-black tracking-[-0.02em]">
                            {item.ticker}
                          </p>
                          <p className="min-w-0 truncate text-[13px] font-bold text-[#072116]/72">
                            {item.company}
                          </p>
                        </div>
                        <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[#072116]/42">
                          {item.sector} · Price {item.price} · Score {item.score}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-black tabular-nums ${moveToneClass(
                            item.dailyMoveTone,
                          )}`}
                        >
                          1D {item.dailyMoveLabel}
                        </span>
                        <span
                          title={item.rankTitle}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${rankToneClass(
                            item.rankTone,
                          )}`}
                        >
                          Rank {item.rankLabel}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[#072116]/8 bg-white px-4 py-6 text-center text-[12px] font-bold text-[#072116]/50">
                    No daily movement data is available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
