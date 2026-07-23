"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { StockLogo } from "@/components/StockLogo";

type MoverMode = "gainers" | "losers";
type LoadState = "idle" | "loading" | "ready" | "error";

type MarketMover = {
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
};

function parseMove(label?: string | null) {
  const value = Number(String(label ?? "").replace(/[+,%]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase().replace(".", "-");
}

function marketSessionLabel() {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = et.getDay();
  const minutes = et.getHours() * 60 + et.getMinutes();

  if (day === 0 || day === 6) return "Latest close";
  if (minutes < 4 * 60) return "Latest close";
  if (minutes < 9 * 60 + 30) return "Pre-market check";
  if (minutes < 16 * 60) return "Markets open";
  if (minutes < 20 * 60) return "After-hours check";
  return "Latest close";
}

function checkedLabel(value: number | null) {
  if (!value) return "Checking live data";
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 1) return "Checked just now";
  if (minutes === 1) return "Checked 1 min ago";
  return `Checked ${minutes} mins ago`;
}

function sortedMovers(items: MarketMover[], mode: MoverMode) {
  return items
    .map((item) => ({ item, move: parseMove(item.dailyMoveLabel) }))
    .filter(
      (entry): entry is { item: MarketMover; move: number } =>
        entry.move != null &&
        entry.item.ticker.trim().length > 0 &&
        entry.item.price !== "—" &&
        (mode === "gainers" ? entry.move > 0 : entry.move < 0),
    )
    .sort((a, b) =>
      mode === "gainers" ? b.move - a.move : a.move - b.move,
    )
    .map((entry) => entry.item);
}

function movementTone(mode: MoverMode) {
  return mode === "gainers"
    ? {
        text: "text-emerald-300",
        border: "border-emerald-400/20",
        surface: "bg-emerald-400/8",
        bar: "bg-emerald-300",
        glow: "bg-emerald-400/10",
      }
    : {
        text: "text-red-200",
        border: "border-red-300/20",
        surface: "bg-red-300/8",
        bar: "bg-red-200",
        glow: "bg-red-300/10",
      };
}

function MoverRow({
  item,
  position,
  mode,
  maxMove,
  featured = false,
  onNavigate,
}: {
  item: MarketMover;
  position: number;
  mode: MoverMode;
  maxMove: number;
  featured?: boolean;
  onNavigate?: () => void;
}) {
  const ticker = cleanTicker(item.ticker);
  const move = Math.abs(parseMove(item.dailyMoveLabel) ?? 0);
  const strength = Math.max(16, Math.min(100, (move / Math.max(maxMove, 0.01)) * 100));
  const tone = movementTone(mode);

  if (featured) {
    return (
      <Link
        href={`/stock/${ticker}`}
        prefetch={false}
        onClick={onNavigate}
        className={`group relative block overflow-hidden rounded-[1.4rem] border ${tone.border} bg-[linear-gradient(145deg,rgba(13,49,33,0.82),rgba(5,25,17,0.94))] p-4 text-[#faf6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/65`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -right-10 -top-12 size-28 rounded-full ${tone.glow} blur-3xl`}
        />
        <div className="relative flex min-w-0 items-center gap-3">
          <StockLogo ticker={ticker} company={item.company} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <h3 className="shrink-0 text-[18px] font-black tracking-[-0.04em]">
                {ticker}
              </h3>
              <p className="min-w-0 truncate text-[10px] font-bold text-[#faf6f0]/42">
                {item.company}
              </p>
            </div>
            <p className="mt-1 truncate text-[10px] font-semibold text-[#faf6f0]/48">
              {item.sector}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-[18px] font-black tabular-nums ${tone.text}`}>
              {item.dailyMoveLabel}
            </p>
            <p className="mt-0.5 text-[10px] font-black tabular-nums text-[#faf6f0]/62">
              {item.price}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex items-center gap-3">
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
            #{position} today
          </span>
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[#faf6f0]/8">
            <div
              aria-hidden="true"
              className={`h-full rounded-full ${tone.bar} transition-[width] duration-300 motion-reduce:transition-none`}
              style={{ width: `${strength}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-[#faf6f0]/38">
            Open →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/stock/${ticker}`}
      prefetch={false}
      onClick={onNavigate}
      className="grid min-h-16 grid-cols-[30px_36px_minmax(0,1fr)_auto] items-center gap-2.5 py-3 text-[#faf6f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/65"
    >
      <span className="grid size-7 place-items-center rounded-full border border-[#ddb159]/18 bg-[#ddb159]/8 text-[10px] font-black text-[#ddb159]">
        {position}
      </span>
      <StockLogo ticker={ticker} company={item.company} size={34} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-black tracking-[-0.025em]">
          {ticker}
          <span className="ml-1.5 text-[9px] font-bold text-[#faf6f0]/38">
            {item.company}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[9px] font-semibold text-[#faf6f0]/42">
          {item.price} · {item.actualRankLabel ?? "Rank —"}
        </p>
      </div>
      <span className={`shrink-0 text-[13px] font-black tabular-nums ${tone.text}`}>
        {item.dailyMoveLabel}
      </span>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="mt-3 space-y-2" aria-label="Loading market movers">
      <div className="h-[120px] animate-pulse rounded-[1.4rem] border border-[#ddb159]/10 bg-[#faf6f0]/[0.035] motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-xl bg-[#faf6f0]/[0.025] motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-xl bg-[#faf6f0]/[0.025] motion-reduce:animate-none" />
    </div>
  );
}

function MoversSheet({
  open,
  mode,
  onModeChange,
  movers,
  onClose,
}: {
  open: boolean;
  mode: MoverMode;
  onModeChange: (mode: MoverMode) => void;
  movers: MarketMover[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const appContent = document.querySelector<HTMLElement>(".sg-app-content");
    const originalBodyOverflow = document.body.style.overflow;
    const originalAppOverflow = appContent?.style.overflow ?? "";

    document.body.style.overflow = "hidden";
    if (appContent) appContent.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (appContent) appContent.style.overflow = originalAppOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const maxMove = Math.max(
    0.01,
    ...movers.map((item) => Math.abs(parseMove(item.dailyMoveLabel) ?? 0)),
  );

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-end bg-[#010603]/82 text-[#faf6f0] backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close market movers"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-market-movers-sheet-title"
        className="relative grid max-h-[86dvh] w-full grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-t-[2rem] border-t border-[#ddb159]/22 bg-[#061b12] shadow-[0_-28px_80px_rgba(0,0,0,0.52)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ddb159]/12 px-5 pb-4 pt-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Daily market movement
            </p>
            <h2
              id="mobile-market-movers-sheet-title"
              className="mt-1 text-[26px] font-black tracking-[-0.05em]"
            >
              Market movers
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.04] text-[17px] font-black text-[#ddb159]"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-3">
          <div className="grid grid-cols-2 rounded-full border border-[#ddb159]/14 bg-[#04180f] p-1">
            {(["gainers", "losers"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={mode === tab}
                onClick={() => onModeChange(tab)}
                className={`min-h-11 rounded-full text-[12px] font-black capitalize transition-colors ${
                  mode === tab
                    ? "bg-[#ddb159] text-[#072116]"
                    : "text-[#faf6f0]/48"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {movers.length > 0 ? (
            <div className="divide-y divide-[#ddb159]/10">
              {movers.slice(0, 20).map((item, index) => (
                <MoverRow
                  key={`${mode}-${item.ticker}-${item.dailyMoveLabel}`}
                  item={item}
                  position={index + 1}
                  mode={mode}
                  maxMove={maxMove}
                  onNavigate={onClose}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4 text-[12px] font-semibold text-[#faf6f0]/52">
              No valid {mode} are available for the latest session.
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function MarketMoversSection({ canUsePremium }: { canUsePremium: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [mode, setMode] = useState<MoverMode>("gainers");
  const [items, setItems] = useState<MarketMover[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [sessionLabel, setSessionLabel] = useState("Market session");
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadMovers = useCallback(async () => {
    if (!canUsePremium || loadState === "loading") return;
    setLoadState("loading");

    try {
      const response = await fetch("/api/top-movers?period=1d", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { movers?: MarketMover[] }
        | null;

      if (!response.ok || !Array.isArray(payload?.movers)) {
        throw new Error("Market movers unavailable");
      }

      setItems(payload.movers);
      setCheckedAt(Date.now());
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [canUsePremium, loadState]);

  useEffect(() => {
    setSessionLabel(marketSessionLabel());
  }, []);

  useEffect(() => {
    if (!canUsePremium || loadState !== "idle") return;
    const section = sectionRef.current;
    if (!section) return;

    if (!("IntersectionObserver" in window)) {
      void loadMovers();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMovers();
          observer.disconnect();
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [canUsePremium, loadMovers, loadState]);

  const activeMovers = useMemo(
    () => sortedMovers(items, mode),
    [items, mode],
  );
  const preview = activeMovers.slice(0, 3);
  const maxMove = Math.max(
    0.01,
    ...preview.map((item) => Math.abs(parseMove(item.dailyMoveLabel) ?? 0)),
  );

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(distance) < 55) return;
    setMode(distance < 0 ? "losers" : "gainers");
  }

  return (
    <section ref={sectionRef} aria-labelledby="mobile-market-movers-title" className="min-w-0">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
            Market movers
          </p>
          <h2
            id="mobile-market-movers-title"
            className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#faf6f0]"
          >
            Today&apos;s biggest moves
          </h2>
        </div>
        {loadState === "ready" && activeMovers.length > 3 && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-10 shrink-0 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
          >
            View all →
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <div className="grid min-w-[184px] grid-cols-2 rounded-full border border-[#ddb159]/14 bg-[#04180f]/76 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          {(["gainers", "losers"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={mode === tab}
              onClick={() => setMode(tab)}
              className={`min-h-9 rounded-full px-3 text-[10px] font-black capitalize transition-colors ${
                mode === tab
                  ? "bg-[#ddb159] text-[#072116]"
                  : "text-[#faf6f0]/42"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-[8.5px] font-bold text-[#faf6f0]/40">
            {sessionLabel}
          </p>
          {loadState === "ready" && (
            <p suppressHydrationWarning className="mt-0.5 truncate text-[8px] font-bold text-[#faf6f0]/28">
              {checkedLabel(checkedAt)}
            </p>
          )}
        </div>
      </div>

      {!canUsePremium ? (
        <div className="mt-3 rounded-[1.4rem] border border-[#ddb159]/14 bg-[#0b2b1d]/52 p-4 text-[#faf6f0]">
          <p className="text-[13px] font-black">Daily movers are locked</p>
          <p className="mt-1.5 text-[10px] font-semibold leading-5 text-[#faf6f0]/50">
            Unlock the latest gainers and losers across the StockGPT universe.
          </p>
          <Link
            href="/subscription"
            className="mt-3 inline-flex min-h-10 items-center text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
          >
            View plans →
          </Link>
        </div>
      ) : loadState === "idle" || loadState === "loading" ? (
        <LoadingState />
      ) : loadState === "error" ? (
        <div className="mt-3 rounded-[1.4rem] border border-[#ddb159]/14 bg-[#0b2b1d]/52 p-4 text-[#faf6f0]">
          <p className="text-[12px] font-black">Market movers are temporarily unavailable.</p>
          <button
            type="button"
            onClick={() => void loadMovers()}
            className="mt-3 min-h-10 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
          >
            Try again →
          </button>
        </div>
      ) : preview.length === 0 ? (
        <div className="mt-3 rounded-[1.4rem] border border-[#ddb159]/14 bg-[#0b2b1d]/52 p-4 text-[11px] font-semibold text-[#faf6f0]/52">
          No valid {mode} are available for the latest session.
        </div>
      ) : (
        <div
          key={mode}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="mt-3 motion-safe:animate-[fadeIn_180ms_ease-out]"
        >
          <MoverRow
            item={preview[0]}
            position={1}
            mode={mode}
            maxMove={maxMove}
            featured
          />
          {preview.length > 1 && (
            <div className="mt-1 divide-y divide-[#ddb159]/10 px-1">
              {preview.slice(1).map((item, index) => (
                <MoverRow
                  key={`${mode}-${item.ticker}-${item.dailyMoveLabel}`}
                  item={item}
                  position={index + 2}
                  mode={mode}
                  maxMove={maxMove}
                />
              ))}
            </div>
          )}
          <p className="mt-1 px-1 text-[8px] font-bold text-[#faf6f0]/25">
            Swipe the list to switch between gainers and losers.
          </p>
        </div>
      )}

      <MoversSheet
        open={sheetOpen}
        mode={mode}
        onModeChange={setMode}
        movers={activeMovers}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  );
}

export function MobileMarketMoversPortal({
  canUsePremium,
}: {
  canUsePremium: boolean;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const existing = document.querySelector<HTMLElement>(
      "[data-mobile-market-movers-host]",
    );
    if (existing) {
      setHost(existing);
      return;
    }

    const newsLink = document.querySelector<HTMLAnchorElement>(
      '.sg-dashboard-main a[href="/world-news"]',
    );
    const newsSection = newsLink?.closest("section");
    if (!newsSection?.parentElement) return;

    const mount = document.createElement("div");
    mount.dataset.mobileMarketMoversHost = "true";
    mount.className = "mt-7 min-w-0 lg:hidden";
    newsSection.parentElement.insertBefore(mount, newsSection);
    setHost(mount);

    return () => {
      mount.remove();
    };
  }, []);

  if (!host) return null;
  return createPortal(
    <MarketMoversSection canUsePremium={canUsePremium} />,
    host,
  );
}
