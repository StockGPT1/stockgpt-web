"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StockLogo } from "@/components/StockLogo";
import {
  addHolding,
  deletePortfolio,
  markReviewed,
  removeHolding,
  updateEntryPrice,
  updateShares,
} from "@/lib/actions/portfolio-management";
import type {
  AlertCategory,
  EnrichedHolding,
  HoldingAlert,
  HoldingTrigger,
  SectorMomentum,
} from "@/lib/portfolio-alerts";

type Props = {
  holdings: EnrichedHolding[];
  portfolioMeta: {
    name: string;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
  };
};

function severityStyle(severity: HoldingAlert["severity"]) {
  if (severity === "critical") {
    return { badge: "bg-red-600 text-white", border: "border-red-300", bg: "bg-red-50", text: "text-red-900", label: "Critical" };
  }

  if (severity === "warning") {
    return { badge: "bg-amber-500 text-white", border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-900", label: "Warning" };
  }

  if (severity === "success") {
    return { badge: "bg-emerald-500 text-white", border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-900", label: "Positive" };
  }

  return { badge: "bg-blue-500 text-white", border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-900", label: "Info" };
}

function categoryLabel(category: AlertCategory) {
  return category === "action" ? "Action Alert" : "Event Alert";
}

function recommendationStyle(recommendation: EnrichedHolding["recommendation"]) {
  if (recommendation === "Sell Immediately") return { bg: "#dc2626", text: "#ffffff", glow: "bg-red-600/20" };
  if (recommendation === "Sell Whole Position") return { bg: "#dc2626", text: "#ffffff", glow: "bg-red-600/15" };
  if (recommendation === "Review Urgently") return { bg: "#ef4444", text: "#ffffff", glow: "bg-red-500/15" };
  if (recommendation === "Consider Trimming") return { bg: "#f59e0b", text: "#ffffff", glow: "bg-amber-500/15" };
  if (recommendation === "Consider Buying More") return { bg: "#10b981", text: "#ffffff", glow: "bg-emerald-500/15" };
  if (recommendation === "Strong Hold") return { bg: "#34d399", text: "#072116", glow: "bg-emerald-400/15" };
  return { bg: "#072116", text: "#ddb159", glow: "bg-[#072116]/15" };
}

function sectorMomentumStyle(momentum: SectorMomentum) {
  if (momentum === "Booming") return { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", icon: "🚀", label: "Sector Booming" };
  if (momentum === "Strong") return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "↗", label: "Sector Strong" };
  if (momentum === "Mixed") return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "→", label: "Sector Mixed" };
  if (momentum === "Weak") return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "↘", label: "Sector Weak" };
  if (momentum === "Struggling") return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "⚠", label: "Sector Struggling" };
  return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: "?", label: "Unknown" };
}

