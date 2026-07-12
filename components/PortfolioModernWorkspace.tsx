"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import { StockLogo } from "@/components/StockLogo";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { Trading212CsvImport } from "@/components/Trading212CsvImport";
import { ManageHoldingDrawer } from "@/components/ManageHoldingDrawer";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";
import {
  addCash,
  deletePortfolio,
  logExistingHolding,
  renamePortfolio,
  updatePortfolioPreferences,
} from "@/lib/actions/portfolio-management";
import { buildPortfolioTrimRecommendation } from "@/lib/portfolio-trim-recommendation";
import { derivePortfolioHoldingAction } from "@/lib/portfolio-action-engine";

type Section = "overview" | "holdings" | "activity";
type HoldingsView = "list" | "map";
type HoldingFilter = "all" | "oversized" | "reviews" | "gainers" | "losers" | "missing";
type HoldingSort = "value" | "allocation" | "best" | "worst" | "score" | "rank" | "urgent";
type ActivityFilter = "all" | "transactions" | "ai" | "reviews";

type PortfolioOption = {
  id: string;
  name: string;
  createdAt: string | null;
};

type StockOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | null;
  price: number | null;
};

type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  ticker: string | null;
  type: string;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realisedPnl: number | null;
  currency: string;
  notes: string | null;
  createdAt: string;
};

type Props = {
  portfolioId: string;
  portfolios: PortfolioOption[];
  portfolioMeta: {
    name: string;
    objective: string | null;
    riskTolerance: string | null;
    timeHorizon: string | null;
    createdAt: string | null;
    cashBalance: number;
    cashDepositedTotal: number;
    currency: string;
  };
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  stockOptions: StockOption[];
  transactions: PortfolioTransaction[];
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta: PortfolioChartMeta;
  opportunities: DashboardPortfolioOpportunity[];
  usdToDisplayRate: number;
  canUsePremium: boolean;
  initialSection: Section;
};

type ActivityItem = {
  id: string;
  kind: "transaction" | "ai" | "review";
  date: string;
  ticker: string | null;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral" | "warning";
};

const SECTION_ITEMS: Array<{ value: Section; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "holdings", label: "Holdings" },
  { value: "activity", label: "Activity" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function money(value: number, currency: string, compact = false) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: compact && Math.abs(safe) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(safe) >= 1000 ? 0 : 2,
  }).format(safe);
}

