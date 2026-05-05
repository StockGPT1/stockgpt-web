"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePortfolioAction } from "@/lib/actions/portfolio";
import { savePortfolio } from "@/lib/actions/portfolio-management";
import type { Portfolio, RiskTolerance, TimeHorizon } from "@/lib/portfolio";

const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#ddb159",
  Technology: "#ddb159",
  "Health Care": "#10b981",
  Healthcare: "#10b981",
  Financials: "#3b82f6",
  "Consumer Discretionary": "#f97316",
  "Communication Services": "#a855f7",
  Industrials: "#6b7280",
  "Consumer Staples": "#84cc16",
  Energy: "#ef4444",
  "Real Estate": "#06b6d4",
  Utilities: "#eab308",
  Materials: "#ec4899",
};

function colorFor(sector: string) {
  return SECTOR_COLORS[sector] ?? "#94a3b8";
}

function roleColor(role: string) {
  switch (role) {
    case "Defensive": return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    case "Growth": return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    case "Income": return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    default: return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
  }
}

export function PortfolioBuilder() {
  const router = useRouter();
  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [horizon, setHorizon] = useState<TimeHorizon>("medium");
  const [amount, setAmount] = useState<number>(10000);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleGenerate() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await generatePortfolioAction(risk, horizon, amount);
      if (result.error) setError(result.error);
      else setPortfolio(result.portfolio);
    });
  }

  function handleSave() {
    if (!portfolio) return;
    startSaving(async () => {
      const result = await savePortfolio(portfolio);
      if (result.success) {
        setSaved(true);
        setTimeout(() => router.push("/portfolio"), 800);
      } else {
        setError(result.error ?? "Could not save");
      }
    });
  }

  if (portfolio) {
    return (
      <div className="grid gap-3">
        <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                  ✦ Your AI-Generated Portfolio
                </p>
                <h1 className="mt-1 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">
                  ${portfolio.totalInvested.toLocaleString()} ·{" "}
                  <span className="capitalize">{portfolio.riskTolerance}</span> ·{" "}
                  {portfolio.timeHorizon === "short" ? "3–5 yrs" : portfolio.timeHorizon === "medium" ? "5–10 yrs" : "10+ yrs"}
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || saved}
                  style={{ backgroundColor: saved ? "#10b981" : "#ddb159", color: "#072116" }}
                  className="rounded-full px-5 py-2 text-[12px] font-black transition hover:opacity-90 disabled:opacity-90"
                >
                  {saved ? "✓ Saved!" : isSaving ? "Saving…" : "✦ Save to My Portfolio"}
                </button>
                <button
                  type="button"
                  onClick={() => setPortfolio(null)}
                  className="rounded-full border border-[#ddb159]/40 px-4 py-2 text-[12px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Holdings</p>
                <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em] text-[#faf6f0]">{portfolio.holdings.length}</p>
                <p className="text-[10px] font-semibold text-[#faf6f0]/45">{portfolio.sectorBreakdown.length} sectors</p>
              </div>
              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Avg AI Score</p>
                <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em] text-[#faf6f0]">{portfolio.avgScore.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-[#faf6f0]/45">model strength</p>
              </div>
              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Expected Return</p>
                <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em] text-emerald-400">{portfolio.expectedAnnualReturn}%/yr</p>
                <p className="text-[10px] font-semibold text-[#faf6f0]/45">AI projection</p>
              </div>
              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Diversification</p>
                <p className="mt-0.5 text-[20px] font-black tracking-[-0.02em] text-[#faf6f0]">
                  {portfolio.diversificationScore}<span className="text-[12px] font-bold text-[#faf6f0]/45">/100</span>
                </p>
                <p className="text-[10px] font-semibold text-[#faf6f0]/45">
                  {portfolio.diversificationScore >= 75 ? "Excellent" : portfolio.diversificationScore >= 60 ? "Strong" : portfolio.diversificationScore >= 45 ? "Moderate" : "Concentrated"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ddb159]/30 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ AI Investment Strategy</p>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#072116]/85">{portfolio.strategy}</p>
          <div className="mt-3 rounded-lg border border-[#072116]/10 bg-white/60 p-3">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">Risk Assessment</p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#072116]/75">{portfolio.riskAssessment}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ AI Sector Allocation</p>
          <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Why each sector is weighted this way</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#072116]/8">
            {portfolio.sectorBreakdown.map((s) => (
              <div key={s.sector} style={{ width: `${s.pct}%`, backgroundColor: colorFor(s.sector) }} title={`${s.sector}: ${s.pct}%`} />
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {portfolio.sectorBreakdown.map((s) => {
              const role = roleColor(s.role);
              return (
                <div key={s.sector} className="rounded-xl border border-[#072116]/8 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-block size-3 shrink-0 rounded-sm" style={{ backgroundColor: colorFor(s.sector) }} />
                      <p className="truncate text-[13px] font-black tracking-[-0.02em]">{s.sector}</p>
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${role.bg} ${role.text} ${role.border}`}>{s.role}</span>
                    </div>
                    <p className="shrink-0 text-[15px] font-black tabular-nums">{s.pct}%</p>
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-[#072116]/65">{s.rationale}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ AI Stock Picks</p>
          <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Sorted by allocation · click any stock for full AI analysis</p>
          <div className="mt-3 grid gap-2">
            {portfolio.holdings.map((h) => (
              <Link key={h.ticker} href={`/stock/${h.ticker}`} className="group flex items-center gap-4 rounded-xl border border-[#072116]/8 bg-white px-4 py-3 transition hover:border-[#ddb159] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                <div className="w-16 shrink-0">
                  <p className="text-[16px] font-black tracking-[-0.02em] text-[#072116] group-hover:text-[#0b2b1d]">{h.ticker}</p>
                  <p className="text-[9px] font-bold uppercase text-[#072116]/45">#{h.rank}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{h.company}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: colorFor(h.sector) }} />
                    <p className="truncate text-[10px] font-semibold text-[#072116]/55">{h.sector}</p>
                  </div>
                  <p className="mt-1 truncate text-[10px] font-medium text-[#072116]/45">{h.reasoning}</p>
                </div>
                <div className="w-24 shrink-0 text-right">
                  <p className="text-[16px] font-black tracking-[-0.02em]">{h.allocationPct}%</p>
                  <p className="text-[11px] font-bold text-[#072116]/65">${h.allocationDollars.toLocaleString()}</p>
                  <p className="text-[9px] font-medium text-[#072116]/40">{h.shares} shares</p>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <span className="inline-flex min-w-[60px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116]">{h.score.toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <p className="px-2 text-[11px] font-medium leading-relaxed text-[#faf6f0]/40">⚠️ AI-generated portfolio based on quantitative factors. Not financial advice.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] px-6 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/10 blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">✦ AI Portfolio Builder</p>
          <h1 className="mt-1 text-[34px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">Build a portfolio in 30 seconds.</h1>
          <p className="mt-2 max-w-xl text-[14px] font-medium text-[#faf6f0]/60">Tell us your goals — our AI generates a fully diversified S&P 500 portfolio. Save it to track and get alerts.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#faf6f0] p-6 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">Risk Tolerance</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { key: "conservative" as const, label: "Conservative", desc: "Stable, lower returns" },
              { key: "moderate" as const, label: "Moderate", desc: "Balanced approach" },
              { key: "aggressive" as const, label: "Aggressive", desc: "High growth potential" },
            ].map((opt) => {
              const isSelected = risk === opt.key;
              return (
                <button key={opt.key} type="button" onClick={() => setRisk(opt.key)}
                  className={`rounded-xl border-2 px-3 py-3 text-left transition ${isSelected ? "border-[#ddb159] bg-[#ddb159]/10" : "border-[#072116]/10 hover:border-[#ddb159]/40"}`}>
                  <p className="text-[14px] font-black tracking-[-0.02em]">{opt.label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">Time Horizon</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { key: "short" as const, label: "3–5 years", desc: "8 holdings" },
              { key: "medium" as const, label: "5–10 years", desc: "11 holdings" },
              { key: "long" as const, label: "10+ years", desc: "15 holdings" },
            ].map((opt) => {
              const isSelected = horizon === opt.key;
              return (
                <button key={opt.key} type="button" onClick={() => setHorizon(opt.key)}
                  className={`rounded-xl border-2 px-3 py-3 text-left transition ${isSelected ? "border-[#ddb159] bg-[#ddb159]/10" : "border-[#072116]/10 hover:border-[#ddb159]/40"}`}>
                  <p className="text-[14px] font-black tracking-[-0.02em]">{opt.label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">Investment Amount</p>
          <div className="mt-2">
            <div className="flex items-center rounded-xl border-2 border-[#072116]/10 bg-white px-4 py-3 focus-within:border-[#ddb159]">
              <span className="text-[20px] font-black text-[#072116]/50">$</span>
              <input type="number" min={100} max={10000000} step={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="ml-2 w-full bg-transparent text-[20px] font-black tracking-[-0.02em] text-[#072116] outline-none" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1000, 5000, 10000, 25000, 50000, 100000].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(v)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${amount === v ? "border-[#ddb159] bg-[#ddb159] text-[#072116]" : "border-[#072116]/15 text-[#072116]/65 hover:border-[#ddb159]"}`}>
                  ${(v / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{error}</p>}

        <button type="button" onClick={handleGenerate} disabled={isPending} style={{ backgroundColor: "#ddb159", color: "#072116" }}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-black transition hover:opacity-90 disabled:opacity-60">
          {isPending ? (
            <><svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" /></svg>AI is building your portfolio…</>
          ) : (
            <>✦ Generate AI Portfolio<span>→</span></>
          )}
        </button>
      </div>
    </div>
  );
}
