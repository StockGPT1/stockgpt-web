"use client";

import Link from "next/link";
import { StockLogo } from "@/components/StockLogo";
import { useState, useTransition } from "react";
import {
  removeHolding, updateEntryPrice, updateShares, markReviewed, deletePortfolio, addHolding,
} from "@/lib/actions/portfolio-management";
import type { EnrichedHolding, HoldingAlert, HoldingTrigger, SectorMomentum } from "@/lib/portfolio-alerts";

type Props = {
  holdings: EnrichedHolding[];
  portfolioMeta: {
    name: string;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
  };
};

function severityStyle(s: HoldingAlert["severity"]) {
  if (s === "critical") return { bg: "bg-red-500", text: "text-white", label: "Critical", border: "border-red-300" };
  if (s === "warning") return { bg: "bg-amber-500", text: "text-white", label: "Warning", border: "border-amber-300" };
  if (s === "success") return { bg: "bg-emerald-500", text: "text-white", label: "Good", border: "border-emerald-300" };
  return { bg: "bg-blue-500", text: "text-white", label: "Info", border: "border-blue-300" };
}

// ✦ Recommendation styling — uses inline style for reliability
function recommendationStyle(r: EnrichedHolding["recommendation"]) {
  if (r === "Sell Immediately") return { bg: "#dc2626", text: "#ffffff", glow: "bg-red-600/20" };
  if (r === "Sell Whole Position") return { bg: "#dc2626", text: "#ffffff", glow: "bg-red-600/15" };
  if (r === "Review Urgently") return { bg: "#ef4444", text: "#ffffff", glow: "bg-red-500/15" };
  if (r === "Consider Trimming") return { bg: "#f59e0b", text: "#ffffff", glow: "bg-amber-500/15" };
  if (r === "Consider Buying More") return { bg: "#10b981", text: "#ffffff", glow: "bg-emerald-500/15" };
  if (r === "Strong Hold") return { bg: "#34d399", text: "#072116", glow: "bg-emerald-400/15" };
  return { bg: "#072116", text: "#ddb159", glow: "bg-[#072116]/15" };
}

function sectorMomentumStyle(m: SectorMomentum) {
  if (m === "Booming") return { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", icon: "🚀", label: "Sector Booming" };
  if (m === "Strong") return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "↗", label: "Sector Strong" };
  if (m === "Mixed") return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "→", label: "Sector Mixed" };
  if (m === "Weak") return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "↘", label: "Sector Weak" };
  if (m === "Struggling") return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "⚠", label: "Sector Struggling" };
  return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: "?", label: "Unknown" };
}

