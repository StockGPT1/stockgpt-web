"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import { StockGPTSelect } from "@/components/StockGPTSelect";
import { StockLogo } from "@/components/StockLogo";
import {
  filterDisplayablePortfolioChartData,
  isPortfolioChartRangeDisplayable,
  type PortfolioChartMeta,
} from "@/lib/portfolio-chart-health";
import {
  addCash,
  buyHoldingWithCash,
  deletePortfolio,
  logExistingHolding,
  removeHolding,
  renamePortfolio,
  trimHolding,
  updatePortfolioPreferences,
} from "@/lib/actions/portfolio-management";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";
import {
  buildPortfolioTrimRecommendation,
  type PortfolioTrimRecommendation,
} from "@/lib/portfolio-trim-recommendation";

type StockOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
  score?: number | null;
  rank: number | null;
  price: number | null;
};

type PortfolioOption = {
  id: string;
  name: string;
  currency?: string | null;
  createdAt?: string | null;
};

export type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  ticker: string | null;
  type: string;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realisedPnl: number | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
};

export type ExtendedHolding = EnrichedHolding & {
  purchaseDate?: string | null;
  source?: string | null;
  notes?: string | null;
};

type Props = {
  portfolioId: string;
  portfolios: PortfolioOption[];
  holdings: ExtendedHolding[];
  stockOptions?: StockOption[];
  transactions?: PortfolioTransaction[];
  newsArticles?: import("@/lib/news-intelligence").EnrichedNewsArticle[];
  chartData?: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta?: PortfolioChartMeta;
  portfolioMeta: {
    id: string;
    name: string;
    objective?: string | null;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
    cashBalance: number;
    cashDepositedTotal: number;
    currency?: string | null;
    createdAt?: string | null;
  };
  compactImportWidget?: ReactNode;
  displayCurrency?: string;
  usdToDisplayRate?: number;
};

type Section = "overview" | "holdings" | "add" | "activity" | "manage";
type HoldingSort = "value" | "urgent" | "worst" | "best" | "rank" | "ticker";

const RANGE_LABELS: Array<{ range: TimeRange; label: string }> = [
  { range: "1D", label: "1D" },
  { range: "1M", label: "1M" },
  { range: "6M", label: "6M" },
  { range: "1Y", label: "1Y" },
  { range: "MAX", label: "All" },
];
const DEFAULT_PORTFOLIO_RANGE = "1D" as TimeRange;

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: safe >= 1000 ? 0 : 2,
  }).format(safe);
}

