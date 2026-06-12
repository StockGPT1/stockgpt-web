"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import { StockGPTSelect } from "@/components/StockGPTSelect";
import { StockLogo } from "@/components/StockLogo";
import {
  addCash,
  deletePortfolio,
  logExistingHolding,
  removeHolding,
  renamePortfolio,
  trimHolding,
} from "@/lib/actions/portfolio-management";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";

type StockOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
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
  portfolioMeta: {
    id: string;
    name: string;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
    cashBalance: number;
    cashDepositedTotal: number;
    currency?: string | null;
    createdAt?: string | null;
  };
  compactImportWidget?: ReactNode;
};

type Section = "overview" | "holdings" | "add" | "activity" | "manage";
type HoldingFilter = "all" | "action" | "winners" | "losers" | "oversized";
type HoldingSort = "value" | "urgent" | "worst" | "best" | "rank" | "ticker";

const RANGE_LABELS: Array<{ range: TimeRange; label: string; days: number | null }> = [
  { range: "1D", label: "1D", days: 1 },
  { range: "1M", label: "1M", days: 31 },
  { range: "6M", label: "6M", days: 183 },
  { range: "1Y", label: "1Y", days: 370 },
  { range: "MAX", label: "All", days: null },
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

function number(value: number, digits = 2) {
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

function isOversized(holding: ExtendedHolding) {
  if (!holding.targetAllocationPct) return false;
  return holding.currentAllocationPct - holding.targetAllocationPct > 3;
}

function holdingUrgencyScore(holding: ExtendedHolding) {
  return holding.actionAlerts.length * 20 + holding.eventAlerts.length * 6 + (holding.daysSinceReview > 30 ? 8 : 0);
}

function recommendedTrimPercent(holding: ExtendedHolding) {
  if (holding.recommendation.includes("Sell") || holding.recommendation.includes("Urgently")) return 100;

  if (holding.targetAllocationPct && holding.currentAllocationPct > holding.targetAllocationPct + 1) {
    const trimToTarget = ((holding.currentAllocationPct - holding.targetAllocationPct) / holding.currentAllocationPct) * 100;
    return Math.round(Math.min(60, Math.max(5, trimToTarget)));
  }

  if (holding.recommendation.includes("Trim")) return 20;
  if (holding.actionAlerts.length > 0) return 15;
  return 10;
}

function buildRangeData(
  source: Partial<Record<TimeRange, ChartPoint[]>>,
): Partial<Record<TimeRange, ChartPoint[]>> {
  return Object.fromEntries(
    Object.entries(source).filter(([, points]) => (points?.length ?? 0) > 1),
  ) as Partial<Record<TimeRange, ChartPoint[]>>;
}

function preferredInitialRange(data: Partial<Record<TimeRange, ChartPoint[]>>) {
  if ((data["1D"]?.length ?? 0) > 1) return "1D" as TimeRange;
  if ((data["1M"]?.length ?? 0) > 1) return "1M" as TimeRange;
  if ((data["6M"]?.length ?? 0) > 1) return "6M" as TimeRange;
  if ((data["1Y"]?.length ?? 0) > 1) return "1Y" as TimeRange;
  return "MAX" as TimeRange;
}

function hasChartPoints(data: Partial<Record<TimeRange, ChartPoint[]>>, range: TimeRange) {
  return (data[range]?.length ?? 0) > 1;
}

function SectionButton({ section, active, setSection, label }: { section: Section; active: Section; setSection: (section: Section) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => setSection(section)}
      className={[
        "h-10 shrink-0 rounded-full px-4 text-[11px] font-black transition",
        active === section
          ? "sg-metal-gold-fill"
          : "bg-white/[0.055] text-[#faf6f0]/56 hover:bg-white/[0.08] hover:text-[#faf6f0]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function PortfolioTopBar({ portfolioId, portfolios }: { portfolioId: string; portfolios: PortfolioOption[] }) {
  const router = useRouter();
  const active = portfolios.find((portfolio) => portfolio.id === portfolioId);
  const portfolioOptions = portfolios.map((portfolio) => ({
    value: portfolio.id,
    label: portfolio.name,
    description: portfolio.createdAt ? `Created ${formatDate(portfolio.createdAt)}` : portfolio.currency ?? "USD",
  }));

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 px-1">
        <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio</p>
        <p className="mt-0.5 truncate text-[13px] font-black text-[#faf6f0]">{active?.name ?? "Portfolio"}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        {portfolios.length > 1 && (
          <StockGPTSelect
            value={portfolioId}
            options={portfolioOptions}
            onChange={(nextPortfolioId) => router.push(`/portfolio?portfolio=${nextPortfolioId}`)}
            ariaLabel="Choose portfolio"
            className="min-w-[220px] sm:w-[310px]"
            buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"
          />
        )}
        <Link
          href="/portfolio?builder=1"
          className="sg-metal-gold-fill inline-flex h-10 items-center justify-center rounded-full px-4 text-[11px] font-black transition hover:brightness-105"
        >
          + New
        </Link>
      </div>
    </div>
  );
}

function PortfolioChartHero({
  portfolioName,
  currency,
  summary,
  chartData,
  createdAt,
}: {
  portfolioName: string;
  currency: string;
  summary: ReturnType<typeof buildPortfolioHealthSummary>;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  createdAt?: string | null;
}) {
  const rangeData = useMemo(() => buildRangeData(chartData), [chartData]);
  const [range, setRange] = useState<TimeRange>(DEFAULT_PORTFOLIO_RANGE);
  const fallbackRange = useMemo(() => preferredInitialRange(rangeData), [rangeData]);
  const activeRange = hasChartPoints(rangeData, range) ? range : fallbackRange;
  const activeRangeHasData = hasChartPoints(rangeData, activeRange);
  const chartRangeData = activeRangeHasData
    ? ({ [activeRange]: rangeData[activeRange] } as Partial<Record<TimeRange, ChartPoint[]>>)
    : ({ [activeRange]: [] } as Partial<Record<TimeRange, ChartPoint[]>>);
  const availableRanges = RANGE_LABELS.filter(
    ({ range: itemRange }) => hasChartPoints(rangeData, itemRange),
  );
  const isPositive = summary.totalPnl >= 0;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#ddb159]/18 bg-[#050706] text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.30)] sm:rounded-[32px]">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[repeating-linear-gradient(135deg,rgba(221,177,89,0.14)_0px,rgba(221,177,89,0.14)_2px,transparent_2px,transparent_9px)] opacity-50" />
      <div className="relative px-5 pb-3 pt-5 text-center sm:px-6 sm:pt-6 lg:text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">{portfolioName}</p>
            <h1 className="mt-3 text-[42px] font-black leading-none tracking-[-0.07em] sm:text-[58px] lg:text-[64px]">
              {money(summary.totalValue, currency)}
            </h1>
            <p
              className={[
                "mt-2 text-[14px] font-black tabular-nums sm:text-[16px]",
                isPositive ? "text-emerald-300" : "text-red-200",
              ].join(" ")}
            >
              {money(summary.totalPnl, currency)} total return · {pct(summary.totalPnlPct)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[11px] font-black text-[#072116]">
              Health {summary.score}/100
            </span>
            <span className="hidden text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159] sm:inline">
              {summary.label}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="hidden text-[11px] font-semibold text-[#faf6f0]/46 sm:block">
            Since {formatDate(createdAt)} · contribution-adjusted portfolio performance
          </p>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.07] p-1">
            {availableRanges.map(({ range: itemRange, label }) => (
              <button
                key={itemRange}
                type="button"
                onClick={() => setRange(itemRange)}
                className={[
                  "h-8 rounded-full px-3 text-[10px] font-black transition",
                  activeRange === itemRange
                    ? "bg-[#faf6f0] text-[#072116]"
                    : "text-[#faf6f0]/52 hover:text-[#faf6f0]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative -mx-1 sm:mx-0">
        <StockChart
          key={`${activeRange}-${activeRangeHasData ? "ready" : "pending"}`}
          ticker="Portfolio"
          data={chartRangeData}
          initialRange={activeRange}
          height={260}
          compact
        />
      </div>

      <div className="relative grid grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:text-left">
        <div className="px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Open positions</p>
          <p className="mt-1 text-[18px] font-black">{summary.holdingsCount}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Weighted score</p>
          <p className="mt-1 text-[18px] font-black text-[#ddb159]">{summary.weightedAvgScore ?? "—"}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Cash</p>
          <p className="mt-1 text-[18px] font-black">{summary.cashDrag.toFixed(1)}%</p>
        </div>
      </div>
    </section>
  );
}

function AddCashPanel({ portfolioId, currency }: { portfolioId: string; currency: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Enter a valid cash amount.");
      return;
    }

    startTransition(async () => {
      const result = await addCash({ portfolioId, amount: value });
      if (!result.success) {
        setMessage(result.error ?? "Could not add cash.");
        return;
      }
      setAmount("");
      setMessage("Cash added.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Cash</p>
      <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Add cash</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          type="number"
          min={0}
          step={10}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={currency === "USD" ? "1000" : "1000"}
          className="h-11 min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]"
        />
        <button type="button" onClick={submit} disabled={isPending} className="h-11 rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">
          {isPending ? "Adding…" : "+ Add"}
        </button>
      </div>
      {message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}
    </div>
  );
}

function AddHoldingPanel({ portfolioId, stockOptions }: { portfolioId: string; stockOptions: StockOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [shares, setShares] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cleanTicker = query.trim().toUpperCase();
  const exactMatch = useMemo(() => stockOptions.find((stock) => stock.ticker.toUpperCase() === cleanTicker), [cleanTicker, stockOptions]);
  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || exactMatch) return [];
    return stockOptions.filter((stock) => stock.ticker.toLowerCase().includes(term) || (stock.company?.toLowerCase() ?? "").includes(term)).slice(0, 6);
  }, [exactMatch, query, stockOptions]);

  function selectStock(stock: StockOption) {
    setQuery(stock.ticker);
    if (stock.price && Number.isFinite(stock.price)) setEntryPrice(String(stock.price));
    setMessage(null);
  }

  function submit() {
    const shareCount = Number(shares);
    const price = Number(entryPrice);
    if (!exactMatch) {
      setMessage("Choose a ticker from the dropdown.");
      return;
    }
    if (!Number.isFinite(shareCount) || shareCount <= 0) {
      setMessage("Enter the number of shares.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setMessage("Enter a valid average entry price.");
      return;
    }

    startTransition(async () => {
      const result = await logExistingHolding({ portfolioId, ticker: exactMatch.ticker, shares: shareCount, entryPrice: price });
      if (!result.success) {
        setMessage(result.error ?? "Could not add holding.");
        return;
      }
      setQuery("");
      setShares("");
      setEntryPrice("");
      setMessage(`${exactMatch.ticker} added.`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Manual holding</p>
      <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Add stock</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="relative block min-w-0">
          <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Ticker</span>
          <input
            value={query}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setQuery(value);
              const match = stockOptions.find((stock) => stock.ticker === value.trim());
              if (match?.price) setEntryPrice(String(match.price));
            }}
            placeholder="AAPL"
            className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black uppercase outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[68px] z-30 max-h-56 overflow-y-auto rounded-2xl border border-[#ddb159]/30 bg-white p-1 shadow-[0_16px_34px_rgba(0,0,0,0.22)]">
              {suggestions.map((stock) => (
                <button key={stock.ticker} type="button" onClick={() => selectStock(stock)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl px-3 py-2 text-left hover:bg-[#ddb159]/10">
                  <span className="min-w-0 truncate text-[12px] font-black">{stock.ticker} <span className="font-semibold text-[#072116]/45">· {stock.company}</span></span>
                  <span className="text-[10px] font-bold text-[#072116]/45">#{stock.rank ?? "—"}</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Shares</span>
          <input type="number" min={0} step="0.000001" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="10" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Avg price</span>
          <input type="number" min={0} step="0.01" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} placeholder="0.00" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" />
        </label>
      </div>
      <button type="button" onClick={submit} disabled={isPending} className="mt-3 h-11 w-full rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">
        {isPending ? "Adding…" : "+ Add holding"}
      </button>
      {message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}
    </div>
  );
}

function ManageHoldingModal({ portfolioId, holding, recommendedPercent, onClose }: { portfolioId: string; holding: ExtendedHolding; recommendedPercent: number; onClose: () => void }) {
  const router = useRouter();
  const [customPercent, setCustomPercent] = useState(String(Math.min(50, recommendedPercent)));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function runTrim(rawPercent: number) {
    const percent = Math.round(Number(rawPercent) * 10) / 10;
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setMessage("Enter a trim percentage between 1 and 100.");
      return;
    }
    startTransition(async () => {
      const result = await trimHolding({ portfolioId, ticker: holding.ticker, percentage: percent });
      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }
      setMessage(`${holding.ticker} trimmed by ${percent}%.`);
      router.refresh();
      window.setTimeout(onClose, 650);
    });
  }

  function runRemove(creditCash: boolean) {
    const label = creditCash ? "sell this entire position and credit cash" : "remove this holding without adding cash";
    if (!window.confirm(`Are you sure you want to ${label} for ${holding.ticker}?`)) return;
    startTransition(async () => {
      const result = creditCash
        ? await trimHolding({ portfolioId, ticker: holding.ticker, percentage: 100 })
        : await removeHolding({ portfolioId, ticker: holding.ticker, creditCash: false });
      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }
      setMessage(creditCash ? `${holding.ticker} sold.` : `${holding.ticker} removed.`);
      router.refresh();
      window.setTimeout(onClose, 650);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-stretch justify-center bg-[#020805]/88 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-[#faf6f0] backdrop-blur-md sm:items-center sm:p-4 lg:justify-end">
      <button type="button" aria-label="Close manage holding" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div role="dialog" aria-modal="true" aria-label={`Manage ${holding.ticker}`} className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[#ddb159]/24 bg-[#061b12] text-[#faf6f0] shadow-[0_24px_90px_rgba(0,0,0,0.62)] sm:max-h-[calc(100dvh-2rem)]">
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
            <MiniMetric label="Value" value={money(holding.currentValue)} sub={`${number(holding.shares, 4)} sh`} />
            <MiniMetric label="Allocation" value={`${holding.currentAllocationPct.toFixed(1)}%`} sub={`target ${holding.targetAllocationPct?.toFixed(1) ?? "—"}%`} />
            <MiniMetric label="P/L" value={money(holding.totalPnLDollars)} sub={pct(holding.pnlPercent)} tone={holding.totalPnLDollars >= 0 ? "positive" : "negative"} />
            <MiniMetric label="Score" value={number(holding.score, 0)} sub={`rank #${holding.rank ?? "—"}`} tone="gold" />
          </div>

          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Recommended action</p>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-[#faf6f0]/65">
              StockGPT suggests reviewing a <span className="font-black text-[#faf6f0]">{recommendedPercent}%</span> trim as a starting point. Adjust it manually below.
            </p>
            <button type="button" disabled={isPending} onClick={() => runTrim(recommendedPercent)} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f3d98b,#d6ae4d_55%,#a77d2e)] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#061b12] shadow-[0_14px_30px_rgba(0,0,0,0.2)] disabled:opacity-50">
              Apply recommended {recommendedPercent}%
            </button>
          </div>

          <div className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/42">Custom trim</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input type="number" min={1} max={100} step={0.5} value={customPercent} onChange={(event) => setCustomPercent(event.target.value)} className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#020805]/55 px-3 text-[14px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]" />
              <button type="button" disabled={isPending} onClick={() => runTrim(Number(customPercent))} className="h-11 rounded-2xl bg-[linear-gradient(180deg,#f3d98b,#d6ae4d_55%,#a77d2e)] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#061b12] disabled:opacity-50">Trim %</button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={isPending} onClick={() => runRemove(true)} className="h-11 rounded-2xl border border-red-400/30 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-red-200 disabled:opacity-50">Sell all + credit cash</button>
            <button type="button" disabled={isPending} onClick={() => runRemove(false)} className="h-11 rounded-2xl border border-[#ddb159]/16 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/55 disabled:opacity-50">Remove only</button>
          </div>

          {message && <p className="rounded-2xl bg-[#faf6f0]/[0.055] px-3 py-2 text-[11px] font-bold text-[#faf6f0]/62">{message}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MiniMetric({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-300" : tone === "gold" ? "text-[#ddb159]" : "text-[#faf6f0]";
  return (
    <div className="min-w-0 rounded-xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.045] px-2.5 py-2">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/40">{label}</p>
      <p className={`mt-1 truncate text-[13px] font-black leading-none ${valueClass}`}>{value}</p>
      <p className="mt-1 truncate text-[9px] font-semibold text-[#faf6f0]/42">{sub}</p>
    </div>
  );
}

function HoldingsRow({ portfolioId, holding, currency, maxAllocation }: { portfolioId: string; holding: ExtendedHolding; currency: string; maxAllocation: number }) {
  const [open, setOpen] = useState(false);
  const isPositive = holding.totalPnLDollars >= 0;
  const widthPct = maxAllocation > 0 ? Math.max(4, Math.min(100, (holding.currentAllocationPct / maxAllocation) * 100)) : 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white">
      <div className="absolute inset-y-0 left-0 bg-[#ddb159]/10 transition group-hover:bg-[#ddb159]/16" style={{ width: `${widthPct}%` }} />
      <div className="relative grid gap-3 px-3 py-3 lg:grid-cols-[minmax(210px,1.6fr)_110px_125px_90px_80px_94px] lg:items-center sm:px-4">
        <Link href={`/stock/${holding.ticker}`} className="flex min-w-0 items-center gap-3">
          <StockLogo ticker={holding.ticker} company={holding.company} size={38} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-black leading-tight tracking-[-0.025em] text-[#072116]">{holding.company ?? holding.ticker}</p>
            <p className="mt-1 truncate text-[11px] font-bold text-[#072116]/48">{holding.ticker} · {number(holding.shares, 4)} shares</p>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-2 lg:contents">
          <MetricCell label="Value" value={money(holding.currentValue, currency)} />
          <MetricCell label="P/L" value={money(holding.totalPnLDollars, currency)} sub={pct(holding.pnlPercent)} tone={isPositive ? "positive" : "negative"} />
          <MetricCell label="Alloc." value={`${holding.currentAllocationPct.toFixed(1)}%`} />
          <MetricCell label="AI score" value={number(holding.score, 0)} tone="gold" />
          <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-full bg-[#072116] px-4 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159] transition hover:brightness-110">
            Manage
          </button>
        </div>
      </div>
      {open && <ManageHoldingModal portfolioId={portfolioId} holding={holding} recommendedPercent={recommendedTrimPercent(holding)} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MetricCell({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : tone === "gold" ? "text-[#8a641a]" : "text-[#072116]";
  return (
    <div className="min-w-0 lg:text-right">
      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#072116]/36 lg:hidden">{label}</p>
      <p className={`truncate text-[13px] font-black tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className={`mt-0.5 truncate text-[10px] font-bold tabular-nums ${valueClass}/80`}>{sub}</p>}
    </div>
  );
}

function HoldingsPanel({ portfolioId, holdings, currency }: { portfolioId: string; holdings: ExtendedHolding[]; currency: string }) {
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [sort, setSort] = useState<HoldingSort>("value");
  const filterOptions = [
    { value: "all", label: "All holdings" },
    { value: "action", label: "Action needed" },
    { value: "winners", label: "Winners" },
    { value: "losers", label: "Losers" },
    { value: "oversized", label: "Oversized" },
  ];
  const sortOptions = [
    { value: "value", label: "Highest value" },
    { value: "urgent", label: "Most urgent" },
    { value: "worst", label: "Worst P/L" },
    { value: "best", label: "Best P/L" },
    { value: "rank", label: "Best rank" },
    { value: "ticker", label: "Ticker A-Z" },
  ];
  const filteredHoldings = useMemo(() => {
    let next = [...holdings];
    if (filter === "action") next = next.filter((holding) => holding.actionAlerts.length > 0);
    if (filter === "winners") next = next.filter((holding) => holding.totalPnLDollars > 0);
    if (filter === "losers") next = next.filter((holding) => holding.totalPnLDollars < 0);
    if (filter === "oversized") next = next.filter(isOversized);
    next.sort((a, b) => {
      if (sort === "urgent") return holdingUrgencyScore(b) - holdingUrgencyScore(a);
      if (sort === "value") return b.currentValue - a.currentValue;
      if (sort === "worst") return a.pnlPercent - b.pnlPercent;
      if (sort === "best") return b.pnlPercent - a.pnlPercent;
      if (sort === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999);
      return a.ticker.localeCompare(b.ticker);
    });
    return next;
  }, [filter, holdings, sort]);
  const maxAllocation = filteredHoldings.reduce((max, holding) => Math.max(max, holding.currentAllocationPct), 0);

  return (
    <section className="grid gap-3">
      <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Holdings</p>
          <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">Rows show value, P/L, allocation, AI score and a manage action.</p>
        </div>
        <div className="grid gap-2 sm:flex sm:justify-end">
          <StockGPTSelect value={filter} options={filterOptions} onChange={(value) => setFilter(value as HoldingFilter)} ariaLabel="Filter holdings" className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]" />
          <StockGPTSelect value={sort} options={sortOptions} onChange={(value) => setSort(value as HoldingSort)} ariaLabel="Sort holdings" className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]" />
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#ddb159]/24 bg-[#061b12]/72 p-6 text-center text-[#faf6f0]">
          <p className="text-[24px] font-black tracking-[-0.05em]">No holdings yet.</p>
          <p className="mx-auto mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#faf6f0]/52">Use Add / Import to add cash, log holdings or import from Trading 212.</p>
        </div>
      ) : filteredHoldings.length === 0 ? (
        <div className="rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-5 text-[#faf6f0]">
          <p className="text-[16px] font-black">No holdings match this filter.</p>
          <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">Try changing the filter or sort option.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="hidden grid-cols-[minmax(210px,1.6fr)_110px_125px_90px_80px_94px] px-4 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38 lg:grid">
            <span>Asset</span><span className="text-right">Value</span><span className="text-right">Net P/L</span><span className="text-right">%</span><span className="text-right">AI</span><span className="text-right">Action</span>
          </div>
          {filteredHoldings.map((holding) => (
            <HoldingsRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} maxAllocation={maxAllocation} />
          ))}
        </div>
      )}
    </section>
  );
}

function ManagePanel({ portfolioId, portfolioName }: { portfolioId: string; portfolioName: string }) {
  const router = useRouter();
  const [name, setName] = useState(portfolioName);
  const [message, setMessage] = useState<string | null>(null);
  const [isRenaming, startRenaming] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function saveName() {
    const cleanName = name.trim();
    if (!cleanName) {
      setMessage("Portfolio name cannot be empty.");
      return;
    }
    startRenaming(async () => {
      const result = await renamePortfolio({ portfolioId, name: cleanName });
      if (!result.success) {
        setMessage(result.error ?? "Could not rename portfolio.");
        return;
      }
      setMessage("Portfolio renamed.");
      router.refresh();
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

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Manage portfolio</p>
      <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Rename or delete</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="h-11 min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none focus:border-[#ddb159]" />
        <button type="button" onClick={saveName} disabled={isRenaming || name.trim() === portfolioName.trim()} className="h-11 rounded-2xl bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] disabled:opacity-60">{isRenaming ? "Saving…" : "Rename"}</button>
        <button type="button" onClick={runDelete} disabled={isDeleting} className="h-11 rounded-2xl border border-red-500/35 px-5 text-[11px] font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-60">{isDeleting ? "Deleting…" : "Delete"}</button>
      </div>
      {message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}
    </div>
  );
}

function ActivityPanel({ transactions, currency }: { transactions: PortfolioTransaction[]; currency: string }) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
        <p className="text-[16px] font-black">No activity yet.</p>
        <p className="mt-1 text-[12px] font-semibold text-[#072116]/55">Imports, cash deposits and manual holdings will show here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {transactions.slice(0, 20).map((transaction) => (
        <div key={transaction.id} className="grid gap-2 rounded-2xl bg-[#faf6f0] px-3 py-3 text-[#072116] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black">{transactionLabel(transaction.type)}{transaction.ticker ? ` · ${transaction.ticker}` : ""}</p>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/45">{formatDate(transaction.createdAt)}{transaction.notes ? ` · ${transaction.notes}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {transaction.shares != null && <span className="rounded-full bg-[#072116]/6 px-2 py-1 text-[10px] font-bold text-[#072116]/60">{number(transaction.shares, 4)} shares</span>}
            {transaction.amount != null && <span className="rounded-full bg-[#ddb159]/16 px-2 py-1 text-[10px] font-black text-[#8a641a]">{money(transaction.amount, transaction.currency ?? currency)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortfolioCommandCentreRevolut({
  portfolioId,
  portfolios,
  holdings,
  stockOptions = [],
  transactions = [],
  chartData = {},
  portfolioMeta,
  compactImportWidget,
}: Props) {
  const [section, setSection] = useState<Section>("overview");
  const currency = portfolioMeta.currency ?? "USD";
  const summary = buildPortfolioHealthSummary({
    id: portfolioMeta.id,
    name: portfolioMeta.name,
    currency,
    riskTolerance: portfolioMeta.riskTolerance,
    holdings,
    transactions,
    cashBalance: portfolioMeta.cashBalance,
    cashDepositedTotal: portfolioMeta.cashDepositedTotal,
  });
  const topHoldings = useMemo(
    () => [...holdings].sort((a, b) => b.currentValue - a.currentValue).slice(0, 5),
    [holdings],
  );

  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
      <PortfolioTopBar portfolioId={portfolioId} portfolios={portfolios} />

      <div className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SectionButton section="overview" active={section} setSection={setSection} label="Overview" />
        <SectionButton section="holdings" active={section} setSection={setSection} label="Holdings" />
        <SectionButton section="add" active={section} setSection={setSection} label="Add / Import" />
        <SectionButton section="activity" active={section} setSection={setSection} label="Activity" />
        <SectionButton section="manage" active={section} setSection={setSection} label="Manage" />
      </div>

      <PortfolioChartHero
        portfolioName={portfolioMeta.name}
        currency={currency}
        summary={summary}
        chartData={chartData}
        createdAt={portfolioMeta.createdAt}
      />

      {section === "overview" && (
        <section className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,310px)]">
          <HoldingsPanel portfolioId={portfolioId} holdings={topHoldings} currency={currency} />
          <div className="grid content-start gap-3">
            <div className="rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 text-[#faf6f0]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Health drivers</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniMetric label="Holdings" value={String(summary.holdingsCount)} sub={`${summary.sectorCount} sectors`} />
                <MiniMetric label="Cash" value={`${summary.cashDrag.toFixed(1)}%`} sub="drag" />
                <MiniMetric label="Alerts" value={String(summary.actionAlerts)} sub={`${summary.eventAlerts} events`} tone={summary.actionAlerts > 0 ? "negative" : "positive"} />
                <MiniMetric label="Largest" value={`${summary.largestPositionPct.toFixed(1)}%`} sub="position" tone={summary.largestPositionPct > 30 ? "negative" : "positive"} />
              </div>
            </div>
            <p className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/72 p-4 text-[12px] font-semibold leading-5 text-[#faf6f0]/52">
              {summary.explanation}
            </p>
          </div>
        </section>
      )}

      {section === "holdings" && <HoldingsPanel portfolioId={portfolioId} holdings={holdings} currency={currency} />}
      {section === "add" && (
        <section className="grid gap-3 xl:grid-cols-[0.8fr_1fr_0.9fr]">
          <AddCashPanel portfolioId={portfolioId} currency={currency} />
          <AddHoldingPanel portfolioId={portfolioId} stockOptions={stockOptions} />
          <div className="min-w-0">{compactImportWidget}</div>
        </section>
      )}
      {section === "activity" && <ActivityPanel transactions={transactions} currency={currency} />}
      {section === "manage" && <ManagePanel portfolioId={portfolioId} portfolioName={portfolioMeta.name} />}

      <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">
        ⚠️ StockGPT portfolio alerts and health scores are generated from rankings, diagnostics, portfolio data, price action and recent news. They are research tools, not financial advice.
      </p>
    </div>
  );
}
