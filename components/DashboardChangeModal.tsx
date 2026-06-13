"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileSheet } from "@/components/MobileSheet";

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

function cleanTicker(ticker?: string | null) {
  return (ticker ?? "").trim().toUpperCase().replace(".", "-");
}

function initialsFrom(ticker?: string | null, company?: string | null) {
  const symbol = cleanTicker(ticker);
  if (symbol) return symbol.slice(0, 4);

  return (company ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

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

function moveToneClassDark(tone: DailyChangeItem["dailyMoveTone"]) {
  if (tone === "positive") return "text-emerald-300";
  if (tone === "negative") return "text-red-300";
  return "text-[#faf6f0]/45";
}

function rankToneClass(tone: DailyChangeItem["rankTone"]) {
  if (tone === "up") return "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";
  if (tone === "down") return "text-red-300 bg-red-400/10 border-red-400/20";
  return "text-[#faf6f0]/55 bg-[#faf6f0]/6 border-[#faf6f0]/10";
}

function MoverLogo({ ticker, company, compact = false }: { ticker: string; company: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const symbol = cleanTicker(ticker);
  const fallback = initialsFrom(ticker, company);

  return (
    <div
      className={[
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#ddb159]/18 bg-[#061b12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_rgba(0,0,0,0.22)]",
        compact ? "size-[clamp(38px,4.5vw,52px)] p-2" : "size-12 p-2 sm:size-14 sm:p-2.5",
      ].join(" ")}
    >
      {symbol && !failed ? (
        <img
          src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
          alt=""
          aria-hidden="true"
          className="block h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0b2618] text-[9px] font-black text-[#ddb159]">
          {fallback}
        </span>
      )}
    </div>
  );
}

function MoverLogoTile({ item, onOpen }: { item: DailyChangeItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-0 min-w-0 flex-col items-center justify-center text-center outline-none"
      title={`${item.ticker} ${item.dailyMoveLabel}`}
    >
      <MoverLogo ticker={item.ticker} company={item.company} compact />
      <p className="mt-1.5 max-w-full truncate text-[clamp(10px,0.95vw,12px)] font-black leading-none tracking-[-0.03em] text-[#f8f4e8]">
        {item.ticker}
      </p>
      <p
        className={`mt-1 flex max-w-full items-center justify-center gap-1 truncate text-[clamp(9px,0.86vw,11px)] font-black leading-none tabular-nums ${moveToneClassDark(
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
  surface = "default",
}: {
  listItems: DailyChangeItem[];
  mode: MoverMode;
  onClose: () => void;
  surface?: "default" | "desktop-drawer";
}) {
  if (listItems.length === 0) {
    return <div className="p-6 text-center text-white/50">No mover data available yet.</div>;
  }

  const isDesktopDrawer = surface === "desktop-drawer";

  return (
    <div
      className={[
        "stockgpt-mover-list overflow-hidden rounded-[22px] border border-[#ddb159]/12",
        isDesktopDrawer ? "stockgpt-mover-list-desktop bg-[#061b12]" : "bg-[#050706]",
      ].join(" ")}
      style={{ backgroundColor: isDesktopDrawer ? "#061b12" : "#050706" }}
    >
      {listItems.map((item) => (
        <Link
          key={`${mode}-list-${item.ticker}`}
          href={`/stock/${item.ticker}`}
          onClick={onClose}
          style={{ color: "#faf6f0" }}
          className={[
            "stockgpt-mover-row grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[#ddb159]/12 p-3 !text-[#faf6f0] transition last:border-b-0 visited:!text-[#faf6f0] sm:p-4",
            isDesktopDrawer
              ? "stockgpt-mover-row-desktop !bg-[#13251a] hover:!bg-[#1b3324] focus:!bg-[#1b3324] focus-visible:!bg-[#1b3324] active:!bg-[#203d2a]"
              : "bg-transparent hover:!bg-[#ddb159]/[0.055] hover:!text-[#faf6f0] focus:!bg-[#ddb159]/[0.055] focus:!text-[#faf6f0] focus-visible:!bg-[#ddb159]/[0.055] active:!bg-[#ddb159]/[0.08]",
          ].join(" ")}
        >
          <MoverLogo ticker={item.ticker} company={item.company} />

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
                  className={`mt-2 flex items-center justify-end gap-1 text-[13px] font-black tabular-nums sm:text-[16px] ${moveToneClassDark(
                    item.dailyMoveTone,
                  )}`}
                >
                  <span>{directionIcon(item.dailyMoveTone)}</span>
                  <span>{item.dailyMoveLabel}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              <span title={item.rankTitle} className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${rankToneClass(item.rankTone)}`}>
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
      <section className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#062018] p-3 text-[#f8f4e8] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:border-[#ddb159]/28 hover:bg-[#062018] sm:p-4 lg:h-full lg:min-h-0 lg:p-[clamp(11px,1vw,15px)]">
        <button type="button" onClick={() => setOpen(true)} className="min-w-0 shrink-0 text-left">
          <h2 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[22px] font-black leading-none tracking-[-0.05em] text-[#f8f4e8] sm:text-[26px] lg:text-[clamp(20px,1.72vw,26px)]">
            Today&apos;s top movers <span className="text-[#ddb159]">›</span>
          </h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]/78">
            1D · S&amp;P 500
          </p>
        </button>

        <div className="mt-3 grid grid-cols-2 rounded-full bg-white/8 p-1">
          {(["gainers", "losers"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={[
                "h-[clamp(34px,4.4dvh,42px)] rounded-full text-[13px] font-black capitalize transition sm:text-[14px] lg:text-[clamp(12px,1vw,14px)]",
                mode === tab
                  ? "bg-[#ddb159] text-[#072116] shadow-[0_6px_16px_rgba(221,177,89,0.18)]"
                  : "text-[#f8f4e8]/55 hover:bg-white/6 hover:text-[#f8f4e8]",
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
              className="col-span-4 h-full rounded-2xl border border-[#ddb159]/12 bg-white/[0.055] px-3 py-4 text-left text-[11px] font-bold text-[#f8f4e8]/45"
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
        <div className="stockgpt-top-movers-mobile-content grid min-h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-4 bg-[#050706]" style={{ backgroundColor: "#050706" }}>
          <div className="flex flex-wrap gap-2 bg-[#050706]" style={{ backgroundColor: "#050706" }}>
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

          <MoverList listItems={listItems} mode={mode} onClose={() => setOpen(false)} />
        </div>
      </MobileSheet>

      {open && (
        <div className="stockgpt-top-movers-overlay hidden lg:fixed lg:inset-0 lg:z-[90] lg:flex lg:justify-end lg:bg-[#020806]/76 lg:backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
            aria-label="Close top movers backdrop"
          />

          <aside
            className="stockgpt-top-movers-drawer relative z-10 flex h-full w-[min(540px,42vw)] min-w-[440px] flex-col overflow-hidden rounded-l-[34px] border-l border-[#ddb159]/28 bg-[#050706] text-[#f8f4e8] shadow-[0_28px_90px_rgba(0,0,0,0.58)]"
            style={{ backgroundColor: "#061b12", color: "#f8f4e8" }}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ddb159]/14 bg-[#050706] px-6 pb-5 pt-6" style={{ backgroundColor: "#04140c" }}>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Daily market movement
                </p>
                <h3 className="mt-2 text-[40px] font-black leading-none tracking-[-0.06em]">
                  Top Movers
                </h3>
                <p className="mt-3 max-w-md text-[14px] font-semibold leading-5 text-[#f8f4e8]/58">
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

            <div className="flex shrink-0 flex-wrap gap-2 bg-[#050706] px-6 py-4" style={{ backgroundColor: "#061b12" }}>
              <FilterPill label="All" active />
              <FilterPill label="1 day" active />
              <FilterPill label="1 week" />
              <FilterPill label="1 month" />
              <FilterPill label="AI rank movers" />
            </div>

            <div className="flex shrink-0 bg-[#050706] px-6 pb-4" style={{ backgroundColor: "#061b12" }}>
              <div className="grid w-full grid-cols-2 rounded-full bg-white/8 p-1">
                {(["gainers", "losers"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMode(tab)}
                    className={[
                      "h-11 rounded-full text-[14px] font-black capitalize transition",
                      mode === tab
                        ? "bg-[#ddb159] text-[#072116] shadow-[0_6px_16px_rgba(221,177,89,0.18)]"
                        : "text-white/50 hover:bg-white/6 hover:text-white",
                    ].join(" ")}
                  >
                    Top {tab}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="stockgpt-top-movers-scroll min-h-0 flex-1 overflow-y-auto bg-[#050706] px-6 pb-6"
              style={{ backgroundColor: "#061b12", scrollbarColor: "#d4af37 #061b12" }}
            >
              <MoverList listItems={listItems} mode={mode} onClose={() => setOpen(false)} surface="desktop-drawer" />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