function triggerToneStyle(tone: HoldingTrigger["tone"]) {
  if (tone === "positive") return { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-700", text: "text-emerald-900" };
  if (tone === "negative") return { bg: "bg-red-50", border: "border-red-200", icon: "text-red-700", text: "text-red-900" };
  return { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-700", text: "text-blue-900" };
}

function TriggerIcon({ icon }: { icon: HoldingTrigger["icon"] }) {
  if (icon === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
      </svg>
    );
  }

  if (icon === "target") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v5M12 18v.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function AlertCard({ alert }: { alert: HoldingAlert }) {
  const style = severityStyle(alert.severity);

  return (
    <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${style.badge}`}>
          {style.label}
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#072116]/65">
          {categoryLabel(alert.category)}
        </span>
      </div>

      <p className={`mt-2 text-[13px] font-black tracking-[-0.01em] ${style.text}`}>{alert.title}</p>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#072116]/70">{alert.message}</p>

      {alert.evidence.length > 0 && (
        <div className="mt-2 rounded-lg bg-white/70 p-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">Evidence</p>
          <ul className="mt-1 grid gap-1">
            {alert.evidence.slice(0, 5).map((item) => (
              <li key={item} className="text-[11px] font-semibold leading-snug text-[#072116]/70">• {item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 rounded-lg bg-white p-2">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">What to do</p>
        <p className="mt-0.5 text-[12px] font-bold leading-relaxed text-[#072116]">{alert.recommendation}</p>
      </div>

      <p className="mt-2 text-[10px] font-semibold leading-relaxed text-[#072116]/45">{alert.expiresWhen}</p>
    </div>
  );
}

function HoldingRow({ holding }: { holding: EnrichedHolding }) {
  const [isPending, startTransition] = useTransition();
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingShares, setEditingShares] = useState(false);
  const [priceInput, setPriceInput] = useState(holding.entryPrice.toString());
  const [sharesInput, setSharesInput] = useState(holding.shares.toString());
  const [showEvents, setShowEvents] = useState(false);
  const [showActions, setShowActions] = useState(holding.actionAlerts.length > 0);
  const [showLevels, setShowLevels] = useState(false);

  const recStyle = recommendationStyle(holding.recommendation);
  const sectorStyle = sectorMomentumStyle(holding.sectorMomentum);
  const isPositive = holding.pnlPercent >= 0;
  const criticalActions = holding.actionAlerts.filter((alert) => alert.severity === "critical").length;
  const eventWarnings = holding.eventAlerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical").length;

  function handleSavePrice() {
    const newPrice = Number(priceInput);
    if (Number.isFinite(newPrice) && newPrice > 0) {
      startTransition(() => { updateEntryPrice(holding.ticker, newPrice); });
      setEditingPrice(false);
    }
  }

  function handleSaveShares() {
    const newShares = Number(sharesInput);
    if (Number.isFinite(newShares) && newShares >= 0) {
      startTransition(() => { updateShares(holding.ticker, newShares); });
      setEditingShares(false);
    }
  }

  function handleRemove() {
    if (confirm(`Remove ${holding.ticker} from your portfolio?`)) {
      startTransition(() => { removeHolding(holding.ticker); });
    }
  }

  function handleReviewed() {
    startTransition(() => { markReviewed(holding.ticker); });
  }

  const targetAlloc = holding.targetAllocationPct;
  const allocDrift = targetAlloc !== null ? holding.currentAllocationPct - targetAlloc : 0;
  const driftSignificant = Math.abs(allocDrift) > 3;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.08)]">
      <div className={`pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl ${recStyle.glow}`} />

      <div className="relative border-b border-[#072116]/8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/stock/${holding.ticker}`} className="group flex min-w-0 items-center gap-3">
                <StockLogo ticker={holding.ticker} company={holding.company} size={34} />
                <div className="min-w-0">
                  <p className="text-[28px] font-black tracking-[-0.04em] transition group-hover:text-[#0b2b1d]">{holding.ticker}</p>
                  <p className="truncate text-[13px] font-bold leading-tight text-[#072116]/70">{holding.company ?? holding.ticker}</p>
                </div>
              </Link>

              <span className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider" style={{ backgroundColor: recStyle.bg, color: recStyle.text }}>
                {holding.recommendation}
              </span>

              {holding.isRecentlyAdded && (
                <span className="rounded-full border-2 border-[#ddb159] bg-[#fdf8ed] px-2 py-0.5 text-[10px] font-bold text-[#072116]">
                  ✦ Recently Added · {holding.daysHeld === 0 ? "today" : `${holding.daysHeld}d ago`}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#ddb159] bg-[#faf6f0] px-2 py-0.5 text-[10px] font-black text-[#072116]">{holding.currentAllocationPct.toFixed(1)}% of portfolio</span>
              {targetAlloc !== null && driftSignificant && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${allocDrift > 0 ? "border-amber-300 bg-amber-50 text-amber-700" : "border-blue-300 bg-blue-50 text-blue-700"}`}>
                  {allocDrift > 0 ? "↑" : "↓"} target {targetAlloc.toFixed(1)}%
                </span>
              )}
              <span className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold text-[#072116]/65">#{holding.rank ?? "—"} of 500</span>
              <span className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold text-[#072116]/65">Rank percentile {holding.rankPercentile}/100</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sectorStyle.bg} ${sectorStyle.text} ${sectorStyle.border}`}>{sectorStyle.icon} {sectorStyle.label} ({holding.sectorBullishPct}% bullish)</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#ddb159]/40 bg-gradient-to-br from-[#fdf8ed] to-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ StockGPT view</p>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#072116]">{holding.aiSummary}</p>
        </div>

        {(holding.actionAlerts.length > 0 || eventWarnings > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {holding.actionAlerts.length > 0 && (
              <span className={`rounded-full px-3 py-1 text-[11px] font-black text-white ${criticalActions > 0 ? "bg-red-600" : "bg-amber-500"}`}>
                {holding.actionAlerts.length} action alert{holding.actionAlerts.length === 1 ? "" : "s"}
              </span>
            )}
            {eventWarnings > 0 && <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">{eventWarnings} event warning{eventWarnings === 1 ? "" : "s"}</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">Shares</p>
          {editingShares ? (
            <div className="mt-1 flex items-center gap-1">
              <input type="number" value={sharesInput} onChange={(event) => setSharesInput(event.target.value)} step="0.01" className="w-20 rounded border border-[#ddb159] bg-white px-1 py-0.5 text-[14px] font-black text-[#072116] outline-none" autoFocus />
              <button onClick={handleSaveShares} disabled={isPending} className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">✓</button>
              <button onClick={() => { setEditingShares(false); setSharesInput(holding.shares.toString()); }} className="rounded bg-[#072116]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#072116]">✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingShares(true)} className="mt-0.5 flex items-baseline gap-1 text-left">
              <p className="text-[20px] font-black tracking-[-0.02em]">{holding.shares}</p>
              <span className="text-[9px] font-bold text-[#072116]/40 underline">edit</span>
            </button>
          )}
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">Update if you buy/sell</p>
        </div>

        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">Entry Price</p>
          {editingPrice ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[14px] font-black">$</span>
              <input type="number" value={priceInput} onChange={(event) => setPriceInput(event.target.value)} step="0.01" className="w-20 rounded border border-[#ddb159] bg-white px-1 py-0.5 text-[14px] font-black text-[#072116] outline-none" autoFocus />
              <button onClick={handleSavePrice} disabled={isPending} className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">✓</button>
              <button onClick={() => { setEditingPrice(false); setPriceInput(holding.entryPrice.toString()); }} className="rounded bg-[#072116]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#072116]">✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingPrice(true)} className="mt-0.5 flex items-baseline gap-1 text-left">
              <p className="text-[20px] font-black tracking-[-0.02em]">${holding.entryPrice.toFixed(2)}</p>
              <span className="text-[9px] font-bold text-[#072116]/40 underline">edit</span>
            </button>
          )}
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">Avg cost basis</p>
        </div>

        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">Current Price</p>
          <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em]">${holding.currentPrice.toFixed(2)}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">Market price</p>
        </div>

        <div className={`rounded-xl border p-3 ${isPositive ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isPositive ? "text-emerald-800" : "text-red-800"}`}>Total P&amp;L</p>
          <p className={`mt-0.5 text-[20px] font-black tabular-nums tracking-[-0.02em] ${isPositive ? "text-emerald-700" : "text-red-700"}`}>{isPositive ? "+" : ""}{holding.pnlPercent.toFixed(1)}%</p>
          <p className={`mt-1 text-[10px] font-bold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>{isPositive ? "+" : "−"}${Math.abs(holding.totalPnLDollars).toLocaleString()} total</p>
        </div>

        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">AI Score</p>
          <p className="mt-0.5 text-[20px] font-black tabular-nums tracking-[-0.02em]">
            {holding.score.toLocaleString()}
            {holding.scoreChange !== 0 && <span className={`ml-1 text-[11px] ${holding.scoreChange > 0 ? "text-emerald-600" : "text-red-600"}`}>{holding.scoreChange > 0 ? "↑" : "↓"}{Math.abs(holding.scoreChange).toLocaleString()}</span>}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">Score percentile {holding.scorePercentile}/100</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[#faf6f0] px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">Cost Basis</p><p className="mt-0.5 text-[14px] font-black tabular-nums">${holding.costBasis.toLocaleString()}</p></div>
        <div className="rounded-lg bg-[#faf6f0] px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">Current Value</p><p className="mt-0.5 text-[14px] font-black tabular-nums">${holding.currentValue.toLocaleString()}</p></div>
        <div className="rounded-lg bg-[#faf6f0] px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">Per-share P&amp;L</p><p className={`mt-0.5 text-[14px] font-black tabular-nums ${isPositive ? "text-emerald-700" : "text-red-700"}`}>{isPositive ? "+" : "−"}${Math.abs(holding.pnlDollars).toFixed(2)}</p></div>
      </div>

      {holding.actionAlerts.length > 0 && (
        <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
          <button onClick={() => setShowActions((state) => !state)} className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]">
            <div className="flex items-center gap-2"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#072116]">✦ Action Alerts ({holding.actionAlerts.length})</p><span className="rounded-full bg-[#072116] px-2 py-0.5 text-[9px] font-black text-[#ddb159]">current only</span></div>
            <span className="text-[10px] font-bold text-[#072116]/55">{showActions ? "Hide ▴" : "Show ▾"}</span>
          </button>
          {showActions && <div className="grid gap-2 px-5 pb-4">{holding.actionAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}</div>}
        </div>
      )}

      {holding.eventAlerts.length > 0 && (
        <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
          <button onClick={() => setShowEvents((state) => !state)} className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]">
            <div className="flex items-center gap-2"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#072116]">✦ Event Alerts ({holding.eventAlerts.length})</p>{eventWarnings > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white">{eventWarnings} warning{eventWarnings === 1 ? "" : "s"}</span>}</div>
            <span className="text-[10px] font-bold text-[#072116]/55">{showEvents ? "Hide ▴" : "Show ▾"}</span>
          </button>
          {showEvents && <div className="grid gap-2 px-5 pb-4">{holding.eventAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}</div>}
        </div>
      )}

      <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
        <button onClick={() => setShowLevels((state) => !state)} className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#072116]">✦ Decision Levels ({holding.triggers.length})</p>
          <span className="text-[10px] font-bold text-[#072116]/55">{showLevels ? "Hide ▴" : "Show ▾"}</span>
        </button>
        {showLevels && (
          <div className="grid gap-2 px-5 pb-4">
            {holding.triggers.map((trigger) => {
              const style = triggerToneStyle(trigger.tone);
              return (
                <div key={`${trigger.type}-${trigger.condition}`} className={`flex items-start gap-3 rounded-xl border-2 ${style.border} ${style.bg} p-3`}>
                  <div className={`shrink-0 ${style.icon}`}><TriggerIcon icon={trigger.icon} /></div>
                  <div className="min-w-0 flex-1"><p className={`text-[13px] font-black tracking-[-0.01em] ${style.text}`}>{trigger.condition}</p><p className="mt-1 text-[12px] font-medium leading-relaxed text-[#072116]/70">→ {trigger.action}</p></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#072116]/8 bg-white px-5 py-3">
        <p className="text-[10px] font-medium text-[#072116]/55">{holding.daysSinceReview === 0 ? "Reviewed today" : `Last reviewed ${holding.daysSinceReview} days ago`}</p>
        <div className="flex items-center gap-2">
          <button onClick={handleReviewed} disabled={isPending} className="rounded-full border border-[#ddb159] bg-[#faf6f0] px-3 py-1.5 text-[11px] font-bold text-[#072116] transition hover:bg-[#ddb159]/20">✓ Mark Reviewed</button>
          <Link href={`/stock/${holding.ticker}`} className="rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:opacity-90" style={{ backgroundColor: "#072116", color: "#ddb159" }}>Full Analysis →</Link>
          <button onClick={handleRemove} disabled={isPending} className="rounded-full border border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50" title="Remove from portfolio">✕</button>
        </div>
      </div>
    </div>
  );
}

function AddStockForm() {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!ticker.trim()) { setError("Enter a ticker"); return; }
    if (!shares || Number(shares) <= 0) { setError("Enter shares, e.g. 10"); return; }
    setError(null);
    startTransition(async () => {
      const result = await addHolding(ticker.trim().toUpperCase(), entryPrice ? Number(entryPrice) : undefined, Number(shares));
      if (!result.success) setError(result.error ?? "Could not add stock");
      else { setTicker(""); setShares(""); setEntryPrice(""); }
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ Add Your Own Stocks</p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Track stocks you already own. Enter shares and your entry price.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[100px_90px_1fr_auto]">
        <input type="text" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder="AAPL" className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[14px] font-black uppercase text-[#072116] outline-none focus:border-[#ddb159]" />
        <input type="number" step="0.01" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="Shares" className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-bold text-[#072116] outline-none focus:border-[#ddb159]" />
        <input type="number" step="0.01" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} placeholder="Entry price optional" className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-semibold text-[#072116] outline-none focus:border-[#ddb159]" />
        <button onClick={handleSubmit} disabled={isPending} className="rounded-lg px-4 py-2 text-[13px] font-black transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#ddb159", color: "#072116" }}>{isPending ? "Adding…" : "+ Add"}</button>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function SavedPortfolio({ holdings, portfolioMeta }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDeletePortfolio() {
    if (confirm("Delete your entire portfolio? This cannot be undone.")) {
      startTransition(() => { deletePortfolio(); });
    }
  }

  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalPnLDollars = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnLDollars / totalCost) * 100 : 0;
  const actionAlerts = holdings.flatMap((holding) => holding.actionAlerts);
  const eventAlerts = holdings.flatMap((holding) => holding.eventAlerts);
  const criticalActions = actionAlerts.filter((alert) => alert.severity === "critical").length;
  const warningActions = actionAlerts.filter((alert) => alert.severity === "warning").length;
  const buyMoreActions = actionAlerts.filter((alert) => alert.action === "buy_more").length;
  const sellActions = actionAlerts.filter((alert) => alert.action === "sell").length;
  const trimActions = actionAlerts.filter((alert) => alert.action === "trim").length;
  const eventWarnings = eventAlerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical").length;
  const avgScore = holdings.length > 0 ? Math.round(holdings.reduce((sum, holding) => sum + holding.score, 0) / holdings.length) : 0;

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">✦ {portfolioMeta.name}</p>
            <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">${totalValue.toLocaleString()} · <span className={totalPnLPct >= 0 ? "text-emerald-400" : "text-red-400"}>{totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(1)}%</span></h1>
            <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/55">
              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"} · Cost basis ${totalCost.toLocaleString()} · {totalPnLDollars >= 0 ? "+" : "−"}${Math.abs(totalPnLDollars).toLocaleString()}
              {(portfolioMeta.riskTolerance || portfolioMeta.timeHorizon) && <span className="capitalize"> · {portfolioMeta.riskTolerance ?? ""}{portfolioMeta.riskTolerance && portfolioMeta.timeHorizon && " · "}{portfolioMeta.timeHorizon === "short" ? "3–5 yrs" : portfolioMeta.timeHorizon === "medium" ? "5–10 yrs" : portfolioMeta.timeHorizon === "long" ? "10+ yrs" : ""}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/portfolio?builder=1" className="rounded-full border border-[#ddb159]/40 px-4 py-2 text-[12px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10">+ New Portfolio</Link>
            <button onClick={handleDeletePortfolio} disabled={isPending} className="rounded-full border border-red-400/40 px-3 py-2 text-[11px] font-bold text-red-400 transition hover:border-red-400 hover:bg-red-500/10">Delete</button>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Holdings</p><p className="mt-0.5 text-[18px] font-black text-[#faf6f0]">{holdings.length}</p></div>
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Avg AI Score</p><p className="mt-0.5 text-[18px] font-black text-[#faf6f0]">{avgScore.toLocaleString()}</p></div>
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Action Alerts</p><p className={`mt-0.5 text-[18px] font-black ${actionAlerts.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>{actionAlerts.length}</p></div>
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Event Warnings</p><p className={`mt-0.5 text-[18px] font-black ${eventWarnings > 0 ? "text-amber-400" : "text-emerald-400"}`}>{eventWarnings}</p></div>
        </div>

        {(actionAlerts.length > 0 || eventWarnings > 0) && (
          <div className="relative mt-3 flex flex-wrap gap-2">
            {criticalActions > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-black text-white">⚠ {criticalActions} critical action</span>}
            {warningActions > 0 && <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">{warningActions} trim/review action</span>}
            {sellActions > 0 && <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-black text-white">{sellActions} sell</span>}
            {trimActions > 0 && <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">{trimActions} trim</span>}
            {buyMoreActions > 0 && <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-white">{buyMoreActions} buy more</span>}
            {eventWarnings > 0 && <span className="rounded-full bg-[#faf6f0] px-3 py-1 text-[11px] font-black text-[#072116]">{eventWarnings} event warning{eventWarnings === 1 ? "" : "s"}</span>}
          </div>
        )}
      </div>

      <AddStockForm />

      {holdings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#ddb159]/25 bg-[#061b12]/50 p-8 text-center">
          <p className="text-[14px] font-bold text-[#faf6f0]">No holdings yet</p>
          <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/50">Add stocks above, or generate a new AI portfolio.</p>
        </div>
      ) : (
        <div className="grid gap-3">{holdings.map((holding) => <HoldingRow key={holding.ticker} holding={holding} />)}</div>
      )}

      <p className="px-2 text-[11px] font-medium leading-relaxed text-[#faf6f0]/40">⚠️ StockGPT alerts are generated from current rankings, factor diagnostics, portfolio data, price action and recent news. They are not financial advice.</p>
    </div>
  );
}
