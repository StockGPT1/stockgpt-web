"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  removeHolding, updateEntryPrice, markReviewed, deletePortfolio, addHolding,
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

// ── Style helpers ──
function severityStyle(s: HoldingAlert["severity"]) {
  if (s === "critical") return { bg: "bg-red-500", text: "text-white", label: "Critical", border: "border-red-300" };
  if (s === "warning") return { bg: "bg-amber-500", text: "text-white", label: "Warning", border: "border-amber-300" };
  if (s === "success") return { bg: "bg-emerald-500", text: "text-white", label: "Good", border: "border-emerald-300" };
  return { bg: "bg-blue-500", text: "text-white", label: "Info", border: "border-blue-300" };
}

function recommendationStyle(r: EnrichedHolding["recommendation"]) {
  if (r === "Review Urgently") return { bg: "bg-red-500", text: "text-white", glow: "bg-red-500/15" };
  if (r === "Consider Trimming") return { bg: "bg-amber-500", text: "text-white", glow: "bg-amber-500/15" };
  if (r === "Consider Buying More") return { bg: "bg-emerald-500", text: "text-white", glow: "bg-emerald-500/15" };
  if (r === "Strong Hold") return { bg: "bg-emerald-400", text: "text-[#072116]", glow: "bg-emerald-400/15" };
  return { bg: "bg-[#072116]", text: "text-[#ddb159]", glow: "bg-[#072116]/15" };
}

// ✦ NEW: Better sector momentum styling and labels
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
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

