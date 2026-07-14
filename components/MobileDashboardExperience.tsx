"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { DashboardPortfolioSelector } from "@/components/DashboardPortfolioSelector";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import { StockLogo } from "@/components/StockLogo";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";

export type MobileDashboardRanking = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

export type MobileDashboardNewsArticle = {
  id: string;
  title: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  affectedTickers: string[];
};

type PortfolioChartState = {
  displayState: "ready" | "limited" | "error_with_cache" | "error_no_cache" | null;
  isFlat: boolean;
  latestSnapshotAt: string | null;
};

type Props = {
  firstName?: string;
  isAuthenticated: boolean;
  canUsePremium: boolean;
  portfolioId: string | null;
  portfolios: Array<{ id: string; name: string }>;
  summary: PortfolioHealthSummary | null;
  portfolioChart: Partial<Record<TimeRange, ChartPoint[]>>;
  portfolioChartState: PortfolioChartState;
  valuationState: "exact" | "partial" | "unavailable" | "empty";
  missingPriceTickers: string[];
  opportunities: DashboardPortfolioOpportunity[];
  rankings: MobileDashboardRanking[];
  rankingsLocked: boolean;
  marketChart: Partial<Record<TimeRange, ChartPoint[]>>;
  marketValue: number | null;
  marketChangePct: number | null;
  news: MobileDashboardNewsArticle[];
  newsStatus: "ok" | "error" | "locked";
};

const PANELS = ["Portfolio", "What changed", "Opportunities"] as const;
const PANEL_CLIP_STYLE: CSSProperties = {
  clipPath: "inset(0 round 1.65rem)",
  WebkitMaskImage: "-webkit-radial-gradient(white, black)",
};

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: safe >= 1000 ? 0 : 2,
  }).format(safe);
}

