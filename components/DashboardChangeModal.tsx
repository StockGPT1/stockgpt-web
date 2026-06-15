"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DailyChangeItem = {
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
  weeklyMoveLabel?: string;
  weeklyMoveTone?: "positive" | "negative" | "neutral";
  monthlyMoveLabel?: string;
  monthlyMoveTone?: "positive" | "negative" | "neutral";
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

function parseMoveValue(label: string | undefined) {
  const value = Number(String(label ?? "").replace("%", ""));
  return Number.isFinite(value) ? value : 0;
}

function sortMovers(items: DailyChangeItem[], mode: MoverMode) {
  return [...items]
    .sort((a, b) => {
      const aValue = parseMoveValue(a.dailyMoveLabel);
      const bValue = parseMoveValue(b.dailyMoveLabel);
      return mode === "gainers" ? bValue - aValue : aValue - bValue;
    })
    .filter((item) => {
      const value = parseMoveValue(item.dailyMoveLabel);
      return mode === "gainers" ? value >= 0 : value < 0;
    });
}

function moveToneClass(tone: DailyChangeItem["dailyMoveTone"]) {
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
    <span className={["stockgpt-mover-logo grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#ddb159]/18 bg-[#061b12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_rgba(0,0,0,0.22)]", compact ? "size-10 p-2" : "size-10 p-2 sm:size-11"].join(" ")}>
      {symbol && !failed ? (
        <img src={`https://financialmodelingprep.com/image-stock/${symbol}.png`} alt="" aria-hidden="true" className="block h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0b2618] text-[9px] font-black text-[#ddb159]">{fallback}</span>
      )}
    </span>
  );
}

function MoverLogoTile({ item, onOpen }: { item: DailyChangeItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex min-h-0 min-w-0 flex-col items-center justify-center text-center outline-none" title={`${item.ticker} ${item.dailyMoveLabel}`}>
      <MoverLogo ticker={item.ticker} company={item.company} compact />
      <p className="mt-1.5 max-w-full truncate text-[clamp(10px,0.95vw,12px)] font-black leading-none tracking-[-0.03em] text-[#f8f4e8]">{item.ticker}</p>
      <p className={`mt-1 max-w-full truncate text-[clamp(9px,0.86vw,11px)] font-black leading-none tabular-nums ${moveToneClass(item.dailyMoveTone)}`}>{item.dailyMoveLabel}</p>
    </button>
  );
}

function LoadingRows() {
  return (
    <div className="grid gap-2 p-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-[72px] animate-pulse rounded-2xl border border-[#ddb159]/10 bg-[#faf6f0]/[0.045]" />
      ))}
    </div>
  );
}