// ── HoldingRow: full redesign ──
function HoldingRow({ holding }: { holding: EnrichedHolding }) {
  const [isPending, startTransition] = useTransition();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(holding.entryPrice.toString());
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

  function handleRemove() {
    if (confirm(`Remove ${holding.ticker} from your portfolio?`)) {
      startTransition(() => { removeHolding(holding.ticker); });
    }
  }

  function handleReviewed() {
    startTransition(() => { markReviewed(holding.ticker); });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.08)]">
      {/* Subtle recommendation glow */}
      <div className={`pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl ${recStyle.glow}`} />

      {/* ── HEADER ── */}
      <div className="relative border-b border-[#072116]/8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Link href={`/stock/${holding.ticker}`} className="group">
                <p className="text-[28px] font-black tracking-[-0.04em] text-[#072116] transition group-hover:text-[#0b2b1d]">
                  {holding.ticker}
                </p>
              </Link>
              <span className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${recStyle.bg} ${recStyle.text}`}>
                {holding.recommendation}
              </span>
            </div>
            <Link href={`/stock/${holding.ticker}`} className="hover:underline">
              <p className="mt-1 truncate text-[14px] font-bold text-[#072116]/85">
                {holding.company ?? holding.ticker}
              </p>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold text-[#072116]/65">
                #{holding.rank ?? "—"} of 500
              </span>
              <span className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold text-[#072116]/65">
                {holding.sector ?? "—"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sectorStyle.bg} ${sectorStyle.text} ${sectorStyle.border}`}>
                {sectorStyle.icon} {sectorStyle.label} ({holding.sectorBullishPct}% bullish)
              </span>
              <span className="rounded-full border border-[#072116]/12 bg-[#faf6f0] px-2 py-0.5 text-[10px] font-bold text-[#072116]/65">
                Held {holding.daysHeld} {holding.daysHeld === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        </div>

        {/* ✦ AI Summary — the human-readable take */}
        <div className="mt-4 rounded-xl border border-[#ddb159]/40 bg-gradient-to-br from-[#fdf8ed] to-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            ✦ What the AI thinks
          </p>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#072116]">
            {holding.aiSummary}
          </p>
        </div>
      </div>

      {/* ── KEY NUMBERS ── */}
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {/* Entry Price (editable) */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">
            Entry Price
          </p>
          {editingPrice ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[14px] font-black text-[#072116]">$</span>
              <input
                type="number" value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                step="0.01"
                className="w-20 rounded border border-[#ddb159] bg-white px-1 py-0.5 text-[14px] font-black text-[#072116] outline-none"
                autoFocus
              />
              <button onClick={handleSavePrice} disabled={isPending} className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">✓</button>
              <button onClick={() => { setEditingPrice(false); setPriceInput(holding.entryPrice.toString()); }} className="rounded bg-[#072116]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#072116]">✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingPrice(true)} className="mt-0.5 flex items-baseline gap-1 text-left">
              <p className="text-[20px] font-black tracking-[-0.02em] text-[#072116]">
                ${holding.entryPrice.toFixed(2)}
              </p>
              <span className="text-[9px] font-bold text-[#072116]/40 underline">edit</span>
            </button>
          )}
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">
            Click to update
          </p>
        </div>

        {/* Current Price */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">
            Current Price
          </p>
          <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em] text-[#072116]">
            ${holding.currentPrice.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">
            Live market price
          </p>
        </div>

        {/* P&L */}
        <div className={`rounded-xl border p-3 ${isPositive ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isPositive ? "text-emerald-800" : "text-red-800"}`}>
            Profit / Loss
          </p>
          <p className={`mt-0.5 text-[20px] font-black tabular-nums tracking-[-0.02em] ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
            {isPositive ? "+" : ""}{holding.pnlPercent.toFixed(1)}%
          </p>
          <p className={`mt-1 text-[10px] font-bold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
            {isPositive ? "+" : "−"}${Math.abs(holding.pnlDollars).toFixed(2)} per share
          </p>
        </div>

        {/* AI Score with percentile */}
        <div className="rounded-xl border border-[#072116]/10 bg-[#faf6f0] p-3">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">
            AI Score
          </p>
          <p className="mt-0.5 text-[20px] font-black tabular-nums tracking-[-0.02em] text-[#072116]">
            {holding.score.toLocaleString()}
            {holding.scoreChange !== 0 && (
              <span className={`ml-1 text-[11px] ${holding.scoreChange > 0 ? "text-emerald-600" : "text-red-600"}`}>
                {holding.scoreChange > 0 ? "↑" : "↓"}
                {Math.abs(holding.scoreChange).toLocaleString()}
              </span>
            )}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">
            Top {Math.max(1, 100 - holding.scorePercentile)}% of stocks
          </p>
        </div>
      </div>

      {/* ── ALERTS BANNER (collapsible) ── */}
      {holding.alerts.length > 0 && (
        <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
          <button
            onClick={() => setShowAlerts((s) => !s)}
            className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]"
          >
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#072116]">
                ✦ AI Alerts ({holding.alerts.length})
              </p>
              {/* Badge counts per severity */}
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
            <span className="text-[10px] font-bold text-[#072116]/55">
              {showAlerts ? "Hide ▴" : "Show ▾"}
            </span>
          </button>

          {showAlerts && (
            <div className="grid gap-2 px-5 pb-4">
              {holding.alerts.map((alert, i) => {
                const style = severityStyle(alert.severity);
                return (
                  <div key={i} className={`rounded-xl border-2 ${style.border} bg-white p-3`}>
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black tracking-[-0.01em] text-[#072116]">
                          {alert.title}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-[#072116]/65">
                          {alert.message}
                        </p>
                        <div className="mt-2 rounded-lg bg-[#faf6f0] p-2">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                            ✦ What to do
                          </p>
                          <p className="mt-0.5 text-[12px] font-bold text-[#072116]">
                            {alert.recommendation}
                          </p>
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

      {/* ── IF / THEN TRIGGERS ── */}
      <div className="border-t border-[#072116]/8 bg-[#faf6f0]/50">
        <button
          onClick={() => setShowTriggers((s) => !s)}
          className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-[#faf6f0]"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#072116]">
            ✦ Action Plan — If This, Then That ({holding.triggers.length})
          </p>
          <span className="text-[10px] font-bold text-[#072116]/55">
            {showTriggers ? "Hide ▴" : "Show ▾"}
          </span>
        </button>

        {showTriggers && (
          <div className="grid gap-2 px-5 pb-4">
            {holding.triggers.map((trigger, i) => {
              const style = triggerToneStyle(trigger.tone);
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl border-2 ${style.border} ${style.bg} p-3`}>
                  <div className={`shrink-0 ${style.icon}`}>
                    <TriggerIcon icon={trigger.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-black tracking-[-0.01em] ${style.text}`}>
                      {trigger.condition}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-[#072116]/70">
                      → {trigger.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#072116]/8 bg-white px-5 py-3">
        <p className="text-[10px] font-medium text-[#072116]/55">
          {holding.daysSinceReview === 0 ? "Reviewed today" : `Last reviewed ${holding.daysSinceReview} days ago`}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={handleReviewed} disabled={isPending}
            className="rounded-full border border-[#ddb159] bg-[#faf6f0] px-3 py-1.5 text-[11px] font-bold text-[#072116] transition hover:bg-[#ddb159]/20">
            ✓ Mark Reviewed
          </button>
          <Link href={`/stock/${holding.ticker}`}
            className="rounded-full bg-[#072116] px-3 py-1.5 text-[11px] font-bold text-[#ddb159] transition hover:bg-[#0b2b1d]">
            Full Analysis →
          </Link>
          <button onClick={handleRemove} disabled={isPending}
            className="rounded-full border border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
            title="Remove from portfolio">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add stock form ──
function AddStockForm() {
  const [ticker, setTicker] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!ticker.trim()) { setError("Enter a ticker"); return; }
    setError(null);
    startTransition(async () => {
      const result = await addHolding(
        ticker.trim().toUpperCase(),
        entryPrice ? Number(entryPrice) : undefined
      );
      if (!result.success) {
        setError(result.error ?? "Could not add stock");
      } else {
        setTicker(""); setEntryPrice("");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
        ✦ Add Your Own Stocks
      </p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">
        Already own something? Add it to track AI score changes and get alerts.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_auto]">
        <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[14px] font-black uppercase text-[#072116] outline-none focus:border-[#ddb159]" />
        <input type="number" step="0.01" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="Entry price (optional)"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-semibold text-[#072116] outline-none focus:border-[#ddb159]" />
        <button onClick={handleSubmit} disabled={isPending} style={{ backgroundColor: "#ddb159", color: "#072116" }}
          className="rounded-lg px-4 py-2 text-[13px] font-black transition hover:opacity-90 disabled:opacity-60">
          {isPending ? "Adding…" : "+ Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

// ── Main component ──
export function SavedPortfolio({ holdings, portfolioMeta }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDeletePortfolio() {
    if (confirm("Delete your entire portfolio? This cannot be undone.")) {
      startTransition(() => { deletePortfolio(); });
    }
  }

  const totalPnLPct = holdings.length > 0
    ? holdings.reduce((s, h) => s + h.pnlPercent, 0) / holdings.length : 0;
  const criticalAlerts = holdings.flatMap((h) => h.alerts.filter((a) => a.severity === "critical")).length;
  const warningAlerts = holdings.flatMap((h) => h.alerts.filter((a) => a.severity === "warning")).length;
  const successAlerts = holdings.flatMap((h) => h.alerts.filter((a) => a.severity === "success")).length;
  const totalAlerts = holdings.flatMap((h) => h.alerts).length;
  const avgScore = holdings.length > 0
    ? Math.round(holdings.reduce((s, h) => s + h.score, 0) / holdings.length) : 0;

  return (
    <div className="grid gap-3">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              ✦ {portfolioMeta.name}
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">
              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"} · Avg P&amp;L{" "}
              <span className={totalPnLPct >= 0 ? "text-emerald-400" : "text-red-400"}>
                {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(1)}%
              </span>
            </h1>
            {(portfolioMeta.riskTolerance || portfolioMeta.timeHorizon) && (
              <p className="mt-1 text-[12px] font-medium capitalize text-[#faf6f0]/55">
                {portfolioMeta.riskTolerance ?? ""}
                {portfolioMeta.riskTolerance && portfolioMeta.timeHorizon && " · "}
                {portfolioMeta.timeHorizon === "short" ? "3–5 yrs"
                  : portfolioMeta.timeHorizon === "medium" ? "5–10 yrs"
                  : portfolioMeta.timeHorizon === "long" ? "10+ yrs" : ""}
              </p>
            )}
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

        {/* Portfolio-level stats */}
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
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Total Alerts</p>
            <p className="mt-0.5 text-[18px] font-black text-[#faf6f0]">{totalAlerts}</p>
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
        ⚠️ AI-generated alerts and recommendations based on quantitative factors. Not financial advice. Always do your own research.
      </p>
    </div>
  );
}