function num(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function pct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function transactionLabel(type: string) {
  switch (type) {
    case "deposit":
      return "Cash deposit";
    case "withdrawal":
      return "Cash withdrawal";
    case "buy":
      return "Bought";
    case "sell":
      return "Sold";
    case "import":
      return "Import";
    case "log_existing":
      return "Logged holding";
    case "adjustment":
      return "Holding adjusted";
    case "cash_adjustment":
      return "Cash adjusted";
    default:
      return type.replace(/_/g, " ");
  }
}

function holdingUrgencyScore(holding: ExtendedHolding) {
  return holding.actionAlerts.length * 20 + holding.eventAlerts.length * 6 + (holding.daysSinceReview > 30 ? 8 : 0);
}

function buildRangeData(source: Partial<Record<TimeRange, ChartPoint[]>>) {
  return filterDisplayablePortfolioChartData(source);
}

function preferredInitialRange(data: Partial<Record<TimeRange, ChartPoint[]>>) {
  return RANGE_LABELS.find(({ range }) => hasChartPoints(data, range))?.range ?? DEFAULT_PORTFOLIO_RANGE;
}

function hasChartPoints(data: Partial<Record<TimeRange, ChartPoint[]>>, range: TimeRange) {
  return isPortfolioChartRangeDisplayable(range, data[range]);
}

function portfolioReturnBasis(summary: Pick<ReturnType<typeof buildPortfolioHealthSummary>, "totalValue" | "totalPnl" | "totalPnlPct">) {
  const pctFraction = summary.totalPnlPct / 100;
  if (Number.isFinite(pctFraction) && Math.abs(pctFraction) > 0.000001) {
    const basis = summary.totalPnl / pctFraction;
    if (Number.isFinite(basis) && basis > 0) return basis;
  }

  const fallback = summary.totalValue - summary.totalPnl;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return Math.max(summary.totalValue, 1);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveInputNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function resolveTradeCalculator(valueInput: string, priceInput: string, sharesInput: string) {
  const value = positiveInputNumber(valueInput);
  const price = positiveInputNumber(priceInput);
  const shares = positiveInputNumber(sharesInput);
  const entered = [value, price, shares].filter((item) => item !== null).length;

  if (entered < 2) {
    return { value, price, shares, entered, error: "Enter any two of value, price and shares." };
  }

  if (value !== null && price !== null && shares !== null) {
    const expectedValue = price * shares;
    const tolerance = Math.max(0.02, Math.abs(value) * 0.01);
    if (Math.abs(value - expectedValue) > tolerance) {
      return { value, price, shares, entered, error: "Value, price and shares do not match." };
    }
    return { value, price, shares, entered, error: null };
  }

  if (value !== null && price !== null) {
    return { value, price, shares: value / price, entered, error: null };
  }
  if (value !== null && shares !== null) {
    return { value, price: value / shares, shares, entered, error: null };
  }
  if (price !== null && shares !== null) {
    return { value: price * shares, price, shares, entered, error: null };
  }

  return { value, price, shares, entered, error: "Enter valid positive numbers." };
}

function chartStatusCopy(meta: PortfolioChartMeta | undefined, hasData: boolean) {
  const displayState = meta?.health.displayState;
  if (displayState === "ready") return null;
  if (hasData && (displayState === "updating" || displayState === "error_with_cache")) {
    return displayState === "error_with_cache" ? "Showing cached chart while refreshing" : "Refreshing chart";
  }
  if (displayState === "updating") return "Refreshing chart...";
  if (displayState === "building") return "Building chart history...";
  if (displayState === "repairing") return "Repairing chart history...";
  if (displayState === "empty") return "Add holdings to build chart history";
  if (displayState === "error_with_cache") return "Showing cached chart while refreshing";
  if (displayState === "error_no_cache") return "Chart history unavailable";

  const status = meta?.health.status;
  if (!meta || status === "healthy") return null;
  if (hasData && (status === "stale" || status === "sparse" || status === "rebuild_needed")) {
    return "Refreshing chart";
  }
  if (status === "stale") return "Refreshing chart...";
  if (status === "flat") return "Rebuilding chart history...";
  if (status === "missing" || status === "building" || status === "rebuild_needed" || status === "sparse") {
    return "Building chart history...";
  }
  return "Chart history unavailable";
}

function chartStateTitle(meta: PortfolioChartMeta | undefined) {
  const state = meta?.health.displayState;
  if (state === "empty") return "Add holdings to start charting";
  if (state === "repairing") return "Repairing chart history";
  if (state === "error_no_cache") return "Chart history unavailable";
  if (state === "error_with_cache") return "Refreshing chart history";
  return "Building chart history";
}

function chartStateDetail(meta: PortfolioChartMeta | undefined) {
  if (!meta) {
    return "StockGPT is preparing real portfolio snapshots. The chart will appear once enough confirmed points exist.";
  }

  const realPointCount = meta.health.realPointCount ?? 0;
  const snapshotCount = meta.health.snapshotCount ?? 0;
  const reason = meta.health.reason ? ` ${meta.health.reason}` : "";

  if (meta.health.displayState === "empty") {
    return "Add cash or holdings, then the chart will start from stored portfolio snapshots.";
  }

  return `Waiting for enough real stored points to draw a reliable chart. ${realPointCount} real chart points from ${snapshotCount} snapshots are available.${reason}`;
}

function GhostPortfolioChart({ meta }: { meta?: PortfolioChartMeta }) {
  return (
    <div className="relative h-[260px] overflow-hidden bg-[#072116]/26 px-5 py-6 sm:rounded-xl">
      <div className="absolute inset-x-4 bottom-8 h-px bg-[#ddb159]/40" />
      <div className="absolute inset-x-4 bottom-8 h-[38%] rounded-t-2xl bg-[#ddb159]/10" />
      <div className="absolute inset-x-4 top-8 grid h-[176px] grid-cols-6 items-end gap-2 opacity-45">
        {[28, 46, 38, 60, 52, 72].map((height, index) => (
          <div key={index} className="rounded-t-full bg-[#ddb159]/25" style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="relative z-10 flex h-full items-center justify-center text-center">
        <div className="max-w-md rounded-3xl border border-[#ddb159]/16 bg-[#04140c]/80 px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.20)] backdrop-blur">
          <p className="text-[15px] font-black text-[#ddb159]">{chartStateTitle(meta)}</p>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">{chartStateDetail(meta)}</p>
        </div>
      </div>
    </div>
  );
}

function SectionIcon({ section }: { section: Section }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (section === "overview") return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path {...common} d="M4 13.5 9.5 8l4 4L20 5.5" /><path {...common} d="M4 19h16" /></svg>;
  if (section === "holdings") return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path {...common} d="M4 7h16M4 12h16M4 17h16" /><path {...common} d="M8 5v14" /></svg>;
  if (section === "add") return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path {...common} d="M12 5v14M5 12h14" /><path {...common} d="M4 19h16" /></svg>;
  if (section === "activity") return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path {...common} d="M4 19V5" /><path {...common} d="M8 17v-5M13 17V7M18 17v-8" /></svg>;
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path {...common} d="M12 3v3M12 18v3M4.8 6.8l2.1 2.1M17.1 17.1l2.1 2.1M3 12h3M18 12h3M4.8 17.2l2.1-2.1M17.1 6.9l2.1-2.1" /><circle cx="12" cy="12" r="3.5" {...common} /></svg>;
}

function SectionButton({ section, active, setSection, label }: { section: Section; active: Section; setSection: (section: Section) => void; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={() => setSection(section)} className={["grid h-11 min-w-0 flex-1 place-items-center rounded-full transition sm:size-10 sm:flex-none", active === section ? "sg-metal-gold-fill" : "bg-white/[0.055] text-[#faf6f0]/56 hover:bg-white/[0.08] hover:text-[#faf6f0]"].join(" ")}>
      <SectionIcon section={section} />
    </button>
  );
}

function DesktopSectionButton({ section, active, setSection, label }: { section: Section; active: Section; setSection: (section: Section) => void; label: string }) {
  return (
    <button type="button" onClick={() => setSection(section)} className={["h-9 min-w-[104px] rounded-full px-4 text-center text-[11px] font-black uppercase tracking-[0.12em] transition", active === section ? "bg-[#ddb159] text-[#072116] shadow-[0_10px_24px_rgba(0,0,0,0.18)]" : "text-[#faf6f0]/56 hover:bg-white/[0.06] hover:text-[#faf6f0]"].join(" ")}>
      {label}
    </button>
  );
}

function PortfolioTopBar({ portfolioId, portfolios }: { portfolioId: string; portfolios: PortfolioOption[] }) {
  const router = useRouter();
  const active = portfolios.find((portfolio) => portfolio.id === portfolioId);
  const portfolioOptions = portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name, description: portfolio.createdAt ? `Created ${formatDate(portfolio.createdAt)}` : portfolio.currency ?? "USD" }));
  return (
    <div className="hidden min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2.5 backdrop-blur sm:flex sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 px-1"><p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio</p><p className="mt-0.5 truncate text-[13px] font-black text-[#faf6f0]">{active?.name ?? "Portfolio"}</p></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        {portfolios.length > 1 && <StockGPTSelect value={portfolioId} options={portfolioOptions} onChange={(nextPortfolioId) => router.push(`/portfolio?portfolio=${nextPortfolioId}`)} ariaLabel="Choose portfolio" className="min-w-[220px] sm:w-[310px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]" />}
        <Link href="/portfolio?builder=1" className="sg-metal-gold-fill inline-flex h-10 items-center justify-center rounded-full px-4 text-[11px] font-black transition hover:brightness-105">+ New</Link>
      </div>
    </div>
  );
}

function PortfolioChartHero({ portfolioId, portfolios, portfolioName, currency, summary, chartData, chartMeta, createdAt, cashBalance }: { portfolioId: string; portfolios: PortfolioOption[]; portfolioName: string; currency: string; summary: ReturnType<typeof buildPortfolioHealthSummary>; chartData: Partial<Record<TimeRange, ChartPoint[]>>; chartMeta?: PortfolioChartMeta; createdAt?: string | null; cashBalance: number }) {
  const router = useRouter();
  const rangeData = useMemo(() => buildRangeData(chartData), [chartData]);
  const [range, setRange] = useState<TimeRange>(DEFAULT_PORTFOLIO_RANGE);
  const fallbackRange = useMemo(() => preferredInitialRange(rangeData), [rangeData]);
  const activeRange = hasChartPoints(rangeData, range) ? range : fallbackRange;
  const activeRangePoints = useMemo(() => rangeData[activeRange] ?? [], [rangeData, activeRange]);
  const activeRangeHasData = activeRangePoints.length > 1;
  const chartRangeData = activeRangeHasData ? ({ [activeRange]: activeRangePoints } as Partial<Record<TimeRange, ChartPoint[]>>) : ({ [activeRange]: [] } as Partial<Record<TimeRange, ChartPoint[]>>);
  const availableRanges = RANGE_LABELS.filter(({ range: itemRange }) => hasChartPoints(rangeData, itemRange));
  const chartStatus = chartStatusCopy(chartMeta, activeRangeHasData);
  const activeRangeSignature = useMemo(
    () => activeRangePoints.map((point) => `${point.date}:${point.close}:${point.basis ?? ""}:${point.pnl ?? ""}:${point.pnlPct ?? ""}`).join(";"),
    [activeRangePoints],
  );
  const scrubScope = [
    portfolioId,
    activeRange,
    summary.totalValue,
    summary.totalPnl,
    summary.totalPnlPct,
    activeRangeSignature,
  ].join("|");
  const [scrubState, setScrubState] = useState<{ scope: string; point: ChartPoint } | null>(null);
  const scrubPoint = scrubState?.scope === scrubScope ? scrubState.point : null;
  const handleChartScrub = useCallback((point: ChartPoint | null) => {
    setScrubState(point ? { scope: scrubScope, point } : null);
  }, [scrubScope]);
  const returnBasis = useMemo(() => portfolioReturnBasis(summary), [summary]);
  const hasScrubPoint = scrubPoint !== null && Number.isFinite(scrubPoint.close);
  const displayedValue = hasScrubPoint ? scrubPoint.close : summary.totalValue;
  const historicalReturn = hasScrubPoint && finiteNumber(scrubPoint.pnl) ? scrubPoint.pnl : null;
  const historicalReturnPct = hasScrubPoint && finiteNumber(scrubPoint.pnlPct) ? scrubPoint.pnlPct : null;
  const hasHistoricalReturn = historicalReturn !== null && historicalReturnPct !== null;
  const displayedReturn = hasHistoricalReturn ? historicalReturn : hasScrubPoint ? displayedValue - returnBasis : summary.totalPnl;
  const displayedReturnPct = hasHistoricalReturn ? historicalReturnPct : hasScrubPoint && returnBasis > 0 ? (displayedReturn / returnBasis) * 100 : summary.totalPnlPct;
  const isPositive = displayedReturn >= 0;
  const portfolioOptions = portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name, description: portfolio.createdAt ? `Created ${formatDate(portfolio.createdAt)}` : portfolio.currency ?? "USD" }));
  return (
    <section className="portfolio-chart-hero relative overflow-hidden rounded-[28px] border border-[#ddb159]/18 bg-[radial-gradient(circle_at_50%_8%,rgba(221,177,89,0.13),transparent_34%),linear-gradient(180deg,#092116_0%,#04140c_56%,#020805_100%)] text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.30)] sm:rounded-[32px]">
      <div className="relative px-5 pb-3 pt-5 text-center sm:px-6 sm:pt-6 lg:text-left">
        <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            {portfolios.length > 1 ? <><StockGPTSelect value={portfolioId} options={portfolioOptions} onChange={(nextPortfolioId) => router.push(`/portfolio?portfolio=${nextPortfolioId}`)} ariaLabel="Choose portfolio" className="mx-auto max-w-[260px] sm:hidden" buttonClassName="h-8 rounded-full border border-[#ddb159]/18 bg-transparent px-3 text-[10px] uppercase tracking-[0.16em] text-[#ddb159]" /><p className="hidden truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] sm:block">{portfolioName}</p></> : <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">{portfolioName}</p>}
            <h1 className="mt-3 text-[42px] font-black leading-none tracking-[-0.07em] sm:text-[58px] lg:text-[64px]">{money(displayedValue, currency)}</h1>
            <p className={["mt-2 text-[14px] font-black tabular-nums sm:text-[16px]", isPositive ? "text-emerald-300" : "text-red-200"].join(" ")}>{money(displayedReturn, currency)} total return · {pct(displayedReturnPct)}</p>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex"><span className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[11px] font-black text-[#072116]">Health {summary.score}/100</span><span className="hidden text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159] sm:inline">{summary.label}</span></div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"><p className="hidden text-[11px] font-semibold text-[#faf6f0]/46 sm:block">Since {formatDate(createdAt)} · contribution-adjusted portfolio performance{chartStatus ? ` · ${chartStatus}` : ""}</p><div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.07] p-1">{availableRanges.length > 0 ? availableRanges.map(({ range: itemRange, label }) => <button key={itemRange} type="button" onClick={() => setRange(itemRange)} className={["h-8 rounded-full px-3 text-[10px] font-black transition", activeRange === itemRange ? "bg-[#faf6f0] text-[#072116]" : "text-[#faf6f0]/52 hover:text-[#faf6f0]"].join(" ")}>{label}</button>) : <span className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/52">Building</span>}</div></div>
      </div>
      <div className="relative -mx-5 sm:mx-0">{activeRangeHasData ? <StockChart key={`${portfolioId}-${activeRange}-ready`} ticker="Portfolio" data={chartRangeData} initialRange={activeRange} height={260} compact color="#ddb159" mobileTransparentFrame onScrub={handleChartScrub} /> : <GhostPortfolioChart meta={chartMeta} />}</div>
      <div className="relative hidden grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:grid sm:text-left"><div className="px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Open positions</p><p className="mt-1 text-[18px] font-black">{summary.holdingsCount}</p></div><div className="px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Weighted score</p><p className="mt-1 text-[18px] font-black text-[#ddb159]">{summary.weightedAvgScore ?? "—"}</p></div><div className="px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Cash</p><p className="mt-1 text-[18px] font-black">{money(cashBalance, currency)}</p><p className="mt-0.5 text-[10px] font-bold text-[#faf6f0]/42">{summary.cashDrag.toFixed(1)}% drag</p></div></div>
    </section>
  );
}

function AddCashPanel({ portfolioId, currency, usdToDisplayRate = 1 }: { portfolioId: string; currency: string; usdToDisplayRate?: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRate = Number.isFinite(usdToDisplayRate) && usdToDisplayRate > 0 ? usdToDisplayRate : 1;
  function submit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setMessage("Enter a valid cash amount."); return; }
    setMessage("Adding cash...");
    startTransition(async () => { const result = await addCash({ portfolioId, amount: value / inputRate }); if (!result.success) { setMessage(result.error ?? "Could not add cash."); return; } setAmount(""); setMessage("Cash added."); window.setTimeout(() => router.refresh(), 120); });
  }
  return <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Cash</p><h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Add cash</h3><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><input type="number" min={0} step={10} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={currency === "USD" ? "1000" : "1000"} className="h-11 min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" /><button type="button" onClick={submit} disabled={isPending} className="h-11 rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">{isPending ? "Adding…" : "+ Add"}</button></div>{message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}</div>;
}

function AddHoldingPanel({ portfolioId, stockOptions, usdToDisplayRate = 1 }: { portfolioId: string; stockOptions: StockOption[]; usdToDisplayRate?: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [shares, setShares] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRate = Number.isFinite(usdToDisplayRate) && usdToDisplayRate > 0 ? usdToDisplayRate : 1;
  const cleanTicker = query.trim().toUpperCase();
  const exactMatch = useMemo(() => stockOptions.find((stock) => stock.ticker.toUpperCase() === cleanTicker), [cleanTicker, stockOptions]);
  const suggestions = useMemo(() => { const term = query.trim().toLowerCase(); if (!term || exactMatch) return []; return stockOptions.filter((stock) => stock.ticker.toLowerCase().includes(term) || (stock.company?.toLowerCase() ?? "").includes(term)).slice(0, 6); }, [exactMatch, query, stockOptions]);
  function selectStock(stock: StockOption) { setQuery(stock.ticker); if (stock.price && Number.isFinite(stock.price)) setEntryPrice(String(stock.price)); setMessage(null); }
  function submit() {
    const shareCount = Number(shares); const price = Number(entryPrice);
    if (!exactMatch) { setMessage("Choose a ticker from the dropdown."); return; }
    if (!Number.isFinite(shareCount) || shareCount <= 0) { setMessage("Enter the number of shares."); return; }
    if (!Number.isFinite(price) || price <= 0) { setMessage("Enter a valid average entry price."); return; }
    setMessage("Adding holding...");
    startTransition(async () => { const result = await logExistingHolding({ portfolioId, ticker: exactMatch.ticker, shares: shareCount, entryPrice: price / inputRate }); if (!result.success) { setMessage(result.error ?? "Could not add holding."); return; } setQuery(""); setShares(""); setEntryPrice(""); setMessage(`${exactMatch.ticker} added.`); window.setTimeout(() => router.refresh(), 120); });
  }
  return <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Manual holding</p><h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Add stock</h3><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="relative block min-w-0"><span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Ticker</span><input value={query} onChange={(event) => { const value = event.target.value.toUpperCase(); setQuery(value); const match = stockOptions.find((stock) => stock.ticker === value.trim()); if (match?.price) setEntryPrice(String(match.price)); }} placeholder="AAPL" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black uppercase outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" />{suggestions.length > 0 && <div className="absolute left-0 right-0 top-[68px] z-30 max-h-56 overflow-y-auto rounded-2xl border border-[#ddb159]/30 bg-white p-1 shadow-[0_16px_34px_rgba(0,0,0,0.22)]">{suggestions.map((stock) => <button key={stock.ticker} type="button" onClick={() => selectStock(stock)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl px-3 py-2 text-left hover:bg-[#ddb159]/10"><span className="min-w-0 truncate text-[12px] font-black">{stock.ticker} <span className="font-semibold text-[#072116]/45">· {stock.company}</span></span><span className="text-[10px] font-bold text-[#072116]/45">#{stock.rank ?? "—"}</span></button>)}</div>}</label><label className="block min-w-0"><span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Shares</span><input type="number" min={0} step="0.000001" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="10" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" /></label><label className="block min-w-0"><span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Avg price</span><input type="number" min={0} step="0.01" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} placeholder="0.00" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" /></label></div><button type="button" onClick={submit} disabled={isPending} className="mt-3 h-11 w-full rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">{isPending ? "Adding…" : "+ Add holding"}</button>{message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}</div>;
}

function MiniMetric({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-300" : tone === "gold" ? "text-[#ddb159]" : "text-[#faf6f0]";
  return <div className="min-w-0 rounded-xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.045] px-2.5 py-2"><p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/40">{label}</p><p className={`mt-1 truncate text-[13px] font-black leading-none ${valueClass}`}>{value}</p><p className="mt-1 truncate text-[9px] font-semibold text-[#faf6f0]/42">{sub}</p></div>;
}

function ManageHoldingModal({ portfolioId, holding, recommendation, onClose }: { portfolioId: string; holding: ExtendedHolding; recommendation: PortfolioTrimRecommendation; onClose: () => void }) {
  const router = useRouter();
  const [customPercent, setCustomPercent] = useState(recommendation.pct == null ? "" : String(Math.min(50, recommendation.pct)));
  const [buyValue, setBuyValue] = useState("");
  const [buyPrice, setBuyPrice] = useState(holding.currentPrice > 0 ? String(Number(holding.currentPrice.toFixed(2))) : "");
  const [buyShares, setBuyShares] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const buyCalculation = useMemo(() => resolveTradeCalculator(buyValue, buyPrice, buyShares), [buyValue, buyPrice, buyShares]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
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
  }, [onClose]);

  function runPlan(rawPercent: number) {
    const percent = Math.round(Number(rawPercent) * 10) / 10;
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setMessage("Enter a percentage between 1 and 100.");
      return;
    }

    setMessage("Updating holding...");
    startTransition(async () => {
      const result = await trimHolding({ portfolioId, ticker: holding.ticker, percentage: percent });
      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }
      setMessage(`${holding.ticker} trimmed by ${percent}%. Proceeds were added to cash.`);
      window.setTimeout(() => router.refresh(), 120);
      window.setTimeout(onClose, 650);
    });
  }

  function runRemove(creditCash: boolean) {
    const label = creditCash ? "close this position and credit cash" : "remove this holding without adding cash";
    if (!window.confirm(`Are you sure you want to ${label} for ${holding.ticker}?`)) return;
    setMessage("Removing holding...");
    startTransition(async () => {
      const result = creditCash
        ? await trimHolding({ portfolioId, ticker: holding.ticker, percentage: 100 })
        : await removeHolding({ portfolioId, ticker: holding.ticker, creditCash: false });
      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }
      setMessage(creditCash ? `${holding.ticker} closed.` : `${holding.ticker} removed.`);
      window.setTimeout(() => router.refresh(), 120);
      window.setTimeout(onClose, 650);
    });
  }

  function runBuyMore(mode: "cash" | "external") {
    if (buyCalculation.error || buyCalculation.value == null || buyCalculation.price == null || buyCalculation.shares == null) {
      setMessage(buyCalculation.error ?? "Enter a valid buy amount.");
      return;
    }

    setMessage(mode === "cash" ? "Buying more with cash..." : "Adding external purchase...");
    startTransition(async () => {
      const result = mode === "cash"
        ? await buyHoldingWithCash({
            portfolioId,
            ticker: holding.ticker,
            dollarAmount: buyCalculation.value ?? 0,
            entryPrice: buyCalculation.price ?? 0,
          })
        : await logExistingHolding({
            portfolioId,
            ticker: holding.ticker,
            shares: buyCalculation.shares ?? 0,
            entryPrice: buyCalculation.price ?? 0,
          });

      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }

      setMessage(
        mode === "cash"
          ? `${holding.ticker} increased using portfolio cash.`
          : `${holding.ticker} external purchase added.`,
      );
      window.setTimeout(() => router.refresh(), 120);
      window.setTimeout(onClose, 750);
    });
  }

  const reinvestment = recommendation.reinvestment;
  const buyPreview =
    buyCalculation.error == null && buyCalculation.value != null && buyCalculation.price != null && buyCalculation.shares != null
      ? `${num(buyCalculation.shares, 6)} shares at ${money(buyCalculation.price)} for ${money(buyCalculation.value)}`
      : buyCalculation.error;

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-stretch justify-center bg-[#020805]/88 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-[#faf6f0] backdrop-blur-md sm:items-center sm:p-4 lg:justify-end">
      <button type="button" aria-label="Close manage holding" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div role="dialog" aria-modal="true" aria-label={`Manage ${holding.ticker}`} className="stockgpt-manage-holding-dialog relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[#ddb159]/24 bg-[#061b12] text-[#faf6f0] shadow-[0_24px_90px_rgba(0,0,0,0.62)] sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ddb159]/14 bg-[#04140c] p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Manage holding</p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <StockLogo ticker={holding.ticker} size={38} />
              <div className="min-w-0">
                <h3 className="truncate text-[28px] font-black leading-none tracking-[-0.05em]">{holding.ticker}</h3>
                <p className="mt-1 truncate text-[12px] font-bold text-[#faf6f0]/52">{holding.company ?? "Holding"}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.045] text-xl text-[#ddb159] transition hover:bg-[#ddb159]/10">&times;</button>
        </div>
        <div className="grid min-h-0 gap-3 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric label="Value" value={money(holding.currentValue)} sub={`${num(holding.shares, 4)} sh`} />
            <MiniMetric label="Allocation" value={`${holding.currentAllocationPct.toFixed(1)}%`} sub={`target ${holding.targetAllocationPct?.toFixed(1) ?? "-"}%`} />
            <MiniMetric label="P/L" value={money(holding.totalPnLDollars)} sub={pct(holding.pnlPercent)} tone={holding.totalPnLDollars >= 0 ? "positive" : "negative"} />
            <MiniMetric label="Score" value={num(holding.score, 0)} sub={`rank #${holding.rank ?? "-"}`} tone="gold" />
          </div>
          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Recommended action</p>
            <p className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[#faf6f0]">{recommendation.label}</p>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[#faf6f0]/68">{recommendation.reason}</p>
            {reinvestment && (
              <div className="mt-3 rounded-2xl border border-[#ddb159]/16 bg-[#04140c]/80 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Reallocation candidate {reinvestment.sameSector ? "- Same sector" : "- Cross-sector fallback"}</p>
                <div className="mt-2 flex min-w-0 items-center gap-3">
                  <StockLogo ticker={reinvestment.ticker} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-black text-[#faf6f0]">{reinvestment.ticker} <span className="text-[#faf6f0]/45">- {reinvestment.company ?? "StockGPT ranked stock"}</span></p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-[#faf6f0]/50">{reinvestment.sector ?? "Unclassified sector"} - score {reinvestment.score == null ? "-" : num(reinvestment.score, 0)} - rank #{reinvestment.rank ?? "-"}</p>
                  </div>
                </div>
              </div>
            )}
            {recommendation.pct == null ? (
              <p className="mt-3 rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/72 px-3 py-2 text-[11px] font-bold text-[#faf6f0]/55">No automatic action is suggested for this holding.</p>
            ) : (
              <button type="button" disabled={isPending} onClick={() => runPlan(recommendation.pct ?? 0)} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f3d98b,#d6ae4d_55%,#a77d2e)] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#061b12] shadow-[0_14px_30px_rgba(0,0,0,0.2)] disabled:opacity-50">Trim to cash</button>
            )}
          </div>
          <div className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/42">Custom adjustment</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input type="number" min={1} max={100} step={0.5} value={customPercent} onChange={(event) => setCustomPercent(event.target.value)} placeholder="Enter %" className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#020805]/55 px-3 text-[14px] font-black text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/32 focus:border-[#ddb159]" />
              <button type="button" disabled={isPending} onClick={() => runPlan(Number(customPercent))} className="h-11 rounded-2xl bg-[linear-gradient(180deg,#f3d98b,#d6ae4d_55%,#a77d2e)] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#061b12] disabled:opacity-50">Apply %</button>
            </div>
          </div>
          <div className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/42">Buy more calculator</p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-[#faf6f0]/50">Enter any two fields. StockGPT calculates the third and merges into the existing position.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="min-w-0">
                <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Value</span>
                <input type="number" min={0} step="0.01" value={buyValue} onChange={(event) => setBuyValue(event.target.value)} placeholder="500" className="h-10 w-full rounded-2xl border border-[#ddb159]/18 bg-[#020805]/55 px-3 text-[13px] font-black text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/32 focus:border-[#ddb159]" />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Price</span>
                <input type="number" min={0} step="0.01" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} placeholder="0.00" className="h-10 w-full rounded-2xl border border-[#ddb159]/18 bg-[#020805]/55 px-3 text-[13px] font-black text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/32 focus:border-[#ddb159]" />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Shares</span>
                <input type="number" min={0} step="0.000001" value={buyShares} onChange={(event) => setBuyShares(event.target.value)} placeholder="0" className="h-10 w-full rounded-2xl border border-[#ddb159]/18 bg-[#020805]/55 px-3 text-[13px] font-black text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/32 focus:border-[#ddb159]" />
              </label>
            </div>
            <p className={["mt-2 rounded-2xl px-3 py-2 text-[11px] font-bold", buyCalculation.error ? "bg-red-500/10 text-red-200" : "bg-[#061b12]/72 text-[#faf6f0]/58"].join(" ")}>
              {buyPreview}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={isPending || Boolean(buyCalculation.error)} onClick={() => runBuyMore("cash")} className="h-10 rounded-2xl border border-[#ddb159]/30 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-50">Buy more with cash</button>
              <button type="button" disabled={isPending || Boolean(buyCalculation.error)} onClick={() => runBuyMore("external")} className="h-10 rounded-2xl border border-[#ddb159]/16 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/62 disabled:opacity-50">Add external purchase</button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={isPending} onClick={() => runRemove(true)} className="h-11 rounded-2xl border border-red-400/30 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-red-200 disabled:opacity-50">Close + credit cash</button>
            <button type="button" disabled={isPending} onClick={() => runRemove(false)} className="h-11 rounded-2xl border border-[#ddb159]/16 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/55 disabled:opacity-50">Remove only</button>
          </div>
          {message && <p className="rounded-2xl bg-[#faf6f0]/[0.055] px-3 py-2 text-[11px] font-bold text-[#faf6f0]/62">{message}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HoldingCell({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : tone === "gold" ? "text-[#8a641a]" : "text-[#072116]";
  return <div className="min-w-0 lg:text-right"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#072116]/36 lg:hidden">{label}</p><p className={`truncate text-[13px] font-black tabular-nums ${valueClass}`}>{value}</p>{sub && <p className="mt-0.5 truncate text-[10px] font-bold tabular-nums text-[#072116]/50">{sub}</p>}</div>;
}

function HoldingsRow({ portfolioId, holding, currency, riskTolerance, stockOptions, heldTickers }: { portfolioId: string; holding: ExtendedHolding; currency: string; riskTolerance: string | null; stockOptions: StockOption[]; heldTickers: Set<string> }) {
  const [open, setOpen] = useState(false);
  const isPositive = holding.totalPnLDollars >= 0;
  const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));
  const trimRecommendation = useMemo(() => buildPortfolioTrimRecommendation(holding, riskTolerance, stockOptions, heldTickers), [holding, riskTolerance, stockOptions, heldTickers]);
  return <div className="group relative overflow-hidden border-b border-[#072116]/8 bg-[#faf6f0] text-[#072116] transition hover:bg-white lg:rounded-2xl lg:border lg:shadow-[0_8px_22px_rgba(0,0,0,0.10)] lg:hover:border-[#ddb159]/45"><div className="absolute inset-y-0 left-0 hidden bg-[#ddb159]/10 transition group-hover:bg-[#ddb159]/16 lg:block" style={{ width: `${widthPct}%` }} /><div className="relative grid gap-2 px-3 py-2.5 lg:grid-cols-[minmax(190px,1.35fr)_minmax(96px,0.75fr)_minmax(108px,0.85fr)_minmax(76px,0.55fr)_minmax(92px,0.7fr)_minmax(112px,auto)] lg:items-center lg:px-4 lg:py-3"><div className="flex min-w-0 items-center gap-3"><StockLogo ticker={holding.ticker} size={34} /><div className="min-w-0"><p className="truncate text-[14px] font-black leading-none">{holding.ticker}</p><p className="mt-1 truncate text-[11px] font-semibold text-[#072116]/45">{holding.company ?? "Holding"}</p></div></div><HoldingCell label="Value" value={money(holding.currentValue, currency)} sub={`${num(holding.shares, 4)} sh`} /><HoldingCell label="Net P/L" value={money(holding.totalPnLDollars, currency)} sub={pct(holding.pnlPercent)} tone={isPositive ? "positive" : "negative"} /><HoldingCell label="%" value={`${holding.currentAllocationPct.toFixed(1)}%`} sub={`target ${holding.targetAllocationPct?.toFixed(1) ?? "-"}%`} /><HoldingCell label="AI" value={num(holding.score, 0)} sub={`#${holding.rank ?? "-"}`} tone="gold" /><div className="flex min-w-0 justify-start lg:justify-end"><button type="button" onClick={() => setOpen(true)} className="h-9 w-full rounded-full bg-[#072116] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 sm:w-auto lg:min-w-[104px]">Manage</button></div></div>{open && <ManageHoldingModal portfolioId={portfolioId} holding={holding} recommendation={trimRecommendation} onClose={() => setOpen(false)} />}</div>;
}

function HoldingsPanel({ portfolioId, holdings, currency, riskTolerance, stockOptions, preview = false }: { portfolioId: string; holdings: ExtendedHolding[]; currency: string; riskTolerance: string | null; stockOptions: StockOption[]; preview?: boolean }) {
  const [sort, setSort] = useState<HoldingSort>("value");
  const heldTickers = useMemo(() => new Set(holdings.map((holding) => holding.ticker.toUpperCase())), [holdings]);
  const sortOptions = [{ value: "value", label: "Highest value" }, { value: "urgent", label: "Most urgent" }, { value: "worst", label: "Worst P/L" }, { value: "best", label: "Best P/L" }, { value: "rank", label: "Best rank" }, { value: "ticker", label: "Ticker A-Z" }];
  const sortedHoldings = useMemo(() => { const next = [...holdings]; next.sort((a, b) => { if (sort === "urgent") return holdingUrgencyScore(b) - holdingUrgencyScore(a); if (sort === "value") return b.currentValue - a.currentValue; if (sort === "worst") return a.pnlPercent - b.pnlPercent; if (sort === "best") return b.pnlPercent - a.pnlPercent; if (sort === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999); return a.ticker.localeCompare(b.ticker); }); return next; }, [holdings, sort]);
  return <section className="grid gap-3"><div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">{preview ? "Top holdings" : "Holdings"}</p><p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">Rows show value, P/L, allocation, AI score and a manage action.</p></div>{!preview && <div className="grid gap-2 sm:flex sm:justify-end"><StockGPTSelect value={sort} options={sortOptions} onChange={(value) => setSort(value as HoldingSort)} ariaLabel="Sort holdings" className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]" /></div>}</div>{holdings.length === 0 ? <div className="rounded-3xl border border-dashed border-[#ddb159]/24 bg-[#061b12]/72 p-6 text-center text-[#faf6f0]"><p className="text-[24px] font-black tracking-[-0.05em]">No holdings yet.</p><p className="mx-auto mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#faf6f0]/52">Use Add / Import to add cash, log holdings or import from Trading 212.</p></div> : <div className="grid gap-2">{!preview && <div className="hidden grid-cols-[minmax(190px,1.35fr)_minmax(96px,0.75fr)_minmax(108px,0.85fr)_minmax(76px,0.55fr)_minmax(92px,0.7fr)_minmax(112px,auto)] px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38 lg:grid"><span>Asset</span><span className="text-right">Value</span><span className="text-right">Net P/L</span><span className="text-right">%</span><span className="text-right">AI</span><span className="text-right">Action</span></div>}{sortedHoldings.map((holding) => <HoldingsRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} riskTolerance={riskTolerance} stockOptions={stockOptions} heldTickers={heldTickers} />)}</div>}</section>;
}

function ManagePanel({
  portfolioId,
  portfolioName,
  objective,
  riskTolerance,
  timeHorizon,
}: {
  portfolioId: string;
  portfolioName: string;
  objective?: string | null;
  riskTolerance?: string | null;
  timeHorizon?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(portfolioName);
  const [objectiveValue, setObjectiveValue] = useState(objective ?? "balanced");
  const [riskValue, setRiskValue] = useState(riskTolerance ?? "moderate");
  const [horizonValue, setHorizonValue] = useState(timeHorizon ?? "medium");
  const [message, setMessage] = useState<string | null>(null);
  const [isRenaming, startRenaming] = useTransition();
  const [isSavingPrefs, startSavingPrefs] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function saveName() {
    const cleanName = name.trim();
    if (!cleanName) {
      setMessage("Portfolio name cannot be empty.");
      return;
    }

    setMessage("Saving name...");
    startRenaming(async () => {
      const result = await renamePortfolio({ portfolioId, name: cleanName });
      if (!result.success) {
        setMessage(result.error ?? "Could not rename portfolio.");
        return;
      }
      setMessage("Portfolio renamed.");
      window.setTimeout(() => router.refresh(), 120);
    });
  }

  function savePreferences() {
    setMessage("Saving preferences...");
    startSavingPrefs(async () => {
      const result = await updatePortfolioPreferences({
        portfolioId,
        objective: objectiveValue as "growth" | "income" | "balanced" | "capital_preservation" | "watchlist",
        riskTolerance: riskValue as "conservative" | "moderate" | "aggressive",
        timeHorizon: horizonValue as "short" | "medium" | "long",
      });

      if (!result.success) {
        setMessage(result.error ?? "Could not save preferences.");
        return;
      }

      setMessage("Preferences saved.");
      window.setTimeout(() => router.refresh(), 120);
    });
  }

  function runDelete() {
    if (!window.confirm(`Delete "${portfolioName}"? This removes this portfolio and its holdings only.`)) return;
    startDeleting(async () => {
      const result = await deletePortfolio({ portfolioId });
      if (!result.success) {
        setMessage(result.error ?? "Could not delete portfolio.");
        return;
      }
      router.push("/portfolio");
      router.refresh();
    });
  }

  const objectiveOptions = [
    { value: "growth", label: "Growth", description: "Prioritise higher upside names." },
    { value: "income", label: "Income", description: "Prefer steadier cash-generating holdings." },
    { value: "balanced", label: "Balanced", description: "Blend growth and risk control." },
    { value: "capital_preservation", label: "Preservation", description: "Reduce concentration and drawdown risk." },
    { value: "watchlist", label: "Watchlist", description: "Track ideas without aggressive scoring." },
  ];
  const riskOptions = [
    { value: "conservative", label: "Conservative", description: "Lower volatility and concentration." },
    { value: "moderate", label: "Moderate", description: "Balanced risk and return." },
    { value: "aggressive", label: "Aggressive", description: "Higher tolerance for volatility." },
  ];
  const horizonOptions = [
    { value: "short", label: "Short", description: "Under 1 year." },
    { value: "medium", label: "Medium", description: "1 to 5 years." },
    { value: "long", label: "Long", description: "5+ years." },
  ];
  const preferencesUnchanged =
    objectiveValue === (objective ?? "balanced") &&
    riskValue === (riskTolerance ?? "moderate") &&
    horizonValue === (timeHorizon ?? "medium");

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Manage portfolio</p>
        <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Rename or delete</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="h-11 min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none focus:border-[#ddb159]" />
          <button type="button" onClick={saveName} disabled={isRenaming || name.trim() === portfolioName.trim()} className="h-11 rounded-2xl bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] disabled:opacity-60">{isRenaming ? "Saving..." : "Rename"}</button>
          <button type="button" onClick={runDelete} disabled={isDeleting} className="h-11 rounded-2xl border border-red-500/35 px-5 text-[11px] font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-60">{isDeleting ? "Deleting..." : "Delete"}</button>
        </div>
      </div>
      <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Portfolio intelligence</p>
        <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Objective, risk and horizon</h3>
        <p className="mt-1 text-[12px] font-semibold leading-5 text-[#072116]/50">These settings guide portfolio health scoring, alerts and trim recommendations.</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <StockGPTSelect value={objectiveValue} options={objectiveOptions} onChange={setObjectiveValue} ariaLabel="Portfolio objective" buttonClassName="h-11 rounded-2xl bg-white text-[#072116]" />
          <StockGPTSelect value={riskValue} options={riskOptions} onChange={setRiskValue} ariaLabel="Risk tolerance" buttonClassName="h-11 rounded-2xl bg-white text-[#072116]" />
          <StockGPTSelect value={horizonValue} options={horizonOptions} onChange={setHorizonValue} ariaLabel="Time horizon" buttonClassName="h-11 rounded-2xl bg-white text-[#072116]" />
        </div>
        <button type="button" onClick={savePreferences} disabled={isSavingPrefs || preferencesUnchanged} className="mt-3 h-11 rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">{isSavingPrefs ? "Saving..." : "Save preferences"}</button>
      </div>
      {message && <p className="rounded-xl bg-[#faf6f0] px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}
    </div>
  );
}

function ActivityPanel({ transactions, currency }: { transactions: PortfolioTransaction[]; currency: string }) {
  if (transactions.length === 0) return <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]"><p className="text-[16px] font-black">No activity yet.</p><p className="mt-1 text-[12px] font-semibold text-[#072116]/55">Imports, cash deposits and manual holdings will show here.</p></div>;
  return <div className="grid gap-2">{transactions.slice(0, 20).map((transaction) => <div key={transaction.id} className="grid gap-2 rounded-2xl bg-[#faf6f0] px-3 py-3 text-[#072116] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-[13px] font-black">{transactionLabel(transaction.type)}{transaction.ticker ? ` · ${transaction.ticker}` : ""}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/45">{formatDate(transaction.createdAt)}{transaction.notes ? ` · ${transaction.notes}` : ""}</p></div><div className="flex flex-wrap gap-2 sm:justify-end">{transaction.shares != null && <span className="rounded-full bg-[#072116]/6 px-2 py-1 text-[10px] font-bold text-[#072116]/60">{num(transaction.shares, 4)} shares</span>}{transaction.amount != null && <span className="rounded-full bg-[#ddb159]/16 px-2 py-1 text-[10px] font-black text-[#8a641a]">{money(transaction.amount, transaction.currency ?? currency)}</span>}</div></div>)}</div>;
}

export function PortfolioCommandCentreRevolut({ portfolioId, portfolios, holdings, stockOptions = [], transactions = [], chartData = {}, chartMeta, portfolioMeta, compactImportWidget, displayCurrency, usdToDisplayRate = 1 }: Props) {
  const [section, setSection] = useState<Section>("overview");
  const currency = displayCurrency ?? portfolioMeta.currency ?? "USD";
  const summary = buildPortfolioHealthSummary({ id: portfolioMeta.id, name: portfolioMeta.name, currency, riskTolerance: portfolioMeta.riskTolerance, holdings, transactions, cashBalance: portfolioMeta.cashBalance, cashDepositedTotal: portfolioMeta.cashDepositedTotal });
  const topHoldings = useMemo(() => [...holdings].sort((a, b) => b.currentValue - a.currentValue).slice(0, 5), [holdings]);
  return <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden"><PortfolioTopBar portfolioId={portfolioId} portfolios={portfolios} /><div className="portfolio-section-nav hidden min-w-0 justify-center gap-1 overflow-x-auto rounded-full border border-white/8 bg-black/18 p-1.5 lg:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><DesktopSectionButton section="overview" active={section} setSection={setSection} label="Overview" /><DesktopSectionButton section="holdings" active={section} setSection={setSection} label="Holdings" /><DesktopSectionButton section="add" active={section} setSection={setSection} label="Add" /><DesktopSectionButton section="activity" active={section} setSection={setSection} label="Activity" /><DesktopSectionButton section="manage" active={section} setSection={setSection} label="Manage" /></div>{section === "overview" && <PortfolioChartHero portfolioId={portfolioId} portfolios={portfolios} portfolioName={portfolioMeta.name} currency={currency} summary={summary} chartData={chartData} chartMeta={chartMeta} createdAt={portfolioMeta.createdAt} cashBalance={portfolioMeta.cashBalance} />}<div className="portfolio-section-nav flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1.5 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><SectionButton section="overview" active={section} setSection={setSection} label="Overview" /><SectionButton section="holdings" active={section} setSection={setSection} label="Holdings" /><SectionButton section="add" active={section} setSection={setSection} label="Add / Import" /><SectionButton section="activity" active={section} setSection={setSection} label="Activity" /><SectionButton section="manage" active={section} setSection={setSection} label="Manage" /></div>{section === "overview" && <section className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,310px)]"><HoldingsPanel portfolioId={portfolioId} holdings={topHoldings} currency={currency} riskTolerance={portfolioMeta.riskTolerance} stockOptions={stockOptions} preview /><div className="grid content-start gap-3"><div className="rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 text-[#faf6f0]"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Health drivers</p><div className="mt-3 grid grid-cols-2 gap-2"><MiniMetric label="Holdings" value={String(summary.holdingsCount)} sub={`${summary.sectorCount} sectors`} /><MiniMetric label="Cash" value={money(portfolioMeta.cashBalance, currency)} sub={`${summary.cashDrag.toFixed(1)}% drag`} /><MiniMetric label="Alerts" value={String(summary.actionAlerts)} sub={`${summary.eventAlerts} events`} tone={summary.actionAlerts > 0 ? "negative" : "positive"} /><MiniMetric label="Largest" value={`${summary.largestPositionPct.toFixed(1)}%`} sub="position" tone={summary.largestPositionPct > 30 ? "negative" : "positive"} /></div></div><p className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/72 p-4 text-[12px] font-semibold leading-5 text-[#faf6f0]/52">{summary.explanation}</p></div></section>}{section === "holdings" && <HoldingsPanel portfolioId={portfolioId} holdings={holdings} currency={currency} riskTolerance={portfolioMeta.riskTolerance} stockOptions={stockOptions} />}{section === "add" && <section className="grid gap-3 xl:grid-cols-[0.8fr_1fr_0.9fr]"><AddCashPanel portfolioId={portfolioId} currency={currency} usdToDisplayRate={usdToDisplayRate} /><AddHoldingPanel portfolioId={portfolioId} stockOptions={stockOptions} usdToDisplayRate={usdToDisplayRate} /><div className="min-w-0">{compactImportWidget}</div></section>}{section === "activity" && <ActivityPanel transactions={transactions} currency={currency} />}{section === "manage" && <ManagePanel portfolioId={portfolioId} portfolioName={portfolioMeta.name} objective={portfolioMeta.objective} riskTolerance={portfolioMeta.riskTolerance} timeHorizon={portfolioMeta.timeHorizon} />}<p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">⚠️ StockGPT portfolio alerts and health scores are generated from rankings, diagnostics, portfolio data, price action and recent news. They are research tools, not financial advice.</p></div>;
}