function signedMoney(value: number, currency: string) {
  const abs = money(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "−"}${abs}`;
}

function signedPct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return withTime
    ? date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function freshnessCopy(meta: PortfolioChartMeta) {
  const state = meta.health.displayState;
  if (state === "ready") return "Portfolio data ready";
  if (state === "updating") return "Refreshing portfolio data";
  if (state === "building") return "Building chart history";
  if (state === "repairing") return "Repairing chart history";
  if (state === "error_with_cache") return "Showing cached chart";
  if (state === "error_no_cache") return "Chart history unavailable";
  if (state === "empty") return "Add holdings to begin";
  return "Portfolio data available";
}

function transactionTitle(type: string, ticker: string | null) {
  if (type === "deposit") return "Cash added";
  if (type === "withdrawal") return "Cash withdrawn";
  if (type === "buy") return ticker ? `Bought ${ticker}` : "Holding bought";
  if (type === "sell") return ticker ? `Sold ${ticker}` : "Holding sold";
  if (type === "import") return "Portfolio imported";
  if (type === "log_existing") return ticker ? `Added ${ticker}` : "Holding added";
  if (type === "adjustment") return ticker ? `Adjusted ${ticker}` : "Holding adjusted";
  if (type === "cash_adjustment") return "Cash adjusted";
  return type.replace(/_/g, " ");
}

function transactionDetail(transaction: PortfolioTransaction, currency: string) {
  const amount = transaction.amount ?? null;
  const shares = transaction.shares ?? null;
  if (shares != null && transaction.price != null) {
    return `${shares.toLocaleString("en-GB", { maximumFractionDigits: 6 })} shares at ${money(transaction.price, currency)}`;
  }
  if (amount != null) return money(amount, currency);
  return transaction.notes ?? "Portfolio activity";
}

function statusForHolding(holding: ExtendedHolding, riskTolerance: string | null) {
  if (holding.currentPrice <= 0 && holding.shares > 0) return "Price unavailable";
  if (holding.actionAlerts.length > 0) return holding.actionAlerts[0]?.action === "trim" ? "Review size" : "Review";
  const cap = riskTolerance === "conservative" ? 18 : riskTolerance === "aggressive" ? 32 : 24;
  if (holding.currentAllocationPct > cap) return "Oversized";
  if (holding.pnlPercent >= 12) return "Strong contributor";
  if (holding.pnlPercent <= -10) return "Under pressure";
  return "Healthy";
}

function toneClass(value: number) {
  if (value > 0.0001) return "text-[#61d7ab]";
  if (value < -0.0001) return "text-[#f1908d]";
  return "text-[#faf6f0]/52";
}

function Icon({ name, className = "size-5" }: { name: "plus" | "settings" | "filter" | "search" | "list" | "map" | "close" | "arrow"; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 6.6 15a1.7 1.7 0 0 0-1.56-1.03H5v-3h.08A1.7 1.7 0 0 0 6.64 9.9 1.7 1.7 0 0 0 6.3 8.02l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.33 4.7V4h3v.7a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v3h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
  if (name === "filter") return <svg {...common}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  if (name === "list") return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  if (name === "map") return <svg {...common}><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z" /><path d="M9 4v14M15 6v14" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/68 backdrop-blur-[2px] lg:items-stretch lg:justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <section role="dialog" aria-modal="true" aria-label={title} className="relative z-[101] flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[#ddb159]/18 bg-[#061b12] shadow-[0_-22px_56px_rgba(0,0,0,0.4)] lg:h-full lg:max-h-none lg:max-w-[480px] lg:rounded-none lg:border-y-0 lg:border-r-0">
        <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-4 border-b border-[#faf6f0]/8 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-black tracking-[-0.03em] text-[#faf6f0]">{title}</h2>
            {subtitle && <p className="mt-1 truncate text-[11px] font-semibold text-[#faf6f0]/45">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/20 text-[#faf6f0] transition hover:bg-[#faf6f0]/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">
            <Icon name="close" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-5">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">{eyebrow}</p>
        <h2 className="mt-1 text-[23px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0] lg:text-[28px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="border-y border-[#faf6f0]/8 py-10 text-center">
      <p className="text-[18px] font-black text-[#faf6f0]">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-[13px] font-semibold leading-6 text-[#faf6f0]/48">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PortfolioModernWorkspace({
  portfolioId,
  portfolios,
  portfolioMeta,
  summary,
  holdings,
  stockOptions,
  transactions,
  chartData,
  chartMeta,
  opportunities,
  usdToDisplayRate,
  canUsePremium,
  initialSection,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stageRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState<Section>(initialSection);
  const [stageVisible, setStageVisible] = useState(true);
  const [scrubPoint, setScrubPoint] = useState<ChartPoint | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<ExtendedHolding | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [selectedMapTicker, setSelectedMapTicker] = useState<string | null>(null);

  useEffect(() => {
    const current = searchParams.get("section");
    const next: Section = current === "holdings" || current === "activity" ? current : "overview";
    setSection(next);
  }, [searchParams]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStageVisible(entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const heldTickers = useMemo(
    () => new Set(holdings.map((holding) => holding.ticker.toUpperCase())),
    [holdings],
  );
  const currentDisplayValue = scrubPoint?.close ?? summary.totalValue;
  const currentDisplayPnl = scrubPoint?.pnl ?? summary.totalPnl;
  const currentDisplayPnlPct = scrubPoint?.pnlPct ?? summary.totalPnlPct;
  const largestHolding = useMemo(
    () => [...holdings].sort((a, b) => b.currentValue - a.currentValue)[0] ?? null,
    [holdings],
  );
  const latestActivityDate = useMemo(() => {
    const values = [
      ...transactions.map((transaction) => transaction.createdAt),
      ...holdings.flatMap((holding) =>
        [...holding.actionAlerts, ...holding.eventAlerts]
          .map((alert) => alert.dataUpdatedAt ?? alert.generatedAt)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    return values.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  }, [holdings, transactions]);

  function updateUrl(next: { section?: Section; portfolio?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.section) params.set("section", next.section);
    if (next.portfolio) params.set("portfolio", next.portfolio);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function chooseSection(next: Section) {
    setSection(next);
    updateUrl({ section: next });
    requestAnimationFrame(() => {
      document.querySelector("[data-portfolio-section-anchor]")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  const selectedRecommendation = selectedHolding
    ? buildPortfolioTrimRecommendation(
        selectedHolding,
        portfolioMeta.riskTolerance,
        stockOptions,
        heldTickers,
      )
    : null;
  const selectedAction = selectedHolding
    ? derivePortfolioHoldingAction(selectedHolding, {
        riskTolerance: portfolioMeta.riskTolerance,
        objective: portfolioMeta.objective,
        timeHorizon: portfolioMeta.timeHorizon,
        cashBalance: portfolioMeta.cashBalance,
        cashDrag: summary.cashDrag,
      })
    : null;

  return (
    <main className="h-full min-h-0 overflow-y-auto overflow-x-hidden bg-[#061b12] pb-[calc(120px+env(safe-area-inset-bottom))] text-[#faf6f0] lg:pb-12">
      <div className="mx-auto w-full max-w-[1480px] lg:px-6 xl:px-8 2xl:px-10">
        <section ref={stageRef} className="relative isolate overflow-hidden border-b border-[#ddb159]/14 px-4 pb-5 pt-5 sm:px-6 lg:mt-5 lg:rounded-[28px] lg:border lg:px-8 lg:pb-7 lg:pt-7">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(221,177,89,0.12),transparent_34%),linear-gradient(180deg,#0a2a1d_0%,#061b12_72%)]" />
          <div className="mx-auto max-w-[1180px]">
            <div className="flex items-start justify-between gap-3">
              <label className="min-w-0 max-w-[72%]">
                <span className="sr-only">Selected portfolio</span>
                <span className="relative block">
                  <select
                    value={portfolioId}
                    onChange={(event) => updateUrl({ portfolio: event.target.value })}
                    className="h-12 w-full appearance-none truncate rounded-full border border-[#ddb159]/26 bg-[#04140c]/55 pl-4 pr-10 text-[13px] font-black text-[#faf6f0] outline-none backdrop-blur focus:border-[#ddb159]"
                  >
                    {portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id} className="bg-[#061b12]">
                        {portfolio.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#ddb159]">⌄</span>
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setAddOpen(true)} aria-label="Add to portfolio" className="grid size-12 place-items-center rounded-full border border-[#ddb159]/30 bg-[#ddb159] text-[#061b12] shadow-[0_10px_24px_rgba(221,177,89,0.16)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#faf6f0]">
                  <Icon name="plus" />
                </button>
                <button type="button" onClick={() => setManageOpen(true)} aria-label="Manage portfolio" className="grid size-12 place-items-center rounded-full border border-[#ddb159]/24 bg-[#04140c]/55 text-[#ddb159] transition hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">
                  <Icon name="settings" />
                </button>
              </div>
            </div>

            <div className="mt-8 text-center lg:mt-5 lg:text-left">
              <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/42">Current portfolio value</p>
                  <h1 className="mt-2 truncate text-[clamp(42px,12vw,62px)] font-black leading-none tracking-[-0.065em] tabular-nums text-[#faf6f0] lg:text-[60px]">
                    {money(currentDisplayValue, portfolioMeta.currency)}
                  </h1>
                  <p className={`mt-3 text-[17px] font-black tabular-nums ${toneClass(currentDisplayPnl)}`}>
                    {signedMoney(currentDisplayPnl, portfolioMeta.currency)} · {signedPct(currentDisplayPnlPct)}
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-center gap-4 lg:mt-0 lg:justify-end">
                  <div className="grid size-16 shrink-0 place-items-center rounded-full border border-[#ddb159]/34 bg-[#ddb159]/8 text-center">
                    <span className="block text-[20px] font-black leading-none text-[#ddb159]">{summary.score}</span>
                    <span className="mt-0.5 block text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/45">Health</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-black text-[#faf6f0]">{summary.label}</p>
                    <p className="mt-1 text-[10px] font-semibold text-[#faf6f0]/42">{freshnessCopy(chartMeta)}</p>
                    {scrubPoint && <p className="mt-1 text-[10px] font-semibold text-[#ddb159]">{formatDate(scrubPoint.date, true)}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-[300px] w-full lg:mt-2">
              {Object.values(chartData).some((points) => (points?.length ?? 0) > 1) ? (
                <StockChart ticker="Portfolio" data={chartData} initialRange="1M" height={330} color="#ddb159" mobileTransparentFrame onScrub={(point) => setScrubPoint(point)} />
              ) : (
                <div className="flex h-[330px] items-center justify-center border-y border-[#faf6f0]/8 text-center">
                  <div className="max-w-md px-6">
                    <p className="text-[18px] font-black text-[#faf6f0]">{chartMeta.health.displayState === "empty" ? "Add holdings to start charting" : "Preparing reliable chart history"}</p>
                    <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/48">StockGPT only plots confirmed portfolio snapshots. It will not invent movement while history is incomplete.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className={`sticky top-0 z-40 border-b border-[#ddb159]/14 bg-[#061b12]/94 backdrop-blur-xl transition ${stageVisible ? "" : "shadow-[0_14px_32px_rgba(0,0,0,0.24)]"}`}>
          {!stageVisible && (
            <button type="button" onClick={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex h-[52px] w-full items-center justify-between gap-3 px-4 text-left sm:px-6 lg:px-8">
              <span className="min-w-0 truncate text-[12px] font-black text-[#faf6f0]">{portfolioMeta.name}</span>
              <span className="shrink-0 text-right"><span className="text-[14px] font-black tabular-nums text-[#faf6f0]">{money(summary.totalValue, portfolioMeta.currency)}</span><span className={`ml-2 text-[11px] font-black ${toneClass(summary.totalPnlPct)}`}>{signedPct(summary.totalPnlPct)}</span></span>
            </button>
          )}
          <div data-portfolio-section-anchor className="grid h-[52px] grid-cols-[1fr_auto] items-stretch px-1 sm:px-4 lg:px-8">
            <nav aria-label="Portfolio sections" className="grid grid-cols-3">
              {SECTION_ITEMS.map((item) => (
                <button key={item.value} type="button" onClick={() => chooseSection(item.value)} aria-current={section === item.value ? "page" : undefined} className={`relative min-w-0 px-2 text-[12px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159] ${section === item.value ? "text-[#faf6f0]" : "text-[#faf6f0]/42 hover:text-[#faf6f0]/70"}`}>
                  {item.label}
                  {section === item.value && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[#ddb159]" />}
                </button>
              ))}
            </nav>
            <div className="hidden items-center gap-2 lg:flex">
              <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#061b12]"><Icon name="plus" className="size-4" />Add</button>
              <button type="button" onClick={() => setManageOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-full border border-[#ddb159]/22 px-4 text-[11px] font-black text-[#ddb159]"><Icon name="settings" className="size-4" />Manage</button>
            </div>
          </div>
        </div>

        {section === "overview" && (
          <OverviewSection
            portfolioId={portfolioId}
            portfolioMeta={portfolioMeta}
            summary={summary}
            holdings={holdings}
            opportunities={opportunities}
            canUsePremium={canUsePremium}
            latestActivityDate={latestActivityDate}
            selectedMapTicker={selectedMapTicker}
            onSelectMapTicker={setSelectedMapTicker}
            onOpenHolding={setSelectedHolding}
            onViewAllHoldings={() => chooseSection("holdings")}
            onOpenAnalysis={() => setAnalysisOpen(true)}
          />
        )}

        {section === "holdings" && (
          <HoldingsSection
            holdings={holdings}
            summary={summary}
            currency={portfolioMeta.currency}
            riskTolerance={portfolioMeta.riskTolerance}
            onOpenHolding={setSelectedHolding}
          />
        )}

        {section === "activity" && (
          <ActivitySection
            transactions={transactions}
            holdings={holdings}
            currency={portfolioMeta.currency}
            onOpenHolding={(ticker) => {
              const match = holdings.find((holding) => holding.ticker === ticker);
              if (match) setSelectedHolding(match);
            }}
          />
        )}

        <p className="px-5 pb-4 pt-8 text-[10px] font-semibold leading-5 text-[#faf6f0]/34 lg:px-2 lg:text-[11px]">
          StockGPT portfolio views are educational research tools. Rankings, health scores, opportunities and action labels can be wrong and should be checked against your own objectives and risk limits.
        </p>
      </div>

      <AddPortfolioSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        portfolioId={portfolioId}
        currency={portfolioMeta.currency}
        cashBalance={portfolioMeta.cashBalance}
        stockOptions={stockOptions}
        usdToDisplayRate={usdToDisplayRate}
        routerRefresh={() => router.refresh()}
      />
      <ManagePortfolioSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        portfolioId={portfolioId}
        meta={portfolioMeta}
        routerRefresh={() => router.refresh()}
      />
      <AnalysisSheet open={analysisOpen} onClose={() => setAnalysisOpen(false)} summary={summary} portfolioId={portfolioId} />
      {selectedHolding && selectedRecommendation && selectedAction && (
        <ManageHoldingDrawer
          portfolioId={portfolioId}
          holding={selectedHolding}
          recommendation={selectedRecommendation}
          action={selectedAction}
          cashBalance={portfolioMeta.cashBalance}
          displayCurrency={portfolioMeta.currency}
          usdToDisplayRate={usdToDisplayRate}
          onClose={() => setSelectedHolding(null)}
        />
      )}
    </main>
  );
}

function OverviewSection({
  portfolioId,
  portfolioMeta,
  summary,
  holdings,
  opportunities,
  canUsePremium,
  latestActivityDate,
  selectedMapTicker,
  onSelectMapTicker,
  onOpenHolding,
  onViewAllHoldings,
  onOpenAnalysis,
}: {
  portfolioId: string;
  portfolioMeta: Props["portfolioMeta"];
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  opportunities: DashboardPortfolioOpportunity[];
  canUsePremium: boolean;
  latestActivityDate: string | null;
  selectedMapTicker: string | null;
  onSelectMapTicker: (ticker: string | null) => void;
  onOpenHolding: (holding: ExtendedHolding) => void;
  onViewAllHoldings: () => void;
  onOpenAnalysis: () => void;
}) {
  const topHoldings = [...holdings].sort((a, b) => b.currentValue - a.currentValue).slice(0, 5);
  const largest = topHoldings[0] ?? null;
  const reviewCount = holdings.filter((holding) => holding.actionAlerts.length > 0 || holding.eventAlerts.length > 0).length;
  const pulseTitle = summary.oversizedCount > 0
    ? `${summary.label}, but concentration needs attention.`
    : summary.actionAlerts > 0
      ? `${summary.label}, with ${summary.actionAlerts} action review${summary.actionAlerts === 1 ? "" : "s"}.`
      : `${summary.label}, with no urgent portfolio action.`;

  return (
    <div className="px-4 pt-7 sm:px-6 lg:px-0 lg:pt-8">
      <section>
        <SectionHeading eyebrow="Current snapshot" title="What matters now" />
        <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          <SnapshotMetric label="Portfolio return" value={signedPct(summary.totalPnlPct)} detail={signedMoney(summary.totalPnl, portfolioMeta.currency)} tone={summary.totalPnl >= 0 ? "positive" : "negative"} />
          <SnapshotMetric label="Largest position" value={largest ? `${largest.currentAllocationPct.toFixed(1)}%` : "—"} detail={largest ? largest.ticker : "No holdings"} />
          <SnapshotMetric label="Reviews" value={String(reviewCount)} detail={reviewCount === 0 ? "No active reviews" : `${summary.actionAlerts} action · ${summary.eventAlerts} events`} tone={reviewCount > 0 ? "warning" : "positive"} />
          <SnapshotMetric label="Cash" value={money(portfolioMeta.cashBalance, portfolioMeta.currency, true)} detail={`${summary.cashDrag.toFixed(1)}% of portfolio`} />
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)] lg:gap-8">
        <section className="border-y border-[#faf6f0]/8 py-8 lg:border-y-0 lg:py-0">
          <SectionHeading eyebrow="Portfolio pulse" title={pulseTitle} />
          <p className="mt-4 max-w-3xl text-[15px] font-semibold leading-7 text-[#faf6f0]/66 lg:text-[16px]">{summary.explanation}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <SignalChip value={`${summary.actionAlerts}`} label="action reviews" tone={summary.actionAlerts > 0 ? "warning" : "neutral"} />
            <SignalChip value={`${summary.oversizedCount}`} label="oversized" tone={summary.oversizedCount > 0 ? "warning" : "neutral"} />
            <SignalChip value={`${summary.sectorCount}`} label="sectors" tone="neutral" />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <AskStockGPTButton canUseAskStockGPT={canUsePremium} isAuthenticated label="Ask about this portfolio" context={{ contextType: "portfolio", portfolioId }} className="h-12 w-full rounded-2xl sm:w-auto" />
            <button type="button" onClick={onOpenAnalysis} className="h-12 rounded-2xl border border-[#ddb159]/22 px-5 text-[12px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/8">View full analysis</button>
          </div>
        </section>

        <aside className="border-y border-[#faf6f0]/8 py-6 lg:border lg:border-[#ddb159]/14 lg:bg-[#0a2a1d]/38 lg:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio diagnostics</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6">
            <Diagnostic label="Weighted AI" value={summary.weightedAvgScore?.toLocaleString("en-GB") ?? "—"} />
            <Diagnostic label="Largest" value={`${summary.largestPositionPct.toFixed(1)}%`} />
            <Diagnostic label="Holdings" value={String(summary.holdingsCount)} detail={`${summary.sectorCount} sectors`} />
            <Diagnostic label="Latest activity" value={latestActivityDate ? formatDate(latestActivityDate) : "None"} />
          </dl>
        </aside>
      </div>

      <section className="mt-12">
        <SectionHeading eyebrow="Portfolio geometry" title="Conviction × exposure" action={<span className="hidden text-[11px] font-semibold text-[#faf6f0]/38 sm:block">Bubble size reflects holding value</span>} />
        <p className="mt-2 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/45">Find positions that are large but weak, or high-conviction holdings that remain small.</p>
        {holdings.length > 0 ? (
          <ExposureMap holdings={holdings} currency={portfolioMeta.currency} selectedTicker={selectedMapTicker} onSelectTicker={onSelectMapTicker} onOpenHolding={onOpenHolding} />
        ) : (
          <EmptyState title="No holdings to map" detail="Add holdings and StockGPT will plot conviction against portfolio exposure." />
        )}
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="StockGPT opportunities" title="Portfolio-fit ideas" action={<Link href="/rankings" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ddb159]/20 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]">Review ideas <Icon name="arrow" className="size-4" /></Link>} />
        {opportunities.length > 0 ? (
          <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3">
            {opportunities.slice(0, 6).map((opportunity) => (
              <OpportunityCard key={`${opportunity.ticker}-${opportunity.category}`} opportunity={opportunity} />
            ))}
          </div>
        ) : (
          <EmptyState title="No strong portfolio-fit ideas right now" detail="StockGPT will not force weak suggestions. New ideas appear when ranking strength, sector fit and data freshness support them." />
        )}
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="Top holdings" title="Largest positions" action={<button type="button" onClick={onViewAllHoldings} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ddb159]/20 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]">View all <Icon name="arrow" className="size-4" /></button>} />
        <div className="mt-4 border-y border-[#faf6f0]/8">
          {topHoldings.map((holding) => (
            <HoldingLedgerRow key={holding.ticker} holding={holding} currency={portfolioMeta.currency} riskTolerance={portfolioMeta.riskTolerance} onClick={() => onOpenHolding(holding)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SnapshotMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "positive" | "negative" | "warning" }) {
  const valueClass = tone === "positive" ? "text-[#61d7ab]" : tone === "negative" ? "text-[#f1908d]" : tone === "warning" ? "text-[#e8bd61]" : "text-[#faf6f0]";
  return (
    <div className="w-[166px] shrink-0 snap-start border-l border-[#ddb159]/18 px-4 py-2 first:border-l-0 first:pl-0 lg:w-auto lg:first:border-l lg:first:pl-4">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/38">{label}</p>
      <p className={`mt-2 text-[22px] font-black tracking-[-0.04em] tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#faf6f0]/42">{detail}</p>
    </div>
  );
}

function SignalChip({ value, label, tone }: { value: string; label: string; tone: "neutral" | "warning" }) {
  return <span className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[10px] font-black ${tone === "warning" ? "border-[#e8bd61]/28 bg-[#e8bd61]/8 text-[#e8bd61]" : "border-[#faf6f0]/10 bg-[#faf6f0]/4 text-[#faf6f0]/62"}`}><strong className="text-[13px] text-inherit">{value}</strong>{label}</span>;
}

function Diagnostic({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0"><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/36">{label}</dt><dd className="mt-1 truncate text-[20px] font-black tracking-[-0.03em] text-[#faf6f0]">{value}</dd>{detail && <p className="mt-1 truncate text-[10px] font-semibold text-[#faf6f0]/38">{detail}</p>}</div>;
}

function ExposureMap({ holdings, currency, selectedTicker, onSelectTicker, onOpenHolding }: { holdings: ExtendedHolding[]; currency: string; selectedTicker: string | null; onSelectTicker: (ticker: string | null) => void; onOpenHolding: (holding: ExtendedHolding) => void }) {
  const maxValue = Math.max(1, ...holdings.map((holding) => holding.currentValue));
  const selected = holdings.find((holding) => holding.ticker === selectedTicker) ?? null;
  return (
    <div className="mt-5 overflow-hidden border-y border-[#faf6f0]/8 bg-[linear-gradient(180deg,rgba(250,246,240,0.025),transparent)] lg:rounded-[20px] lg:border lg:border-[#ddb159]/14">
      <div className="relative h-[390px] sm:h-[430px] lg:h-[510px]">
        <div className="pointer-events-none absolute inset-x-5 bottom-10 top-8 border-b border-l border-[#faf6f0]/12">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#faf6f0]/8" />
          <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-[#faf6f0]/8" />
          <span className="absolute -left-1 top-0 -translate-x-full text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/30">High AI</span>
          <span className="absolute -left-1 bottom-0 -translate-x-full text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/30">Low AI</span>
          <span className="absolute bottom-[-24px] left-0 text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/30">Small exposure</span>
          <span className="absolute bottom-[-24px] right-0 text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/30">Large exposure</span>
        </div>
        {holdings.map((holding, index) => {
          const allocation = clamp(holding.currentAllocationPct, 3, 96);
          const conviction = clamp(holding.scorePercentile || (holding.score / Math.max(holding.maxScore, 1)) * 100, 4, 96);
          const size = clamp(42 + Math.sqrt(holding.currentValue / maxValue) * 42, 44, 84);
          const selectedState = selectedTicker === holding.ticker;
          const left = clamp(5 + allocation * 0.9 + ((index % 3) - 1) * 1.2, 5, 95);
          const top = clamp(6 + (100 - conviction) * 0.82 + ((index % 4) - 1.5) * 1.4, 6, 88);
          return (
            <button key={holding.ticker} type="button" onClick={() => onSelectTicker(selectedState ? null : holding.ticker)} aria-label={`${holding.ticker}, ${holding.currentAllocationPct.toFixed(1)}% allocation, AI conviction ${Math.round(conviction)} out of 100`} className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-center shadow-[0_10px_26px_rgba(0,0,0,0.26)] transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddb159] ${selectedState ? "z-20 scale-110 border-[#f2d27a] bg-[#ddb159] text-[#061b12]" : holding.pnlPercent >= 0 ? "z-10 border-[#61d7ab]/44 bg-[#0a2a1d] text-[#faf6f0]" : "z-10 border-[#f1908d]/44 bg-[#0a2a1d] text-[#faf6f0]"}`} style={{ left: `${left}%`, top: `${top}%`, width: size, height: size }}>
              <span className="text-[10px] font-black leading-none">{holding.ticker}</span>
              {size >= 62 && <span className="mt-0.5 text-[8px] font-black opacity-65">{holding.currentAllocationPct.toFixed(1)}%</span>}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="flex items-center justify-between gap-4 border-t border-[#faf6f0]/8 px-5 py-4">
          <div className="min-w-0"><p className="truncate text-[13px] font-black text-[#faf6f0]">{selected.company ?? selected.ticker}</p><p className="mt-1 truncate text-[10px] font-semibold text-[#faf6f0]/42">{selected.currentAllocationPct.toFixed(1)}% allocation · {money(selected.currentValue, currency)}</p></div>
          <button type="button" onClick={() => onOpenHolding(selected)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#ddb159] px-4 text-[10px] font-black text-[#061b12]">Open holding <Icon name="arrow" className="size-4" /></button>
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: DashboardPortfolioOpportunity }) {
  const fit = clamp(Math.round((opportunity.score / 10000) * 100), 0, 99);
  return (
    <article className="w-[calc(100vw-56px)] max-w-[390px] shrink-0 snap-start border-l border-[#ddb159]/18 px-4 py-2 first:pl-0 lg:w-auto lg:max-w-none lg:border lg:border-[#ddb159]/14 lg:bg-[#0a2a1d]/32 lg:p-5">
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><StockLogo ticker={opportunity.ticker} company={opportunity.company} size={42} /><div className="min-w-0"><p className="truncate text-[16px] font-black text-[#faf6f0]">{opportunity.ticker} <span className="font-semibold text-[#faf6f0]/40">{opportunity.company}</span></p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">{opportunity.category}</p></div></div><span className="shrink-0 rounded-full border border-[#ddb159]/22 px-2.5 py-1 text-[10px] font-black text-[#ddb159]">Fit {fit}%</span></div>
      <p className="mt-4 line-clamp-3 text-[13px] font-semibold leading-6 text-[#faf6f0]/64">{opportunity.reason}</p>
      <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/42"><span className="font-black text-[#e8bd61]">Key risk:</span> {opportunity.risk}</p>
      <div className="mt-5 flex items-center justify-between gap-3"><span className="text-[9px] font-semibold text-[#faf6f0]/32">{opportunity.updatedAt ? `Updated ${formatDate(opportunity.updatedAt)}` : "Freshness unavailable"}</span><Link href={`/stock/${encodeURIComponent(opportunity.ticker)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ddb159]/24 px-4 text-[10px] font-black text-[#ddb159]">Research <Icon name="arrow" className="size-4" /></Link></div>
    </article>
  );
}

function HoldingsSection({ holdings, summary, currency, riskTolerance, onOpenHolding }: { holdings: ExtendedHolding[]; summary: PortfolioHealthSummary; currency: string; riskTolerance: string | null; onOpenHolding: (holding: ExtendedHolding) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [sort, setSort] = useState<HoldingSort>("value");
  const [view, setView] = useState<HoldingsView>("list");
  const [selectedMapTicker, setSelectedMapTicker] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    const cap = riskTolerance === "conservative" ? 18 : riskTolerance === "aggressive" ? 32 : 24;
    return holdings
      .filter((holding) => !normalised || holding.ticker.toLowerCase().includes(normalised) || String(holding.company ?? "").toLowerCase().includes(normalised))
      .filter((holding) => {
        if (filter === "oversized") return holding.currentAllocationPct > cap;
        if (filter === "reviews") return holding.actionAlerts.length > 0 || holding.eventAlerts.length > 0;
        if (filter === "gainers") return holding.pnlPercent > 0;
        if (filter === "losers") return holding.pnlPercent < 0;
        if (filter === "missing") return holding.shares > 0 && holding.currentPrice <= 0;
        return true;
      })
      .sort((a, b) => {
        if (sort === "allocation") return b.currentAllocationPct - a.currentAllocationPct;
        if (sort === "best") return b.pnlPercent - a.pnlPercent;
        if (sort === "worst") return a.pnlPercent - b.pnlPercent;
        if (sort === "score") return b.score - a.score;
        if (sort === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999);
        if (sort === "urgent") return (b.actionAlerts.length * 10 + b.eventAlerts.length) - (a.actionAlerts.length * 10 + a.eventAlerts.length);
        return b.currentValue - a.currentValue;
      });
  }, [filter, holdings, query, riskTolerance, sort]);

  return (
    <div className="px-4 pt-7 sm:px-6 lg:px-0 lg:pt-8">
      <SectionHeading eyebrow="Holdings workspace" title="Your portfolio ledger" />
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
        <SnapshotMetric label="Invested" value={money(summary.holdingsValue, currency, true)} detail={`${summary.holdingsCount} holdings`} />
        <SnapshotMetric label="Cash" value={money(summary.totalValue - summary.holdingsValue, currency, true)} detail={`${summary.cashDrag.toFixed(1)}% of portfolio`} />
        <SnapshotMetric label="Largest" value={`${summary.largestPositionPct.toFixed(1)}%`} detail="Current concentration" />
        <SnapshotMetric label="Active reviews" value={String(summary.actionAlerts)} detail={`${summary.eventAlerts} supporting events`} tone={summary.actionAlerts > 0 ? "warning" : "positive"} />
      </div>

      <div className="mt-7 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <label className="relative min-w-0"><span className="sr-only">Search holdings</span><Icon name="search" className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#faf6f0]/34" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search holdings" className="h-12 w-full rounded-full border border-[#faf6f0]/10 bg-[#04140c]/55 pl-11 pr-4 text-[13px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/30 focus:border-[#ddb159]" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="sr-only">Filter holdings</span><select value={filter} onChange={(event) => setFilter(event.target.value as HoldingFilter)} className="h-12 w-full rounded-full border border-[#faf6f0]/10 bg-[#04140c]/55 px-4 text-[11px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"><option value="all">All holdings</option><option value="oversized">Oversized</option><option value="reviews">Reviews</option><option value="gainers">Gainers</option><option value="losers">Losers</option><option value="missing">Missing prices</option></select></label>
          <label><span className="sr-only">Sort holdings</span><select value={sort} onChange={(event) => setSort(event.target.value as HoldingSort)} className="h-12 w-full rounded-full border border-[#faf6f0]/10 bg-[#04140c]/55 px-4 text-[11px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"><option value="value">Highest value</option><option value="allocation">Largest allocation</option><option value="best">Best P/L</option><option value="worst">Worst P/L</option><option value="score">Highest AI score</option><option value="rank">Best rank</option><option value="urgent">Most urgent</option></select></label>
        </div>
        <div className="grid h-12 grid-cols-2 rounded-full border border-[#faf6f0]/10 bg-[#04140c]/55 p-1">
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`grid min-w-[48px] place-items-center rounded-full ${view === "list" ? "bg-[#ddb159] text-[#061b12]" : "text-[#faf6f0]/48"}`}><Icon name="list" className="size-4" /></button>
          <button type="button" onClick={() => setView("map")} aria-pressed={view === "map"} className={`grid min-w-[48px] place-items-center rounded-full ${view === "map" ? "bg-[#ddb159] text-[#061b12]" : "text-[#faf6f0]/48"}`}><Icon name="map" className="size-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6"><EmptyState title="No holdings match" detail="Clear the search or change the filter to see the full portfolio." /></div>
      ) : view === "map" ? (
        <ExposureMap holdings={filtered} currency={currency} selectedTicker={selectedMapTicker} onSelectTicker={setSelectedMapTicker} onOpenHolding={onOpenHolding} />
      ) : (
        <div className="mt-6 border-y border-[#faf6f0]/8">
          {filtered.map((holding) => <HoldingLedgerRow key={holding.ticker} holding={holding} currency={currency} riskTolerance={riskTolerance} onClick={() => onOpenHolding(holding)} />)}
        </div>
      )}
    </div>
  );
}

function HoldingLedgerRow({ holding, currency, riskTolerance, onClick }: { holding: ExtendedHolding; currency: string; riskTolerance: string | null; onClick: () => void }) {
  const status = statusForHolding(holding, riskTolerance);
  const fillWidth = holding.currentPrice > 0 ? clamp(holding.currentAllocationPct, holding.currentAllocationPct > 0 ? 0.4 : 0, 100) : 0;
  return (
    <button type="button" onClick={onClick} className="group block w-full border-b border-[#faf6f0]/8 px-0 py-5 text-left transition last:border-b-0 hover:bg-[#faf6f0]/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159] sm:px-2 lg:grid lg:grid-cols-[minmax(240px,1.4fr)_minmax(120px,.75fr)_minmax(120px,.8fr)_minmax(130px,.85fr)_minmax(120px,.7fr)] lg:items-center lg:gap-5 lg:py-4">
      <span className="flex min-w-0 items-center gap-3"><StockLogo ticker={holding.ticker} company={holding.company} size={44} /><span className="min-w-0"><span className="block truncate text-[16px] font-black text-[#faf6f0]">{holding.company ?? holding.ticker}</span><span className="mt-1 block truncate text-[11px] font-semibold text-[#faf6f0]/42">{holding.ticker} · {holding.shares.toLocaleString("en-GB", { maximumFractionDigits: 6 })} shares</span></span><span className="ml-auto shrink-0 text-right lg:hidden"><span className="block text-[16px] font-black tabular-nums text-[#faf6f0]">{money(holding.currentValue, currency)}</span><span className={`mt-1 block text-[11px] font-black tabular-nums ${toneClass(holding.totalPnLDollars)}`}>{signedMoney(holding.totalPnLDollars, currency)} · {signedPct(holding.pnlPercent)}</span></span></span>
      <span className="hidden lg:block"><span className="block text-right text-[14px] font-black tabular-nums text-[#faf6f0]">{money(holding.currentValue, currency)}</span><span className={`mt-1 block text-right text-[10px] font-black ${toneClass(holding.totalPnLDollars)}`}>{signedPct(holding.pnlPercent)}</span></span>
      <span className="mt-4 flex items-center justify-between gap-3 lg:mt-0 lg:block lg:text-right"><span className="inline-flex h-8 items-center rounded-full border border-[#ddb159]/20 px-3 text-[9px] font-black text-[#ddb159]">AI #{holding.rank ?? "—"} · {Math.round(holding.score).toLocaleString("en-GB")}</span><span className="text-[10px] font-black text-[#e8bd61] lg:mt-1 lg:block">{status}</span></span>
      <span className="mt-3 block lg:mt-0"><span className="block h-1.5 overflow-hidden rounded-full bg-[#faf6f0]/10"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#9b7228,#d6ae4d_55%,#f3d98b)]" style={{ width: `${fillWidth}%` }} /></span><span className="mt-1.5 flex justify-between text-[9px] font-semibold text-[#faf6f0]/38"><span>{holding.currentPrice > 0 ? `${holding.currentAllocationPct.toFixed(1)}%` : "—"}</span><span>{holding.currentPrice > 0 ? "of total portfolio" : "price unavailable"}</span></span></span>
      <span className="hidden text-right lg:block"><span className="text-[11px] font-black text-[#ddb159]">Open holding →</span></span>
    </button>
  );
}

function ActivitySection({ transactions, holdings, currency, onOpenHolding }: { transactions: PortfolioTransaction[]; holdings: ExtendedHolding[]; currency: string; onOpenHolding: (ticker: string) => void }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const items = useMemo<ActivityItem[]>(() => {
    const transactionItems: ActivityItem[] = transactions.map((transaction) => ({
      id: `tx-${transaction.id}`,
      kind: "transaction",
      date: transaction.createdAt,
      ticker: transaction.ticker,
      title: transactionTitle(transaction.type, transaction.ticker),
      detail: transactionDetail(transaction, currency),
      tone: transaction.type === "sell" || transaction.type === "withdrawal" ? "negative" : transaction.type === "buy" || transaction.type === "deposit" ? "positive" : "neutral",
    }));
    const alertItems: ActivityItem[] = holdings.flatMap((holding) => [
      ...holding.actionAlerts.map((alert) => ({
        id: `action-${holding.ticker}-${alert.id}`,
        kind: "ai" as const,
        date: alert.dataUpdatedAt ?? alert.generatedAt ?? holding.lastReviewedAt,
        ticker: holding.ticker,
        title: alert.title,
        detail: alert.recommendation,
        tone: alert.severity === "critical" ? "negative" as const : alert.severity === "warning" ? "warning" as const : "neutral" as const,
      })),
      ...holding.eventAlerts.slice(0, 3).map((alert) => ({
        id: `event-${holding.ticker}-${alert.id}`,
        kind: "review" as const,
        date: alert.dataUpdatedAt ?? alert.generatedAt ?? holding.lastReviewedAt,
        ticker: holding.ticker,
        title: alert.title,
        detail: alert.message,
        tone: alert.severity === "critical" ? "negative" as const : alert.severity === "warning" ? "warning" as const : alert.severity === "success" ? "positive" as const : "neutral" as const,
      })),
    ]);
    return [...transactionItems, ...alertItems].filter((item) => item.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);
  }, [currency, holdings, transactions]);
  const visible = items.filter((item) => filter === "all" || item.kind === filter || (filter === "reviews" && item.kind === "review"));
  const grouped = visible.reduce<Record<string, ActivityItem[]>>((acc, item) => {
    const key = new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
  return (
    <div className="px-4 pt-7 sm:px-6 lg:px-0 lg:pt-8">
      <SectionHeading eyebrow="Connected history" title="Portfolio activity" />
      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {(["all", "transactions", "ai", "reviews"] as ActivityFilter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`h-10 shrink-0 rounded-full px-4 text-[10px] font-black capitalize ${filter === value ? "bg-[#ddb159] text-[#061b12]" : "border border-[#faf6f0]/10 text-[#faf6f0]/48"}`}>{value === "ai" ? "AI events" : value}</button>)}
      </div>
      {visible.length === 0 ? <div className="mt-6"><EmptyState title="No activity yet" detail="Transactions, reviews and StockGPT portfolio events will appear here." /></div> : <div className="mt-6 max-w-4xl">{Object.entries(grouped).map(([date, dateItems]) => <section key={date} className="mt-8 first:mt-0"><h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">{date}</h3><div className="mt-3 border-l border-[#faf6f0]/12 pl-5">{dateItems.map((item) => <article key={item.id} className="relative min-h-[76px] border-b border-[#faf6f0]/8 py-4 last:border-b-0"><span className={`absolute -left-[25px] top-6 size-2 rounded-full ring-4 ring-[#061b12] ${item.tone === "positive" ? "bg-[#61d7ab]" : item.tone === "negative" ? "bg-[#f1908d]" : item.tone === "warning" ? "bg-[#e8bd61]" : "bg-[#faf6f0]/32"}`} /><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[13px] font-black text-[#faf6f0]">{item.title}</p><p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/46">{item.detail}</p><p className="mt-2 text-[9px] font-semibold text-[#faf6f0]/28">{formatDate(item.date, true)}</p></div>{item.ticker && <button type="button" onClick={() => onOpenHolding(item.ticker!)} className="shrink-0 rounded-full border border-[#ddb159]/20 px-3 py-2 text-[9px] font-black text-[#ddb159]">{item.ticker} →</button>}</div></article>)}</div></section>)}</div>}
    </div>
  );
}

function AddPortfolioSheet({ open, onClose, portfolioId, currency, cashBalance, stockOptions, usdToDisplayRate, routerRefresh }: { open: boolean; onClose: () => void; portfolioId: string; currency: string; cashBalance: number; stockOptions: StockOption[]; usdToDisplayRate: number; routerRefresh: () => void }) {
  const [mode, setMode] = useState<"menu" | "cash" | "holding" | "import">("menu");
  const [amount, setAmount] = useState("");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useEffect(() => { if (!open) { setMode("menu"); setMessage(null); } }, [open]);
  const matches = stockOptions.filter((stock) => !ticker || stock.ticker.includes(ticker.toUpperCase()) || String(stock.company ?? "").toLowerCase().includes(ticker.toLowerCase())).slice(0, 6);
  const selectedStock = stockOptions.find((stock) => stock.ticker === ticker.toUpperCase());
  const holdingValue = Number(shares) * Number(price || selectedStock?.price || 0);
  const resultingAllocation = cashBalance + holdingValue > 0 ? (holdingValue / (cashBalance + holdingValue)) * 100 : 0;
  const toUsd = (value: number) => value / (usdToDisplayRate > 0 ? usdToDisplayRate : 1);
  function submitCash() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) { setMessage("Enter a positive cash amount."); return; }
    setMessage("Adding cash…");
    startTransition(async () => {
      const result = await addCash({ portfolioId, amount: toUsd(parsed) });
      if (!result.success) { setMessage(result.error ?? "Could not add cash."); return; }
      setMessage("Cash added."); setAmount(""); routerRefresh(); setTimeout(onClose, 500);
    });
  }
  function submitHolding() {
    const shareCount = Number(shares); const entry = Number(price || selectedStock?.price);
    if (!selectedStock || !Number.isFinite(shareCount) || shareCount <= 0 || !Number.isFinite(entry) || entry <= 0) { setMessage("Choose a supported stock and enter valid shares and price."); return; }
    setMessage("Adding holding…");
    startTransition(async () => {
      const result = await logExistingHolding({ portfolioId, ticker: selectedStock.ticker, shares: shareCount, entryPrice: toUsd(entry) });
      if (!result.success) { setMessage(result.error ?? "Could not add holding."); return; }
      setMessage(`${selectedStock.ticker} added.`); setTicker(""); setShares(""); setPrice(""); routerRefresh(); setTimeout(onClose, 600);
    });
  }
  return <Sheet open={open} onClose={onClose} title={mode === "menu" ? "Add to portfolio" : mode === "cash" ? "Add cash" : mode === "holding" ? "Add holding" : "Import Trading 212"} subtitle={currency === "USD" ? "Portfolio actions" : `Displayed in ${currency}`}>
    {mode !== "menu" && <button type="button" onClick={() => { setMode("menu"); setMessage(null); }} className="mb-5 text-[11px] font-black text-[#ddb159]">← Back to actions</button>}
    {mode === "menu" && <div className="divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8"><ActionRow title="Add holding" detail="Log shares and average price" onClick={() => setMode("holding")} /><ActionRow title="Add cash" detail="Increase the portfolio cash balance" onClick={() => setMode("cash")} /><ActionRow title="Import Trading 212" detail="Preview and merge a supported CSV" onClick={() => setMode("import")} /><Link href="/portfolio?builder=1" className="flex min-h-[64px] items-center justify-between gap-4 py-4"><span><span className="block text-[14px] font-black text-[#faf6f0]">Create another portfolio</span><span className="mt-1 block text-[11px] font-semibold text-[#faf6f0]/42">Open the portfolio builder</span></span><Icon name="arrow" className="size-5 text-[#ddb159]" /></Link></div>}
    {mode === "cash" && <div><p className="text-[13px] font-semibold leading-6 text-[#faf6f0]/52">Add cash in your displayed currency. The portfolio allocation view will update after confirmation.</p><label className="mt-6 block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">Amount ({currency})</span><input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[20px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]" /></label><button type="button" disabled={isPending} onClick={submitCash} className="mt-5 h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12] disabled:opacity-50">{isPending ? "Adding…" : "Add cash"}</button></div>}
    {mode === "holding" && <div><label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">Stock</span><input value={ticker} onChange={(event) => { const value = event.target.value.toUpperCase(); setTicker(value); const match = stockOptions.find((stock) => stock.ticker === value); if (match?.price) setPrice(String(match.price)); }} placeholder="Ticker or company" className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[14px] font-black uppercase text-[#faf6f0] outline-none focus:border-[#ddb159]" /></label>{ticker && !selectedStock && matches.length > 0 && <div className="mt-2 divide-y divide-[#faf6f0]/8 rounded-2xl border border-[#faf6f0]/8 bg-[#04140c]">{matches.map((stock) => <button key={stock.ticker} type="button" onClick={() => { setTicker(stock.ticker); if (stock.price) setPrice(String(stock.price)); }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><span className="min-w-0 truncate text-[12px] font-black text-[#faf6f0]">{stock.ticker} <span className="font-semibold text-[#faf6f0]/38">{stock.company}</span></span><span className="text-[10px] font-black text-[#ddb159]">#{stock.rank ?? "—"}</span></button>)}</div>}<div className="mt-4 grid grid-cols-2 gap-3"><label><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">Shares</span><input type="number" inputMode="decimal" min={0} step="0.000001" value={shares} onChange={(event) => setShares(event.target.value)} className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[15px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]" /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">Average price</span><input type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[15px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]" /></label></div>{holdingValue > 0 && <div className="mt-5 border-y border-[#faf6f0]/8 py-4"><div className="flex justify-between gap-4 text-[11px] font-semibold text-[#faf6f0]/46"><span>Estimated value</span><strong className="text-[#faf6f0]">{money(holdingValue, currency)}</strong></div><div className="mt-2 flex justify-between gap-4 text-[11px] font-semibold text-[#faf6f0]/46"><span>Approx. initial share</span><strong className="text-[#ddb159]">{resultingAllocation.toFixed(1)}%</strong></div></div>}<button type="button" disabled={isPending} onClick={submitHolding} className="mt-5 h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12] disabled:opacity-50">{isPending ? "Adding…" : "Review and add"}</button></div>}
    {mode === "import" && <Trading212CsvImport portfolioId={portfolioId} compact />}
    {message && <p className="mt-4 rounded-2xl bg-[#faf6f0]/5 px-4 py-3 text-[11px] font-bold text-[#faf6f0]/62">{message}</p>}
  </Sheet>;
}

function ActionRow({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-[64px] w-full items-center justify-between gap-4 py-4 text-left"><span><span className="block text-[14px] font-black text-[#faf6f0]">{title}</span><span className="mt-1 block text-[11px] font-semibold text-[#faf6f0]/42">{detail}</span></span><Icon name="arrow" className="size-5 text-[#ddb159]" /></button>;
}

function ManagePortfolioSheet({ open, onClose, portfolioId, meta, routerRefresh }: { open: boolean; onClose: () => void; portfolioId: string; meta: Props["portfolioMeta"]; routerRefresh: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(meta.name);
  const [objective, setObjective] = useState(meta.objective ?? "balanced");
  const [risk, setRisk] = useState(meta.riskTolerance ?? "moderate");
  const [horizon, setHorizon] = useState(meta.timeHorizon ?? "medium");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useEffect(() => { if (open) { setName(meta.name); setObjective(meta.objective ?? "balanced"); setRisk(meta.riskTolerance ?? "moderate"); setHorizon(meta.timeHorizon ?? "medium"); setMessage(null); } }, [meta, open]);
  const dirty = name.trim() !== meta.name || objective !== (meta.objective ?? "balanced") || risk !== (meta.riskTolerance ?? "moderate") || horizon !== (meta.timeHorizon ?? "medium");
  function save() {
    if (!name.trim()) { setMessage("Portfolio name cannot be empty."); return; }
    setMessage("Saving changes…");
    startTransition(async () => {
      const rename = name.trim() !== meta.name ? await renamePortfolio({ portfolioId, name: name.trim() }) : { success: true };
      if (!rename.success) { setMessage(rename.error ?? "Could not rename portfolio."); return; }
      const preferences = await updatePortfolioPreferences({ portfolioId, objective: objective as "growth" | "income" | "balanced" | "capital_preservation" | "watchlist", riskTolerance: risk as "conservative" | "moderate" | "aggressive", timeHorizon: horizon as "short" | "medium" | "long" });
      if (!preferences.success) { setMessage(preferences.error ?? "Could not save preferences."); return; }
      setMessage("Portfolio updated."); routerRefresh(); setTimeout(onClose, 500);
    });
  }
  function remove() {
    if (!window.confirm(`Delete “${meta.name}”? This removes this portfolio and its holdings.`)) return;
    startTransition(async () => {
      const result = await deletePortfolio({ portfolioId });
      if (!result.success) { setMessage(result.error ?? "Could not delete portfolio."); return; }
      router.push("/portfolio"); router.refresh();
    });
  }
  return <Sheet open={open} onClose={onClose} title="Manage portfolio" subtitle="Preferences and portfolio administration"><div className="space-y-8"><section><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Portfolio details</p><label className="mt-4 block"><span className="mb-2 block text-[10px] font-black text-[#faf6f0]/42">Name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04140c] px-4 text-[14px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]" /></label><p className="mt-3 text-[11px] font-semibold text-[#faf6f0]/38">Created {formatDate(meta.createdAt)} · Display currency {meta.currency}</p></section><section className="border-t border-[#faf6f0]/8 pt-7"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Investment preferences</p><div className="mt-4 grid gap-4"><PreferenceSelect label="Objective" value={objective} onChange={setObjective} options={[['growth','Growth'],['income','Income'],['balanced','Balanced'],['capital_preservation','Preservation'],['watchlist','Watchlist']]} /><PreferenceSelect label="Risk tolerance" value={risk} onChange={setRisk} options={[['conservative','Conservative'],['moderate','Moderate'],['aggressive','Aggressive']]} /><PreferenceSelect label="Time horizon" value={horizon} onChange={setHorizon} options={[['short','Short'],['medium','Medium'],['long','Long']]} /></div></section><section className="border-t border-[#faf6f0]/8 pt-7"><button type="button" disabled={!dirty || isPending} onClick={save} className="h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12] disabled:opacity-35">{isPending ? "Saving…" : "Save changes"}</button>{message && <p className="mt-3 text-[11px] font-semibold text-[#faf6f0]/52">{message}</p>}</section><section className="border-t border-red-400/14 pt-8"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">Danger zone</p><button type="button" disabled={isPending} onClick={remove} className="mt-4 h-12 w-full rounded-2xl border border-red-400/26 text-[11px] font-black text-red-200 disabled:opacity-40">Delete portfolio</button></section></div></Sheet>;
}

function PreferenceSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label><span className="mb-2 block text-[10px] font-black text-[#faf6f0]/42">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04140c] px-4 text-[13px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function AnalysisSheet({ open, onClose, summary, portfolioId }: { open: boolean; onClose: () => void; summary: PortfolioHealthSummary; portfolioId: string }) {
  const items = [
    ["Health score", `${summary.score}/100 · ${summary.label}`],
    ["Weighted AI score", summary.weightedAvgScore?.toLocaleString("en-GB") ?? "Unavailable"],
    ["Diversification", `${summary.holdingsCount} holdings across ${summary.sectorCount} sectors`],
    ["Portfolio concentration", `${summary.largestPositionPct.toFixed(1)}% in the largest position`],
    ["Action reviews", `${summary.actionAlerts} active`],
    ["Supporting events", `${summary.eventAlerts} active`],
    ["Cash allocation", `${summary.cashDrag.toFixed(1)}%`],
  ];
  return <Sheet open={open} onClose={onClose} title="Portfolio analysis" subtitle="How StockGPT is reading this portfolio"><p className="text-[16px] font-black leading-7 text-[#faf6f0]">{summary.explanation}</p><dl className="mt-7 divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">{items.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 py-4"><dt className="text-[11px] font-semibold text-[#faf6f0]/42">{label}</dt><dd className="max-w-[58%] text-right text-[12px] font-black text-[#faf6f0]">{value}</dd></div>)}</dl><AskStockGPTButton canUseAskStockGPT isAuthenticated label="Ask about this portfolio" context={{ contextType: "portfolio", portfolioId }} className="mt-7 h-12 w-full rounded-2xl" /><p className="mt-5 text-[10px] font-semibold leading-5 text-[#faf6f0]/34">This analysis is generated from portfolio holdings, rankings, alerts and current valuation data. It is educational only and may be incomplete when market data is stale or unavailable.</p></Sheet>;
}