function MoverList({
  items,
  loading,
  error,
  onClose,
}: {
  items: DailyChangeItem[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  if (loading) return <LoadingRows />;
  if (error && items.length === 0) return <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-[13px] font-bold text-red-100">Couldn&apos;t load movers. Try again.</div>;
  if (items.length === 0) return <div className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] p-4 text-[13px] font-bold text-[#faf6f0]/55">No movers available yet.</div>;

  return (
    <div className="stockgpt-mover-list grid gap-2">
      {items.map((item) => {
        const rankLabel = item.actualRankLabel ?? "#--";
        const symbol = cleanTicker(item.ticker);
        return (
          <Link key={`${symbol}-${item.dailyMoveLabel}`} href={`/stock/${symbol}`} onClick={onClose} className="stockgpt-mover-row grid min-h-[76px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[#ddb159]/12 bg-[#102519] p-3 text-[#faf6f0] outline-none transition hover:border-[#ddb159]/28 hover:bg-[#183523] focus-visible:border-[#ddb159]/55 focus-visible:bg-[#183523]">
            <MoverLogo ticker={item.ticker} company={item.company} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-black leading-tight tracking-[-0.03em] text-[#faf6f0]">{item.ticker}</p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-[#faf6f0]/48">{item.company}</p>
              <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                <span title={item.rankTitle} className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${rankToneClass(item.rankTone)}`}>Rank {rankLabel}</span>
                <span className="rounded-full border border-[#ddb159]/20 bg-[#ddb159]/10 px-2 py-0.5 text-[9px] font-black text-[#ddb159]">Score {item.score}</span>
              </div>
            </div>
            <div className="min-w-[76px] shrink-0 text-right">
              <p className="truncate text-[14px] font-black tabular-nums text-[#faf6f0]">{item.price}</p>
              <p className={`mt-1 text-[13px] font-black tabular-nums ${moveToneClass(item.dailyMoveTone)}`}>{item.dailyMoveLabel}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function TopMoversDialog({
  open,
  mode,
  setMode,
  items,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  mode: MoverMode;
  setMode: (mode: MoverMode) => void;
  items: DailyChangeItem[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="stockgpt-top-movers-overlay fixed inset-0 z-[2147483647] flex min-w-0 overflow-hidden bg-[#020805]/88 text-[#faf6f0] backdrop-blur-sm">
      <button type="button" aria-label="Close top movers backdrop" onClick={onClose} className="absolute inset-0 hidden cursor-default lg:block" />
      <div className="stockgpt-top-movers-shell">
        <section role="dialog" aria-modal="true" aria-labelledby="stockgpt-top-movers-title" className="stockgpt-top-movers-drawer grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden border-l border-[#ddb159]/20 bg-[#061b12] shadow-[0_28px_90px_rgba(0,0,0,0.62)] lg:rounded-l-[30px]">
          <header className="flex min-w-0 shrink-0 items-start justify-between gap-3 border-b border-[#ddb159]/14 bg-[#04140c] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-5 lg:px-6 lg:pt-6">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Daily market movement</p>
              <h3 id="stockgpt-top-movers-title" className="mt-2 text-[32px] font-black leading-none tracking-[-0.055em] text-[#faf6f0]">Top Movers</h3>
              <p className="mt-2 text-[13px] font-semibold leading-5 text-[#faf6f0]/58">Today&apos;s biggest moves across tracked stocks.</p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.045] text-[18px] font-black leading-none text-[#ddb159] transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10" aria-label="Close top movers">
              X
            </button>
          </header>

          <div className="shrink-0 border-b border-[#ddb159]/10 bg-[#061b12] px-4 py-3 sm:px-5 lg:px-6">
            <div className="grid grid-cols-2 rounded-full bg-[#faf6f0]/8 p-1">
              {(["gainers", "losers"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setMode(tab)} className={["h-11 rounded-full text-[14px] font-black capitalize transition", mode === tab ? "bg-[#ddb159] text-[#072116] shadow-[0_6px_16px_rgba(221,177,89,0.18)]" : "text-[#faf6f0]/55 hover:bg-[#faf6f0]/6 hover:text-[#faf6f0]"].join(" ")}>
                  {tab === "gainers" ? "Gainers" : "Losers"}
                </button>
              ))}
            </div>
          </div>

          <div className="stockgpt-top-movers-scroll min-h-0 overflow-y-auto overflow-x-hidden bg-[#061b12] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-6">
            <MoverList items={items} loading={loading} error={error} onClose={onClose} />
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

export function DashboardChangeModal({ items }: { items: DailyChangeItem[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MoverMode>("gainers");
  const [remoteItems, setRemoteItems] = useState<DailyChangeItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMovers() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/top-movers?period=1d", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { movers?: DailyChangeItem[] } | null;
      if (!response.ok) throw new Error("Could not load movers.");
      setRemoteItems(Array.isArray(data?.movers) ? data.movers : []);
    } catch {
      setError("Couldn't load movers. Try again.");
      setRemoteItems(null);
    } finally {
      setLoading(false);
    }
  }

  function openDialog() {
    setOpen(true);
    if (!remoteItems && !loading) void loadMovers();
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeItems = remoteItems ?? items;
  const movers = useMemo(() => sortMovers(activeItems, mode), [activeItems, mode]);
  const previewItems = movers.slice(0, 8);

  return (
    <>
      <section className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#062018] p-3 text-[#f8f4e8] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:border-[#ddb159]/28 hover:bg-[#062018] sm:p-4 lg:h-full lg:min-h-0 lg:p-[clamp(11px,1vw,15px)]">
        <button type="button" onClick={openDialog} className="min-w-0 shrink-0 text-left">
          <h2 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[22px] font-black leading-none tracking-[-0.05em] text-[#f8f4e8] sm:text-[26px] lg:text-[clamp(20px,1.72vw,26px)]">Today&apos;s top movers <span className="text-[#ddb159]">&gt;</span></h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]/78">1D - S&amp;P 500</p>
        </button>
        <div className="mt-3 grid grid-cols-2 rounded-full bg-white/8 p-1">
          {(["gainers", "losers"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setMode(tab)} className={["h-[clamp(34px,4.4dvh,42px)] rounded-full text-[13px] font-black capitalize transition sm:text-[14px] lg:text-[clamp(12px,1vw,14px)]", mode === tab ? "bg-[#ddb159] text-[#072116] shadow-[0_6px_16px_rgba(221,177,89,0.18)]" : "text-[#f8f4e8]/55 hover:bg-white/6 hover:text-[#f8f4e8]"].join(" ")}>Top {tab}</button>
          ))}
        </div>
        <div className="mt-3 grid min-h-0 grid-cols-4 auto-rows-fr content-stretch gap-x-3 gap-y-3 overflow-hidden pb-1 pt-1">
          {previewItems.length > 0 ? (
            previewItems.map((item) => <MoverLogoTile key={`${mode}-preview-${item.ticker}`} item={item} onOpen={openDialog} />)
          ) : (
            <button type="button" onClick={openDialog} className="col-span-4 h-full rounded-2xl border border-[#ddb159]/12 bg-white/[0.055] px-3 py-4 text-left text-[11px] font-bold text-[#f8f4e8]/45">No {mode === "gainers" ? "positive" : "negative"} movers available yet.</button>
          )}
        </div>
      </section>

      <TopMoversDialog open={open} mode={mode} setMode={setMode} items={movers} loading={loading} error={error} onClose={() => setOpen(false)} />
    </>
  );
}