function triggerToneStyle(tone: HoldingTrigger["tone"]) {
  if (tone === "positive") return { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-700", text: "text-emerald-900" };
  if (tone === "negative") return { bg: "bg-red-50", border: "border-red-200", icon: "text-red-700", text: "text-red-900" };
  return { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-700", text: "text-blue-900" };
}

function TriggerIcon({ icon }: { icon: HoldingTrigger["icon"] }) {
  if (icon === "shield") return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
    </svg>
  );
  if (icon === "target") return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
  if (icon === "warning") return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 18v.5" />
    </svg>
  );
  if (icon === "scales") return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18M3 8h18M5 8l-2 6h6l-2-6M19 8l-2 6h6l-2-6" />
    </svg>
  );
  if (icon === "exit") return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function HoldingRow({ holding }: { holding: EnrichedHolding }) {
  const [isPending, startTransition] = useTransition();
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingShares, setEditingShares] = useState(false);
  const [priceInput, setPriceInput] = useState(holding.entryPrice.toString());
  const [sharesInput, setSharesInput] = useState(holding.shares.toString());
  const [showAlerts, setShowAlerts] = useState(holding.alerts.some((a) => a.severity === "critical"));
  const [showTriggers, setShowTriggers] = useState(false);

  const recStyle = recommendationStyle(holding.recommendation);
  const sectorStyle = sectorMomentumStyle(holding.sectorMomentum);
  const isPositive = holding.pnlPercent >= 0;

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
  const allocDrift = targetAlloc != null ? holding.currentAllocationPct - targetAlloc : 0;
  const driftSignificant = Math.abs(allocDrift) > 3;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.08)]">
      <div className={`pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl ${recStyle.glow}`} />

      {/* HEADER */}
      <div className="relative border-b border-[#072116]/8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/stock/${holding.ticker}`} className="group">
                <p className="text-[28px] font-black tracking-[-0.04em] transition group-hover:text-[#0b2b1d]" style={{ color: "#072116" }}>
                  {holding.ticker}
                </p>
              </Link>
              {/* ✦ Recommendation badge — inline styled */}
              <span
                className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider"
                style={{ backgroundColor: recStyle.bg, color: recStyle.text }}
              >
                {holding.recommendation}
              </span>
              {/* ✦ NEW: Recently Added pill — explains the grace period */}
              {holding.isRecentlyAdded && (
                <span
                  className="rounded-full border-2 px-2 py-0.5 text-[10px] font-bold"
                  style={{ borderColor: "#ddb159", backgroundColor: "#fdf8ed", color: "#072116" }}
                >
                  ✦ Recently Added · {holding.daysHeld === 0 ? "today" : `${holding.daysHeld}d ago`}
                </span>
              )}
            </div>
            <Link href={`/stock/${holding.ticker}`} className="mt-1 flex min-w-0 items-center gap-2 hover:underline">
              <StockLogo ticker={holding.ticker} company={holding.company} size={22} />
              <p className="truncate text-[14px] font-bold" style={{ color: "rgba(7,33,22,0.85)" }}>
                {holding.company ?? holding.ticker}
              </p>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border border-[#ddb159] bg-[#faf6f0] px-2 py-0.5 text-[10px] font-black"
                style={{ color: "#072116" }}
              >
                {holding.currentAllocationPct.toFixed(1)}% of portfolio
              </span>
              {targetAlloc != null && driftSignificant && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${allocDrift > 0 ? "border-amber-300 bg-amber-50 text-amber-700" : "border-blue-300 bg-blue-50 text-blue-700"}`}>
                  {allocDrift > 0 ? "↑" : "↓"} target {targetAlloc.toFixed(1)}%
                </span>
              )}
              <span
                className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold"
                style={{ color: "rgba(7,33,22,0.65)" }}
              >
                #{holding.rank ?? "—"} of 500
              </span>
              <span
                className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold"
                style={{ color: "rgba(7,33,22,0.65)" }}
              >
                {holding.sector ?? "—"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sectorStyle.bg} ${sectorStyle.text} ${sectorStyle.border}`}>
                {sectorStyle.icon} {sectorStyle.label} ({holding.sectorBullishPct}% bullish)
              </span>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-4 rounded-xl border border-[#ddb159]/40 bg-gradient-to-br from-[#fdf8ed] to-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "rgba(7,33,22,0.55)" }}>
            ✦ What the AI thinks
          </p>
          <p className="mt-1 text-[13px] font-medium leading-relaxed" style={{ color: "#072116" }}>
            {holding.aiSummary}
          </p>
        </div>
      </div>

      {/* KEY NUMBERS */}
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">
        {/* Shares */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.55)" }}>Shares</p>
          {editingShares ? (
            <div className="mt-1 flex items-center gap-1">
              <input type="number" value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} step="0.01"
                className="w-20 rounded border border-[#ddb159] bg-white px-1 py-0.5 text-[14px] font-black outline-none"
                style={{ color: "#072116" }} autoFocus />
              <button onClick={handleSaveShares} disabled={isPending} className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">✓</button>
              <button onClick={() => { setEditingShares(false); setSharesInput(holding.shares.toString()); }} className="rounded bg-[#072116]/15 px-1.5 py-0.5 text-[11px] font-bold" style={{ color: "#072116" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingShares(true)} className="mt-0.5 flex items-baseline gap-1 text-left">
              <p className="text-[20px] font-black tracking-[-0.02em]" style={{ color: "#072116" }}>{holding.shares}</p>
              <span className="text-[9px] font-bold underline" style={{ color: "rgba(7,33,22,0.4)" }}>edit</span>
            </button>
          )}
          <p className="mt-1 text-[10px] font-semibold" style={{ color: "rgba(7,33,22,0.5)" }}>Update if you buy/sell</p>
        </div>

        {/* Entry Price */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.55)" }}>Entry Price</p>
          {editingPrice ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[14px] font-black" style={{ color: "#072116" }}>$</span>
              <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} step="0.01"
                className="w-20 rounded border border-[#ddb159] bg-white px-1 py-0.5 text-[14px] font-black outline-none"
                style={{ color: "#072116" }} autoFocus />
              <button onClick={handleSavePrice} disabled={isPending} className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">✓</button>
              <button onClick={() => { setEditingPrice(false); setPriceInput(holding.entryPrice.toString()); }} className="rounded bg-[#072116]/15 px-1.5 py-0.5 text-[11px] font-bold" style={{ color: "#072116" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingPrice(true)} className="mt-0.5 flex items-baseline gap-1 text-left">
              <p className="text-[20px] font-black tracking-[-0.02em]" style={{ color: "#072116" }}>${holding.entryPrice.toFixed(2)}</p>
              <span className="text-[9px] font-bold underline" style={{ color: "rgba(7,33,22,0.4)" }}>edit</span>
            </button>
          )}
          <p className="mt-1 text-[10px] font-semibold" style={{ color: "rgba(7,33,22,0.5)" }}>Avg cost basis</p>
        </div>

        {/* Current Price */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.55)" }}>Current Price</p>
          <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em]" style={{ color: "#072116" }}>${holding.currentPrice.toFixed(2)}</p>
          <p className="mt-1 text-[10px] font-semibold" style={{ color: "rgba(7,33,22,0.5)" }}>Market price</p>
        </div>

        {/* Total P&L */}
        <div className={`rounded-xl border p-3 ${isPositive ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isPositive ? "text-emerald-800" : "text-red-800"}`}>Total P&amp;L</p>
          <p className={`mt-0.5 text-[20px] font-black tabular-nums tracking-[-0.02em] ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
            {isPositive ? "+" : ""}{holding.pnlPercent.toFixed(1)}%
          </p>
          <p className={`mt-1 text-[10px] font-bold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
            {isPositive ? "+" : "−"}${Math.abs(holding.totalPnLDollars).toLocaleString()} total
          </p>
        </div>

        {/* AI Score */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.55)" }}>AI Score</p>
          <p className="mt-0.5 text-[20px] font-black tabular-nums tracking-[-0.02em]" style={{ color: "#072116" }}>
            {holding.score.toLocaleString()}
            {holding.scoreChange !== 0 && (
              <span className={`ml-1 text-[11px] ${holding.scoreChange > 0 ? "text-emerald-600" : "text-red-600"}`}>
                {holding.scoreChange > 0 ? "↑" : "↓"}{Math.abs(holding.scoreChange).toLocaleString()}
              </span>
            )}
          </p>
          <p className="mt-1 text-[10px] font-semibold" style={{ color: "rgba(7,33,22,0.5)" }}>Top {Math.max(1, 100 - holding.rankPercentile)}% of stocks</p>
        </div>
      </div>

      {/* Position summary bar */}
      <div className="grid grid-cols-2 gap-3 px-5 pb-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.45)" }}>Cost Basis</p>
          <p className="mt-0.5 text-[14px] font-black tabular-nums" style={{ color: "#072116" }}>${holding.costBasis.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.45)" }}>Current Value</p>
          <p className="mt-0.5 text-[14px] font-black tabular-nums" style={{ color: "#072116" }}>${holding.currentValue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.45)" }}>Per-share P&amp;L</p>
          <p className={`mt-0.5 text-[14px] font-black tabular-nums ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
            {isPositive ? "+" : "−"}${Math.abs(holding.pnlDollars).toFixed(2)}
          </p>
        </div>
      </div>

      {/* ALERTS */}
      {holding.alerts.length > 0 && (
        <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
          <button onClick={() => setShowAlerts((s) => !s)} className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "#072116" }}>
                ✦ AI Alerts ({holding.alerts.length})
              </p>
              {holding.alerts.filter((a) => a.severity === "critical").length > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                  {holding.alerts.filter((a) => a.severity === "critical").length} critical
                </span>
              )}
              {holding.alerts.filter((a) => a.severity === "warning").length > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                  {holding.alerts.filter((a) => a.severity === "warning").length} warning
                </span>
              )}
              {holding.alerts.filter((a) => a.severity === "success").length > 0 && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                  {holding.alerts.filter((a) => a.severity === "success").length} good
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold" style={{ color: "rgba(7,33,22,0.55)" }}>{showAlerts ? "Hide ▴" : "Show ▾"}</span>
          </button>

          {showAlerts && (
            <div className="grid gap-2 px-5 pb-4">
              {holding.alerts.map((alert, i) => {
                const style = severityStyle(alert.severity);
                return (
                  <div key={i} className={`rounded-xl border-2 ${style.border} bg-white p-3`}>
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${style.bg} ${style.text}`}>{style.label}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div>
                        <p className="mt-1 text-[12px] font-medium" style={{ color: "rgba(7,33,22,0.65)" }}>{alert.message}</p>
                        <div className="mt-2 rounded-lg bg-[#faf6f0] p-2">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(7,33,22,0.45)" }}>✦ What to do</p>
                          <p className="mt-0.5 text-[12px] font-bold" style={{ color: "#072116" }}>{alert.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ✦ ACTION PLAN — renamed from "If This, Then That" to just "Action Plan" */}
      <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
        <button onClick={() => setShowTriggers((s) => !s)} className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "#072116" }}>
            ✦ Action Plan ({holding.triggers.length})
          </p>
          <span className="text-[10px] font-bold" style={{ color: "rgba(7,33,22,0.55)" }}>{showTriggers ? "Hide ▴" : "Show ▾"}</span>
        </button>

        {showTriggers && (
          <div className="grid gap-2 px-5 pb-4">
            {holding.triggers.map((trigger, i) => {
              const style = triggerToneStyle(trigger.tone);
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl border-2 ${style.border} ${style.bg} p-3`}>
                  <div className={`shrink-0 ${style.icon}`}><TriggerIcon icon={trigger.icon} /></div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-black tracking-[-0.01em] ${style.text}`}>{trigger.condition}</p>
                    <p className="mt-1 text-[12px] font-medium" style={{ color: "rgba(7,33,22,0.7)" }}>→ {trigger.action}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER — Full Analysis button uses inline style now */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#072116]/8 bg-white px-5 py-3">
        <p className="text-[10px] font-medium" style={{ color: "rgba(7,33,22,0.55)" }}>
          {holding.daysSinceReview === 0 ? "Reviewed today" : `Last reviewed ${holding.daysSinceReview} days ago`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReviewed}
            disabled={isPending}
            className="rounded-full border border-[#ddb159] bg-[#faf6f0] px-3 py-1.5 text-[11px] font-bold transition hover:bg-[#ddb159]/20"
            style={{ color: "#072116" }}
          >
            ✓ Mark Reviewed
          </button>
          <Link
            href={`/stock/${holding.ticker}`}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:opacity-90"
            style={{ backgroundColor: "#072116", color: "#ddb159" }}
          >
            Full Analysis →
          </Link>
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="rounded-full border border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
            title="Remove from portfolio"
          >
            ✕
          </button>
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
    if (!shares || Number(shares) <= 0) { setError("Enter shares (e.g. 10)"); return; }
    setError(null);
    startTransition(async () => {
      const result = await addHolding(
        ticker.trim().toUpperCase(),
        entryPrice ? Number(entryPrice) : undefined,
        Number(shares)
      );
      if (!result.success) {
        setError(result.error ?? "Could not add stock");
      } else {
        setTicker(""); setShares(""); setEntryPrice("");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 shadow-[0_8px_22px_rgba(0,0,0,0.16)]" style={{ color: "#072116" }}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "rgba(7,33,22,0.55)" }}>
        ✦ Add Your Own Stocks
      </p>
      <p className="mt-1 text-[11px] font-semibold" style={{ color: "rgba(7,33,22,0.55)" }}>
        Track stocks you already own. Enter shares + your entry price (optional, defaults to current).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[100px_90px_1fr_auto]">
        <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[14px] font-black uppercase outline-none focus:border-[#ddb159]"
          style={{ color: "#072116" }} />
        <input type="number" step="0.01" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Shares"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-bold outline-none focus:border-[#ddb159]"
          style={{ color: "#072116" }} />
        <input type="number" step="0.01" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="Entry price (optional)"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#ddb159]"
          style={{ color: "#072116" }} />
        <button onClick={handleSubmit} disabled={isPending}
          className="rounded-lg px-4 py-2 text-[13px] font-black transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "#ddb159", color: "#072116" }}>
          {isPending ? "Adding…" : "+ Add"}
        </button>
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

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalPnLDollars = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnLDollars / totalCost) * 100 : 0;
  const criticalAlerts = holdings.flatMap((h) => h.alerts.filter((a) => a.severity === "critical")).length;
  const warningAlerts = holdings.flatMap((h) => h.alerts.filter((a) => a.severity === "warning")).length;
  const successAlerts = holdings.flatMap((h) => h.alerts.filter((a) => a.severity === "success")).length;
  const totalAlerts = holdings.flatMap((h) => h.alerts).length;
  const avgScore = holdings.length > 0 ? Math.round(holdings.reduce((s, h) => s + h.score, 0) / holdings.length) : 0;
  const sellSignals = holdings.filter((h) => h.recommendation === "Sell Immediately" || h.recommendation === "Sell Whole Position").length;

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">✦ {portfolioMeta.name}</p>
            <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">
              ${totalValue.toLocaleString()} ·{" "}
              <span className={totalPnLPct >= 0 ? "text-emerald-400" : "text-red-400"}>
                {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(1)}%
              </span>
            </h1>
            <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/55">
              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"} · Cost basis ${totalCost.toLocaleString()} · {totalPnLDollars >= 0 ? "+" : "−"}${Math.abs(totalPnLDollars).toLocaleString()}
              {(portfolioMeta.riskTolerance || portfolioMeta.timeHorizon) && (
                <span className="capitalize"> · {portfolioMeta.riskTolerance ?? ""}{portfolioMeta.riskTolerance && portfolioMeta.timeHorizon && " · "}{portfolioMeta.timeHorizon === "short" ? "3–5 yrs" : portfolioMeta.timeHorizon === "medium" ? "5–10 yrs" : portfolioMeta.timeHorizon === "long" ? "10+ yrs" : ""}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/portfolio?builder=1"
              className="rounded-full border border-[#ddb159]/40 px-4 py-2 text-[12px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10">
              + New Portfolio
            </Link>
            <button onClick={handleDeletePortfolio} disabled={isPending}
              className="rounded-full border border-red-400/40 px-3 py-2 text-[11px] font-bold text-red-400 transition hover:border-red-400 hover:bg-red-500/10">
              Delete
            </button>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Holdings</p>
            <p className="mt-0.5 text-[18px] font-black text-[#faf6f0]">{holdings.length}</p>
          </div>
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Avg AI Score</p>
            <p className="mt-0.5 text-[18px] font-black text-[#faf6f0]">{avgScore.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Sell Signals</p>
            <p className={`mt-0.5 text-[18px] font-black ${sellSignals > 0 ? "text-red-400" : "text-emerald-400"}`}>{sellSignals}</p>
          </div>
          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Need Action</p>
            <p className={`mt-0.5 text-[18px] font-black ${criticalAlerts + warningAlerts > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {criticalAlerts + warningAlerts}
            </p>
          </div>
        </div>

        {totalAlerts > 0 && (
          <div className="relative mt-3 flex flex-wrap gap-2">
            {criticalAlerts > 0 && <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-black text-white">⚠ {criticalAlerts} critical</span>}
            {warningAlerts > 0 && <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">{warningAlerts} warning{warningAlerts === 1 ? "" : "s"}</span>}
            {successAlerts > 0 && <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-white">{successAlerts} good news</span>}
          </div>
        )}
      </div>

      <AddStockForm />

      {holdings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#ddb159]/25 bg-[#061b12]/50 p-8 text-center">
          <p className="text-[14px] font-bold text-[#faf6f0]">No holdings yet</p>
          <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/50">Add stocks above, or generate a new AI portfolio</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {holdings.map((h) => (
            <HoldingRow key={h.ticker} holding={h} />
          ))}
        </div>
      )}

      <p className="px-2 text-[11px] font-medium leading-relaxed text-[#faf6f0]/40">
        ⚠️ AI-generated alerts and recommendations based on quantitative factors. Not financial advice.
      </p>
    </div>
  );
}