function score(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function price(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function indexValue(value: number | null) {
  return Number.isFinite(value)
    ? Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
}

function opportunityUpdated(value?: string | null) {
  if (!value) return "Update unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update unavailable";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
}

function newsAge(value?: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function localGreeting(name?: string) {
  const hour = new Date().getHours();
  const base =
    hour < 5
      ? "Late session"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : hour < 22
            ? "Good evening"
            : "Late session";
  return name ? `${base}, ${name}` : base;
}

function marketStatus() {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6 || mins < 4 * 60 || mins >= 20 * 60) {
    return "Markets closed";
  }
  if (mins < 9 * 60 + 30) return "Pre-market";
  if (mins < 16 * 60) return "Markets open";
  return "After hours";
}

function chartHasData(data: Partial<Record<TimeRange, ChartPoint[]>>) {
  return Object.values(data).some((points) => (points?.length ?? 0) > 1);
}

export function MobileDashboardExperience({
  firstName,
  isAuthenticated,
  canUsePremium,
  portfolioId,
  portfolios,
  summary,
  portfolioChart,
  portfolioChartState,
  valuationState,
  missingPriceTickers,
  opportunities,
  rankings,
  rankingsLocked,
  marketChart,
  marketValue,
  marketChangePct,
  news,
  newsStatus,
}: Props) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);
  const [activePanel, setActivePanel] = useState(0);
  const [greeting, setGreeting] = useState("Your StockGPT briefing");
  const [market, setMarket] = useState("Market status");

  useEffect(() => {
    setGreeting(localGreeting(firstName));
    setMarket(marketStatus());
    return () => {
      if (scrollFrame.current != null) {
        window.cancelAnimationFrame(scrollFrame.current);
      }
    };
  }, [firstName]);

  const topRanked = rankings[0];
  const portfolioHref = portfolioId
    ? `/portfolio?portfolio=${encodeURIComponent(portfolioId)}`
    : "/portfolio";
  const askContext = {
    contextType: "dashboard" as const,
    ...(portfolioId ? { portfolioId } : {}),
  };

  const briefingLine = useMemo(() => {
    if (!summary) {
      return topRanked?.ticker
        ? `${topRanked.ticker} leads the rankings · build a portfolio for personal intelligence`
        : "Build or import a portfolio to unlock personal intelligence";
    }
    if (valuationState === "unavailable") {
      return "Portfolio prices need refreshing · last-known intelligence remains available";
    }
    if (valuationState === "partial") {
      return `Portfolio value is estimated${topRanked?.ticker ? ` · ${topRanked.ticker} remains #1` : ""}`;
    }
    const health = canUsePremium
      ? `${summary.label.toLowerCase()} portfolio`
      : "portfolio connected";
    const review =
      canUsePremium && summary.actionAlerts > 0
        ? `${summary.actionAlerts} review${summary.actionAlerts === 1 ? "" : "s"} worth checking`
        : topRanked?.ticker
          ? `${topRanked.ticker} remains #1`
          : "rankings ready";
    return `${health} · ${review}`;
  }, [canUsePremium, summary, topRanked?.ticker, valuationState]);

  const changedItems = useMemo(() => {
    if (!summary) {
      return [
        "Build or import a portfolio to receive a personal daily briefing.",
        topRanked?.ticker
          ? `${topRanked.ticker} is currently the highest-ranked StockGPT stock.`
          : "The latest rankings are not available yet.",
      ];
    }

    return [
      valuationState === "unavailable"
        ? "Portfolio value is temporarily unavailable while prices refresh."
        : valuationState === "partial"
          ? "Portfolio value is estimated while missing prices refresh."
          : `Portfolio total return is ${summary.totalPnl >= 0 ? "+" : ""}${summary.totalPnlPct.toFixed(1)}%.`,
      canUsePremium
        ? summary.actionAlerts > 0
          ? `${summary.actionAlerts} holding review${summary.actionAlerts === 1 ? " is" : "s are"} available; none is marked urgent.`
          : "No major portfolio review alerts are active right now."
        : "Portfolio health and review priorities are available with an active subscription.",
      `${summary.holdingsCount} holding${summary.holdingsCount === 1 ? "" : "s"} across ${summary.sectorCount} sector${summary.sectorCount === 1 ? "" : "s"}.`,
      topRanked?.ticker
        ? `${topRanked.ticker} remains the highest-ranked stock in the current table.`
        : "The latest rankings are not available yet.",
    ];
  }, [canUsePremium, summary, topRanked?.ticker, valuationState]);

  const updateActivePanel = useCallback(() => {
    const track = carouselRef.current;
    if (!track) return;
    if (scrollFrame.current != null) {
      window.cancelAnimationFrame(scrollFrame.current);
    }
    scrollFrame.current = window.requestAnimationFrame(() => {
      const children = Array.from(track.children) as HTMLElement[];
      if (!children.length) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      children.forEach((child, index) => {
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const nextDistance = Math.abs(childCenter - center);
        if (nextDistance < distance) {
          distance = nextDistance;
          nearest = index;
        }
      });
      setActivePanel(nearest);
    });
  }, []);

  const showPanel = useCallback((index: number) => {
    const track = carouselRef.current;
    const child = track?.children[index] as HTMLElement | undefined;
    if (!track || !child) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollTo({
      left: child.offsetLeft,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    setActivePanel(index);
  }, []);

  function handleCarouselKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showPanel(
      Math.max(
        0,
        Math.min(
          PANELS.length - 1,
          activePanel + (event.key === "ArrowRight" ? 1 : -1),
        ),
      ),
    );
  }

  const portfolioChartReady =
    (portfolioChartState.displayState === "ready" ||
      portfolioChartState.displayState === "error_with_cache") &&
    !portfolioChartState.isFlat &&
    chartHasData(portfolioChart);

  return (
    <div className="min-w-0 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:hidden">
      <section className="relative overflow-hidden border-b border-[#ddb159]/15 px-1 pb-4 pt-1">
        <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-[#ddb159]/10 blur-3xl" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-luxury text-[12px] font-semibold text-[#ddb159]">
                {greeting}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ddb159]/18 bg-[#072116]/55 px-2 py-1 text-[9px] font-bold text-[#faf6f0]/62">
                <span className="size-1.5 rounded-full bg-[#faf6f0]/38" />
                {market}
              </span>
            </div>
            <h1 className="mt-2 text-[22px] font-black leading-[1.02] tracking-[-0.045em] text-[#faf6f0] min-[390px]:text-[24px]">
              Today at a glance
            </h1>
            <p className="mt-1.5 max-w-[31rem] text-[11px] font-semibold leading-[1.45] text-[#faf6f0]/56">
              {briefingLine}
            </p>
          </div>
          <AskStockGPTButton
            canUseAskStockGPT={canUsePremium}
            isAuthenticated={isAuthenticated}
            label="Ask StockGPT"
            context={askContext}
            compact
            className="mt-0.5 h-10 px-3 text-[10px] hover:!translate-y-0 max-[350px]:px-2 max-[350px]:text-[9px]"
          />
        </div>
      </section>

      <section aria-label="Dashboard intelligence" className="mt-4 min-w-0">
        <div className="overflow-hidden rounded-[1.65rem]">
          <div
            ref={carouselRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Portfolio intelligence panels"
            tabIndex={0}
            onScroll={updateActivePanel}
            onKeyDown={handleCarouselKey}
            className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
          >
            <article
              role="group"
              aria-roledescription="slide"
              aria-label="1 of 3, Portfolio"
              style={PANEL_CLIP_STYLE}
              className="relative isolate h-[318px] w-full shrink-0 snap-start snap-always overflow-hidden rounded-[1.65rem] border border-[#ddb159]/24 bg-[linear-gradient(145deg,rgba(15,57,37,0.9),rgba(6,28,19,0.94))] p-4 text-[#faf6f0] shadow-[0_18px_38px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.045)] min-[390px]:h-[310px]"
            >
              <div className="pointer-events-none absolute -right-14 -top-14 size-40 rounded-full bg-[#ddb159]/13 blur-3xl" />
              {summary ? (
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                        Your portfolio
                      </p>
                      {/* the selector already names the portfolio — no
                         duplicate heading when it is shown */}
                      {portfolioId && portfolios.length > 1 ? (
                        <div className="mt-1.5">
                          <DashboardPortfolioSelector
                            value={portfolioId}
                            portfolios={portfolios}
                          />
                        </div>
                      ) : (
                        <h2 className="mt-1 truncate text-[18px] font-black tracking-[-0.04em]">
                          {summary.name}
                        </h2>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black text-[#072116]">
                      {canUsePremium
                        ? `Health ${summary.score}/100`
                        : "Health locked"}
                    </span>
                  </div>

                  {portfolioId && (
                    <div className="mt-1.5 flex items-center justify-end">
                      <FreshnessLabel
                        value={portfolioChartState.latestSnapshotAt}
                        compact
                      />
                    </div>
                  )}

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[34px] font-black leading-none tracking-[-0.06em]">
                        {valuationState === "unavailable"
                          ? "Value unavailable"
                          : money(summary.totalValue, summary.currency)}
                      </p>
                      {valuationState !== "unavailable" && (
                        <p
                          className={`mt-1.5 text-[13px] font-black tabular-nums ${
                            summary.totalPnl >= 0
                              ? "text-emerald-300"
                              : "text-red-200"
                          }`}
                        >
                          {money(summary.totalPnl, summary.currency)} ·{" "}
                          {summary.totalPnl >= 0 ? "+" : ""}
                          {summary.totalPnlPct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <Link
                      href={portfolioHref}
                      className="shrink-0 rounded-full border border-[#ddb159]/22 bg-[#061b12]/55 px-3 py-2 text-[9px] font-black uppercase tracking-[0.09em] text-[#ddb159]"
                    >
                      Open →
                    </Link>
                  </div>

                  <div className="mt-3 min-h-[92px] flex-1 overflow-hidden rounded-2xl border border-white/6 bg-[#04180f]/42">
                    {portfolioChartReady ? (
                      <StockChart
                        ticker="Portfolio"
                        data={portfolioChart}
                        initialRange="MAX"
                        height={94}
                        compact
                      />
                    ) : (
                      <div className="relative flex h-[94px] items-center overflow-hidden px-4">
                        <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-[#ddb159]/24" />
                        <div className="relative rounded-xl bg-[#061b12]/82 px-3 py-2">
                          <p className="text-[10px] font-black text-[#e7c56c]">
                            {portfolioChartState.displayState === "error_no_cache"
                              ? "Chart temporarily unavailable"
                              : "Building reliable chart history"}
                          </p>
                          <p className="mt-0.5 text-[9px] font-semibold text-[#faf6f0]/45">
                            Only confirmed snapshots will be shown.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/42">
                    <span>
                      {summary.holdingsCount} holdings · {summary.sectorCount} sectors
                    </span>
                    {portfolioChartState.displayState === "error_with_cache" ? (
                      <span className="truncate text-[#e7c56c]">Last-known chart</span>
                    ) : missingPriceTickers.length > 0 &&
                      valuationState !== "unavailable" ? (
                      <span className="truncate text-[#e7c56c]">Partial prices</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                      Your portfolio
                    </p>
                    <h2 className="mt-2 text-[25px] font-black leading-tight tracking-[-0.045em]">
                      Build your first portfolio
                    </h2>
                    <p className="mt-3 max-w-[18rem] text-[12px] font-semibold leading-5 text-[#faf6f0]/58">
                      Add holdings or import a Trading 212 CSV to unlock personal value,
                      risk and opportunity intelligence.
                    </p>
                  </div>
                  <Link
                    href="/portfolio?builder=1"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[11px] font-black text-[#072116]"
                  >
                    Build portfolio
                  </Link>
                </div>
              )}
            </article>

            <article
              role="group"
              aria-roledescription="slide"
              aria-label="2 of 3, What changed"
              style={PANEL_CLIP_STYLE}
              className="isolate h-[318px] w-full shrink-0 snap-start snap-always overflow-hidden rounded-[1.65rem] border border-[#ddb159]/20 bg-[linear-gradient(150deg,rgba(10,45,30,0.84),rgba(5,26,17,0.94))] p-4 text-[#faf6f0] shadow-[0_18px_38px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)] min-[390px]:h-[310px]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Daily briefing
                  </p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[-0.045em]">
                    What changed
                  </h2>
                </div>
                <FreshnessLabel value={topRanked?.updated_at} compact />
              </div>
              <ul className="mt-3 divide-y divide-[#ddb159]/10">
                {changedItems.slice(0, 4).map((item) => (
                  <li
                    key={item}
                    className="py-2.5 text-[11px] font-semibold leading-[1.45] text-[#faf6f0]/66"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/notifications"
                className="mt-2 inline-flex min-h-10 items-center text-[10px] font-black uppercase tracking-[0.09em] text-[#ddb159]"
              >
                Review alerts →
              </Link>
            </article>

            <article
              role="group"
              aria-roledescription="slide"
              aria-label="3 of 3, Opportunities"
              style={PANEL_CLIP_STYLE}
              className="isolate flex h-[318px] w-full shrink-0 snap-start snap-always flex-col overflow-hidden rounded-[1.65rem] border border-[#ddb159]/20 bg-[linear-gradient(145deg,rgba(13,50,33,0.84),rgba(5,25,17,0.94))] p-4 text-[#faf6f0] shadow-[0_18px_38px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)] min-[390px]:h-[310px]"
            >
              <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Portfolio intelligence
                  </p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[-0.045em]">
                    Ideas worth reviewing
                  </h2>
                </div>
                <Link
                  href="/rankings"
                  className="shrink-0 rounded-full border border-[#ddb159]/20 px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
                >
                  Review all →
                </Link>
              </div>

              <div className="mt-3 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                {!canUsePremium ? (
                  <div className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/55 p-4">
                    <p className="text-[13px] font-black">Premium analysis locked</p>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/55">
                      Unlock portfolio-fit research and health analysis.
                    </p>
                    <Link
                      href="/subscription"
                      className="mt-4 inline-flex h-10 items-center rounded-full bg-[#ddb159] px-4 text-[10px] font-black text-[#072116]"
                    >
                      View plans
                    </Link>
                  </div>
                ) : !summary ? (
                  <div className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/55 p-4">
                    <p className="text-[13px] font-black">Build a portfolio first</p>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/55">
                      Portfolio-fit opportunities need your holdings and allocation context.
                    </p>
                    <Link
                      href="/portfolio?builder=1"
                      className="mt-4 inline-flex h-10 items-center rounded-full bg-[#ddb159] px-4 text-[10px] font-black text-[#072116]"
                    >
                      Build portfolio
                    </Link>
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/55 p-4">
                    <p className="text-[13px] font-black">
                      No strong opportunities right now
                    </p>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/55">
                      StockGPT is not forcing an idea when the current setup is not strong
                      enough.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#ddb159]/10 pb-2">
                    {opportunities.slice(0, 2).map((item) => (
                      <Link
                        key={`${item.category}-${item.ticker}`}
                        href={`/stock/${item.ticker}`}
                        className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 py-3 first:pt-0"
                      >
                        <StockLogo
                          ticker={item.ticker}
                          company={item.company}
                          size={36}
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[14px] font-black">
                              {item.ticker}{" "}
                              <span className="text-[10px] text-[#faf6f0]/42">
                                {item.company}
                              </span>
                            </p>
                            <span className="shrink-0 text-[10px] font-black tabular-nums text-[#ddb159]">
                              {score(item.score)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
                            {item.category}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold leading-[1.45] text-[#faf6f0]/60">
                            {item.reason}
                          </p>
                          <p
                            suppressHydrationWarning
                            className="mt-1 text-[8.5px] font-bold text-[#faf6f0]/38"
                          >
                            {opportunityUpdated(item.updatedAt)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </div>
        </div>

        <div
          className="mt-3 flex items-center justify-center gap-2"
          aria-label={`Panel ${activePanel + 1} of ${PANELS.length}`}
        >
          {PANELS.map((panel, index) => (
            <button
              key={panel}
              type="button"
              aria-label={`Show ${panel}`}
              aria-current={activePanel === index ? "true" : undefined}
              onClick={() => showPanel(index)}
              className={`h-2 rounded-full transition-[width,background-color] duration-200 ${
                activePanel === index
                  ? "w-6 bg-[#ddb159]"
                  : "w-2 bg-[#faf6f0]/20"
              }`}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Showing {PANELS[activePanel]}
        </p>
      </section>

      <section className="mt-6 min-w-0">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              AI rankings
            </p>
            <h2 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#faf6f0]">
              Top ranked today
            </h2>
          </div>
          <Link
            href={rankingsLocked ? "/pricing?feature=rankings" : "/rankings"}
            className="min-h-10 shrink-0 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
          >
            {rankingsLocked ? "Unlock →" : "View all →"}
          </Link>
        </div>
        <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pr-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rankings.length > 0 ? (
            rankings.slice(0, 6).map((item) => {
              const destination = rankingsLocked
                ? "/pricing?feature=rankings"
                : item.ticker
                  ? `/stock/${item.ticker}`
                  : "/rankings";
              return (
                <Link
                  key={item.id}
                  href={destination}
                  className="w-[164px] shrink-0 snap-start rounded-2xl border border-[#ddb159]/18 bg-[#0b2b1d]/62 p-3 text-[#faf6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-[#ddb159] text-[12px] font-black text-[#072116]">
                      {item.rank ?? "—"}
                    </span>
                    <span className="rounded-full bg-[#ddb159]/14 px-2 py-1 text-[9px] font-black tabular-nums text-[#ddb159]">
                      {rankingsLocked ? "Locked" : score(item.score)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <StockLogo
                      ticker={item.ticker}
                      company={item.company}
                      size={28}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black">
                        {item.ticker ?? "—"}
                      </p>
                      <p className="truncate text-[9px] font-semibold text-[#faf6f0]/42">
                        {item.company ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] font-bold tabular-nums text-[#faf6f0]/62">
                    {price(item.price)}
                  </p>
                </Link>
              );
            })
          ) : (
            <div className="w-full rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d]/52 p-4 text-[11px] font-semibold text-[#faf6f0]/52">
              Rankings are not available yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 min-w-0">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Market snapshot
            </p>
            <div className="mt-1 flex items-end gap-2">
              <h2 className="text-[20px] font-black tracking-[-0.04em] text-[#faf6f0]">
                S&amp;P 500
              </h2>
              <span className="pb-0.5 text-[11px] font-black tabular-nums text-[#faf6f0]/52">
                {indexValue(marketValue)}
              </span>
            </div>
          </div>
          {marketChangePct != null && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black tabular-nums ${
                marketChangePct >= 0
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                  : "border-red-400/25 bg-red-500/10 text-red-200"
              }`}
            >
              {marketChangePct >= 0 ? "+" : ""}
              {marketChangePct.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#071d14]/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          {chartHasData(marketChart) ? (
            <StockChart
              ticker="S&P 500"
              data={marketChart}
              initialRange="1D"
              height={122}
              compact
            />
          ) : (
            <div className="flex h-[122px] items-center justify-center text-[11px] font-semibold text-[#faf6f0]/45">
              Market chart temporarily unavailable
            </div>
          )}
        </div>
      </section>

      <section className="mt-7 min-w-0">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              World news
            </p>
            <h2 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#faf6f0]">
              Latest market stories
            </h2>
          </div>
          <Link
            href="/world-news"
            className="min-h-10 shrink-0 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
          >
            View all →
          </Link>
        </div>

        {newsStatus === "locked" ? (
          <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d]/52 p-4 text-[#faf6f0]">
            <p className="text-[12px] font-black">World news is a premium feature.</p>
            <Link href="/subscription" className="mt-3 inline-flex text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]">
              View plans →
            </Link>
          </div>
        ) : newsStatus === "error" || news.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d]/52 p-4 text-[11px] font-semibold text-[#faf6f0]/52">
            Latest world news is temporarily unavailable. The full news page will refresh automatically.
          </div>
        ) : (
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pr-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {news.slice(0, 3).map((article) => (
              <a
                key={article.id}
                href={article.url ?? "/world-news"}
                target={article.url ? "_blank" : undefined}
                rel={article.url ? "noopener noreferrer" : undefined}
                className="group flex h-[244px] w-[184px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#0b2b1d]/62 text-[#faf6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-sm"
              >
                <div className="h-[92px] shrink-0 overflow-hidden bg-[#061b12]">
                  <img
                    src={article.imageUrl || "/logo.png"}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/logo.png";
                      event.currentTarget.className =
                        "h-full w-full bg-[#061b12] object-contain p-5";
                    }}
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[8.5px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
                      {article.source ?? "Market source"}
                    </p>
                    <span
                      suppressHydrationWarning
                      className="shrink-0 text-[8px] font-bold text-[#faf6f0]/38"
                    >
                      {newsAge(article.publishedAt)}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-3 text-[12px] font-black leading-[1.35] tracking-[-0.015em]">
                    {article.title}
                  </h3>
                  {article.affectedTickers.length > 0 && (
                    <div className="mt-auto flex gap-1 pt-2">
                      {article.affectedTickers.slice(0, 2).map((ticker) => (
                        <span
                          key={ticker}
                          className="rounded-full bg-[#ddb159]/12 px-2 py-0.5 text-[8px] font-black text-[#ddb159]"
                        >
                          {ticker}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="mx-1 mt-7 border-t border-[#ddb159]/14 pt-5 text-[#faf6f0]">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
          Educational research only
        </p>
        <p className="mt-2 max-w-[34rem] text-[10px] font-semibold leading-[1.55] text-[#faf6f0]/48">
          StockGPT uses AI models and third-party data to organise research. Rankings,
          scores, portfolio views and news summaries are informational only, may be
          delayed or inaccurate, and are not financial advice or broker instructions.
        </p>
        <Link
          href="/legal#disclaimer"
          className="mt-4 inline-flex min-h-10 items-center rounded-full border border-[#ddb159]/24 bg-[#0b2b1d]/52 px-4 text-[9px] font-black uppercase tracking-[0.09em] text-[#ddb159]"
        >
          About &amp; disclaimer →
        </Link>
      </section>
    </div>
  );
}
