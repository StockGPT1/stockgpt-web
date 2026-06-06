"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
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

type PortfolioTransaction = {
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

type ExtendedHolding = EnrichedHolding & {
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
  portfolioMeta: {
    id: string;
    name: string;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
    cashBalance: number;
    cashDepositedTotal: number;
    currency?: string | null;
  };
  compactImportWidget?: ReactNode;
};

type Section = "holdings" | "add" | "activity" | "manage";
type HoldingFilter = "all" | "action" | "winners" | "losers" | "oversized";
type HoldingSort = "urgent" | "value" | "worst" | "best" | "rank" | "ticker";

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
      return "Trading 212 import";
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

function recommendationClass(recommendation: EnrichedHolding["recommendation"]) {
  if (recommendation.includes("Sell") || recommendation.includes("Urgently")) return "bg-red-600 text-white";
  if (recommendation.includes("Trim")) return "bg-amber-500 text-white";
  if (recommendation.includes("Buying")) return "bg-emerald-500 text-white";
  if (recommendation.includes("Strong")) return "bg-emerald-100 text-emerald-800";
  return "bg-[#072116] text-[#ddb159]";
}

function SectionButton({ section, active, setSection, label }: { section: Section; active: Section; setSection: (section: Section) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => setSection(section)}
      className={[
        "h-10 rounded-full px-4 text-[10px] font-black uppercase tracking-[0.1em] transition",
        active === section
          ? "bg-[#ddb159] text-[#072116]"
          : "border border-[#ddb159]/20 bg-[#04180f]/60 text-[#faf6f0]/58 hover:border-[#ddb159]/60 hover:text-[#ddb159]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-200" : tone === "gold" ? "text-[#ddb159]" : "text-[#faf6f0]";
  return (
    <div className="min-w-0 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/62 p-3">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]/70">{label}</p>
      <p className={`mt-1 truncate text-[18px] font-black leading-none tracking-[-0.03em] ${valueClass}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#faf6f0]/42">{sub}</p>
    </div>
  );
}

function MiniMetric({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : tone === "gold" ? "text-[#8a641a]" : "text-[#072116]";
  return (
    <div className="min-w-0 rounded-xl border border-[#072116]/8 bg-white px-2.5 py-2">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#072116]/40">{label}</p>
      <p className={`mt-1 truncate text-[13px] font-black leading-none ${valueClass}`}>{value}</p>
      <p className="mt-1 truncate text-[9px] font-semibold text-[#072116]/42">{sub}</p>
    </div>
  );
}

function PortfolioTopBar({ portfolioId, portfolios }: { portfolioId: string; portfolios: PortfolioOption[] }) {
  const router = useRouter();
  const portfolioOptions = portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name, description: portfolio.currency ?? "USD" }));
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-[#ddb159]/18 bg-[#061b12]/72 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio command centre</p>
        <p className="mt-1 text-[12px] font-semibold leading-5 text-[#faf6f0]/48">Switch portfolios, review health, add holdings and manage positions from one page.</p>
      </div>
      <div className="grid min-w-0 gap-2 sm:flex sm:items-center sm:justify-end">
        {portfolios.length > 1 && <StockGPTSelect value={portfolioId} options={portfolioOptions} onChange={(nextPortfolioId) => router.push(`/portfolio?portfolio=${nextPortfolioId}`)} ariaLabel="Choose portfolio" className="sm:w-[300px]" />}
        <Link href="/portfolio?builder=1" className="inline-flex h-11 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105">+ New AI portfolio</Link>
      </div>
    </div>
  );
}

function HeroSummary({ portfolioName, currency, summary }: { portfolioName: string; currency: string; summary: ReturnType<typeof buildPortfolioHealthSummary> }) {
  const isPositive = summary.totalPnl >= 0;
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#ddb159]/28 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#04180f)] p-4 text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[#ddb159]/16 blur-3xl" />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Active portfolio</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-[36px] font-black leading-none tracking-[-0.06em] sm:text-[48px]">{portfolioName}</h1>
            <span className="rounded-full bg-[#ddb159] px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116]">{summary.label} {summary.score}/100</span>
          </div>
          <p className="mt-3 max-w-3xl text-[13px] font-semibold leading-6 text-[#faf6f0]/60">{summary.explanation}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <StatCard label="Portfolio value" value={money(summary.totalValue, currency)} sub="holdings + cash" />
            <StatCard label="Total P/L" value={`${money(summary.totalPnl, currency)} · ${pct(summary.totalPnlPct)}`} sub="realised + unrealised" tone={isPositive ? "positive" : "negative"} />
            <StatCard label="Weighted score" value={summary.weightedAvgScore ? String(summary.weightedAvgScore) : "—"} sub="value-weighted" tone="gold" />
          </div>
        </div>
        <div className="rounded-[26px] border border-[#ddb159]/18 bg-[#04180f]/64 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]/72">Health drivers</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatCard label="Holdings" value={String(summary.holdingsCount)} sub={`${summary.sectorCount} sectors`} />
            <StatCard label="Cash" value={`${summary.cashDrag.toFixed(1)}%`} sub="drag" />
            <StatCard label="Alerts" value={String(summary.actionAlerts)} sub={`${summary.eventAlerts} events`} tone={summary.actionAlerts > 0 ? "negative" : "positive"} />
            <StatCard label="Largest" value={`${summary.largestPositionPct.toFixed(1)}%`} sub="position" tone={summary.largestPositionPct > 30 ? "negative" : "positive"} />
          </div>
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
    if (!Number.isFinite(value) || value <= 0) { setMessage("Enter a valid cash amount."); return; }
    startTransition(async () => {
      const result = await addCash({ portfolioId, amount: value });
      if (!result.success) { setMessage(result.error ?? "Could not add cash."); return; }
      setAmount(""); setMessage("Cash added."); router.refresh();
    });
  }
  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Cash</p><h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Add cash</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><input type="number" min={0} step={10} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={currency === "USD" ? "1000" : "1000"} className="h-11 min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" /><button type="button" onClick={submit} disabled={isPending} className="h-11 rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">{isPending ? "Adding…" : "+ Add"}</button></div>
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
  function selectStock(stock: StockOption) { setQuery(stock.ticker); if (stock.price && Number.isFinite(stock.price)) setEntryPrice(String(stock.price)); setMessage(null); }
  function submit() {
    const shareCount = Number(shares); const price = Number(entryPrice);
    if (!exactMatch) { setMessage("Choose a ticker from the dropdown."); return; }
    if (!Number.isFinite(shareCount) || shareCount <= 0) { setMessage("Enter the number of shares."); return; }
    if (!Number.isFinite(price) || price <= 0) { setMessage("Enter a valid average entry price."); return; }
    startTransition(async () => {
      const result = await logExistingHolding({ portfolioId, ticker: exactMatch.ticker, shares: shareCount, entryPrice: price });
      if (!result.success) { setMessage(result.error ?? "Could not add holding."); return; }
      setQuery(""); setShares(""); setEntryPrice(""); setMessage(`${exactMatch.ticker} added.`); router.refresh();
    });
  }
  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Manual holding</p><h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Add stock</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="relative block min-w-0"><span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Ticker</span><input value={query} onChange={(event) => { const value = event.target.value.toUpperCase(); setQuery(value); const match = stockOptions.find((stock) => stock.ticker === value.trim()); if (match?.price) setEntryPrice(String(match.price)); }} placeholder="AAPL" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black uppercase outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" />{suggestions.length > 0 && <div className="absolute left-0 right-0 top-[68px] z-30 max-h-56 overflow-y-auto rounded-2xl border border-[#ddb159]/30 bg-white p-1 shadow-[0_16px_34px_rgba(0,0,0,0.22)]">{suggestions.map((stock) => <button key={stock.ticker} type="button" onClick={() => selectStock(stock)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl px-3 py-2 text-left hover:bg-[#ddb159]/10"><span className="min-w-0 truncate text-[12px] font-black">{stock.ticker} <span className="font-semibold text-[#072116]/45">· {stock.company}</span></span><span className="text-[10px] font-bold text-[#072116]/45">#{stock.rank ?? "—"}</span></button>)}</div>}</label><label className="block min-w-0"><span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Shares</span><input type="number" min={0} step="0.000001" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="10" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" /></label><label className="block min-w-0"><span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">Avg price</span><input type="number" min={0} step="0.01" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} placeholder="0.00" className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none placeholder:text-[#072116]/25 focus:border-[#ddb159]" /></label></div>
      <button type="button" onClick={submit} disabled={isPending} className="mt-3 h-11 w-full rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-60">{isPending ? "Adding…" : "+ Add holding"}</button>
      {message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}
    </div>
  );
}

function HoldingActions({ portfolioId, holding }: { portfolioId: string; holding: ExtendedHolding }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function run(action: "trim25" | "trim50" | "sell" | "remove") {
    const labels = { trim25: "trim 25%", trim50: "trim 50%", sell: "sell this holding and credit cash", remove: "remove this holding without crediting cash" };
    if (!window.confirm(`Are you sure you want to ${labels[action]} for ${holding.ticker}?`)) return;
    startTransition(async () => {
      const result = action === "remove"
        ? await removeHolding({ portfolioId, ticker: holding.ticker, creditCash: false })
        : await trimHolding({ portfolioId, ticker: holding.ticker, percentage: action === "trim25" ? 25 : action === "trim50" ? 50 : 100 });
      if (!result.success) { setMessage(result.error ?? "Could not update holding."); return; }
      setMessage(action === "remove" ? "Holding removed." : "Holding updated.");
      router.refresh();
    });
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" disabled={isPending} onClick={() => run("trim25")} className="rounded-full border border-amber-400/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-amber-700 disabled:opacity-50">Trim 25%</button>
      <button type="button" disabled={isPending} onClick={() => run("trim50")} className="rounded-full border border-amber-400/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-amber-700 disabled:opacity-50">Trim 50%</button>
      <button type="button" disabled={isPending} onClick={() => run("sell")} className="rounded-full border border-red-500/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-50">Sell all</button>
      <button type="button" disabled={isPending} onClick={() => run("remove")} className="rounded-full border border-[#072116]/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#072116]/55 disabled:opacity-50">Remove only</button>
      {message && <span className="text-[10px] font-bold text-[#072116]/55">{message}</span>}
    </div>
  );
}

function HoldingRow({ portfolioId, holding, currency }: { portfolioId: string; holding: ExtendedHolding; currency: string }) {
  const recClass = recommendationClass(holding.recommendation);
  const isPositive = holding.totalPnLDollars >= 0;
  const mainSignal = holding.actionAlerts[0] ?? holding.eventAlerts[0] ?? null;
  return (
    <div className="grid min-w-0 gap-3 rounded-2xl border border-[#072116]/8 bg-[#faf6f0] p-3 text-[#072116] shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:border-[#ddb159]/45 hover:bg-white sm:grid-cols-[minmax(0,1.1fr)_340px] sm:items-center">
      <div className="min-w-0">
        <Link href={`/stock/${holding.ticker}`} className="flex min-w-0 items-start gap-3">
          <StockLogo ticker={holding.ticker} size={40} />
          <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="shrink-0 text-[22px] font-black leading-none tracking-[-0.045em] text-[#072116]">{holding.ticker}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${recClass}`}>{holding.recommendation}</span></div><p className="mt-2 truncate text-[13px] font-black text-[#072116]/68">{holding.company ?? "—"}</p><p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-[#072116]/62">{mainSignal ? mainSignal.title : holding.aiSummary}</p></div>
        </Link>
        <HoldingActions portfolioId={portfolioId} holding={holding} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><MiniMetric label="Value" value={money(holding.currentValue, currency)} sub={`${number(holding.shares, 4)} sh`} /><MiniMetric label="P/L" value={money(holding.totalPnLDollars, currency)} sub={pct(holding.pnlPercent)} tone={isPositive ? "positive" : "negative"} /><MiniMetric label="Allocation" value={`${holding.currentAllocationPct.toFixed(1)}%`} sub={`target ${holding.targetAllocationPct?.toFixed(1) ?? "—"}%`} /><MiniMetric label="Score" value={number(holding.score, 0)} sub={`rank #${holding.rank ?? "—"}`} tone="gold" /></div>
    </div>
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
    if (!cleanName) { setMessage("Portfolio name cannot be empty."); return; }
    startRenaming(async () => { const result = await renamePortfolio({ portfolioId, name: cleanName }); if (!result.success) { setMessage(result.error ?? "Could not rename portfolio."); return; } setMessage("Portfolio renamed."); router.refresh(); });
  }
  function runDelete() {
    if (!window.confirm(`Delete "${portfolioName}"? This removes this portfolio and its holdings only.`)) return;
    startDeleting(async () => { const result = await deletePortfolio({ portfolioId }); if (!result.success) { setMessage(result.error ?? "Could not delete portfolio."); return; } router.push("/portfolio"); router.refresh(); });
  }
  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Manage portfolio</p><h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Rename or delete</h3><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="h-11 min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none focus:border-[#ddb159]" /><button type="button" onClick={saveName} disabled={isRenaming || name.trim() === portfolioName.trim()} className="h-11 rounded-2xl bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] disabled:opacity-60">{isRenaming ? "Saving…" : "Rename"}</button><button type="button" onClick={runDelete} disabled={isDeleting} className="h-11 rounded-2xl border border-red-500/35 px-5 text-[11px] font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-60">{isDeleting ? "Deleting…" : "Delete"}</button></div>{message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-[#072116]/65">{message}</p>}</div>
  );
}

function ActivityPanel({ transactions, currency }: { transactions: PortfolioTransaction[]; currency: string }) {
  if (transactions.length === 0) return <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]"><p className="text-[16px] font-black">No activity yet.</p><p className="mt-1 text-[12px] font-semibold text-[#072116]/55">Imports, cash deposits and manual holdings will show here.</p></div>;
  return <div className="grid gap-2">{transactions.slice(0, 12).map((transaction) => <div key={transaction.id} className="grid gap-2 rounded-2xl bg-[#faf6f0] px-3 py-3 text-[#072116] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-[13px] font-black">{transactionLabel(transaction.type)}{transaction.ticker ? ` · ${transaction.ticker}` : ""}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/45">{formatDate(transaction.createdAt)}{transaction.notes ? ` · ${transaction.notes}` : ""}</p></div><div className="flex flex-wrap gap-2 sm:justify-end">{transaction.shares != null && <span className="rounded-full bg-[#072116]/6 px-2 py-1 text-[10px] font-bold text-[#072116]/60">{number(transaction.shares, 4)} shares</span>}{transaction.amount != null && <span className="rounded-full bg-[#ddb159]/16 px-2 py-1 text-[10px] font-black text-[#8a641a]">{money(transaction.amount, transaction.currency ?? currency)}</span>}</div></div>)}</div>;
}

export function PortfolioCommandCentre({ portfolioId, portfolios, holdings, stockOptions = [], transactions = [], portfolioMeta, compactImportWidget }: Props) {
  const [section, setSection] = useState<Section>("holdings");
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [sort, setSort] = useState<HoldingSort>("urgent");
  const currency = portfolioMeta.currency ?? "USD";
  const summary = buildPortfolioHealthSummary({ id: portfolioMeta.id, name: portfolioMeta.name, currency, riskTolerance: portfolioMeta.riskTolerance, holdings, transactions, cashBalance: portfolioMeta.cashBalance, cashDepositedTotal: portfolioMeta.cashDepositedTotal });
  const filterOptions = [{ value: "all", label: "All holdings" }, { value: "action", label: "Action needed" }, { value: "winners", label: "Winners" }, { value: "losers", label: "Losers" }, { value: "oversized", label: "Oversized" }];
  const sortOptions = [{ value: "urgent", label: "Most urgent" }, { value: "value", label: "Highest value" }, { value: "worst", label: "Worst P/L" }, { value: "best", label: "Best P/L" }, { value: "rank", label: "Best rank" }, { value: "ticker", label: "Ticker A-Z" }];
  const filteredHoldings = useMemo(() => {
    let next = [...holdings];
    if (filter === "action") next = next.filter((holding) => holding.actionAlerts.length > 0);
    if (filter === "winners") next = next.filter((holding) => holding.totalPnLDollars > 0);
    if (filter === "losers") next = next.filter((holding) => holding.totalPnLDollars < 0);
    if (filter === "oversized") next = next.filter(isOversized);
    next.sort((a, b) => { if (sort === "urgent") return holdingUrgencyScore(b) - holdingUrgencyScore(a); if (sort === "value") return b.currentValue - a.currentValue; if (sort === "worst") return a.pnlPercent - b.pnlPercent; if (sort === "best") return b.pnlPercent - a.pnlPercent; if (sort === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999); return a.ticker.localeCompare(b.ticker); });
    return next;
  }, [filter, holdings, sort]);

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      <PortfolioTopBar portfolioId={portfolioId} portfolios={portfolios} />
      <HeroSummary portfolioName={portfolioMeta.name} currency={currency} summary={summary} />
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><SectionButton section="holdings" active={section} setSection={setSection} label="Holdings" /><SectionButton section="add" active={section} setSection={setSection} label="Add / Import" /><SectionButton section="activity" active={section} setSection={setSection} label="Activity" /><SectionButton section="manage" active={section} setSection={setSection} label="Manage" /></div>
      {section === "holdings" && <section className="grid gap-3"><div className="grid gap-3 rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Holdings</p><p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">Review, trim, sell or remove holdings without leaving the portfolio page.</p></div><div className="grid gap-2 sm:flex sm:justify-end"><StockGPTSelect value={filter} options={filterOptions} onChange={(value) => setFilter(value as HoldingFilter)} ariaLabel="Filter holdings" className="sm:w-[190px]" buttonClassName="h-10 rounded-2xl" /><StockGPTSelect value={sort} options={sortOptions} onChange={(value) => setSort(value as HoldingSort)} ariaLabel="Sort holdings" className="sm:w-[190px]" buttonClassName="h-10 rounded-2xl" /></div></div>{holdings.length === 0 ? <div className="rounded-3xl border border-dashed border-[#ddb159]/24 bg-[#061b12]/72 p-6 text-center text-[#faf6f0]"><p className="text-[24px] font-black tracking-[-0.05em]">No holdings yet.</p><p className="mx-auto mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#faf6f0]/52">Use Add / Import to add cash, log holdings or import from Trading 212.</p></div> : filteredHoldings.length === 0 ? <div className="rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-5 text-[#faf6f0]"><p className="text-[16px] font-black">No holdings match this filter.</p><p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">Try changing the filter or sort option.</p></div> : <div className="grid gap-2.5">{filteredHoldings.map((holding) => <HoldingRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} />)}</div>}</section>}
      {section === "add" && <section className="grid gap-3 xl:grid-cols-[0.8fr_1fr_0.9fr]"><AddCashPanel portfolioId={portfolioId} currency={currency} /><AddHoldingPanel portfolioId={portfolioId} stockOptions={stockOptions} /><div className="min-w-0">{compactImportWidget}</div></section>}
      {section === "activity" && <ActivityPanel transactions={transactions} currency={currency} />}
      {section === "manage" && <ManagePanel portfolioId={portfolioId} portfolioName={portfolioMeta.name} />}
      <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">⚠️ StockGPT portfolio alerts and health scores are generated from rankings, diagnostics, portfolio data, price action and recent news. They are research tools, not financial advice.</p>
    </div>
  );
}
