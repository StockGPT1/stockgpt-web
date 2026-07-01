"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePortfolioAction } from "@/lib/actions/portfolio";
import { savePortfolio } from "@/lib/actions/portfolio-management";
import type { Portfolio, RiskTolerance, TimeHorizon } from "@/lib/portfolio";
import {
  ManualPortfolioBuilder,
  type ManualBuilderStockOption,
} from "@/components/ManualPortfolioBuilder";

type ExistingPortfolio = {
  id: string;
  name: string;
};

type Props = {
  existingPortfolios?: ExistingPortfolio[];
  stockOptions?: ManualBuilderStockOption[];
  initialMode?: "choice" | "ai" | "manual";
};

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
    case "Defensive":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
      };
    case "Growth":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
      };
    case "Income":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
      };
    default:
      return {
        bg: "bg-slate-50",
        text: "text-slate-700",
        border: "border-slate-200",
      };
  }
}

function horizonLabel(horizon: TimeHorizon) {
  if (horizon === "short") return "3–5 yrs";
  if (horizon === "medium") return "5–10 yrs";
  return "10+ yrs";
}

function defaultPortfolioName(existingCount: number, risk: RiskTolerance) {
  const label =
    risk === "conservative"
      ? "Defensive"
      : risk === "aggressive"
        ? "Growth"
        : "Balanced";

  return `${label} AI Portfolio ${existingCount + 1}`;
}

function amountLabel(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toLocaleString()}`;
}

export function PortfolioBuilder({
  existingPortfolios = [],
  stockOptions = [],
  initialMode = "choice",
}: Props) {
  const router = useRouter();
  const [creationMode, setCreationMode] = useState<"choice" | "ai" | "manual">(
    initialMode,
  );

  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [horizon, setHorizon] = useState<TimeHorizon>("medium");
  const [amount, setAmount] = useState<number>(10000);
  const [portfolioName, setPortfolioName] = useState(
    defaultPortfolioName(existingPortfolios.length, "moderate"),
  );
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [savedPortfolioId, setSavedPortfolioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const suggestedName = useMemo(
    () => defaultPortfolioName(existingPortfolios.length, risk),
    [existingPortfolios.length, risk],
  );

  function handleRiskChange(nextRisk: RiskTolerance) {
    setRisk(nextRisk);

    if (!portfolioName.trim() || portfolioName === suggestedName) {
      setPortfolioName(defaultPortfolioName(existingPortfolios.length, nextRisk));
    }
  }

  function handleGenerate() {
    setError(null);
    setSavedPortfolioId(null);

    startGenerating(async () => {
      const result = await generatePortfolioAction(risk, horizon, amount);

      if (result.error || !result.portfolio) {
        setPortfolio(null);
        setError(result.error ?? "Could not generate portfolio.");
        return;
      }

      setPortfolio(result.portfolio);
    });
  }

  function handleSave() {
    if (!portfolio || isSaving) return;

    const cleanName = portfolioName.trim() || suggestedName;

    startSaving(async () => {
      const result = await savePortfolio(portfolio, {
        name: cleanName,
        mode: "create_new",
      });

      if (!result.success) {
        setError(result.error ?? "Could not save portfolio.");
        return;
      }

      const id = result.data?.portfolioId ?? null;
      setSavedPortfolioId(id);

      window.setTimeout(() => {
        router.push(id ? `/portfolio?portfolio=${id}` : "/portfolio");
      }, 650);
    });
  }

  if (creationMode === "manual") {
    return (
      <ManualPortfolioBuilder
        stockOptions={stockOptions}
        existingCount={existingPortfolios.length}
        onBack={() => setCreationMode("choice")}
      />
    );
  }

  if (creationMode === "choice") {
    return (
      <div className="grid min-w-0 gap-4 overflow-x-hidden">
        <header className="relative overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] px-5 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:px-7">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Portfolio workspace
            </p>
            <h1 className="mt-1 text-[32px] font-black leading-tight tracking-[-0.05em] text-[#faf6f0] sm:text-[42px]">
              Create a portfolio
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-6 text-[#faf6f0]/60">
              Start with an AI Portfolio Draft or build your own holdings and cash
              position manually.
            </p>
          </div>
        </header>

        <section className="grid gap-3 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => setCreationMode("ai")}
            className="group min-h-[230px] rounded-3xl border border-[#ddb159]/35 bg-[#faf6f0] p-5 text-left text-[#072116] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#072116] sm:p-6"
          >
            <span className="grid size-11 place-items-center rounded-full bg-[#072116] text-xl text-[#ddb159]">
              AI
            </span>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-[#8a641a]">
              Fastest route
            </p>
            <h2 className="mt-1 text-[25px] font-black tracking-[-0.04em]">
              Generate with AI
            </h2>
            <p className="mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#072116]/58">
              Build a Portfolio Draft from your preferences, then review allocations,
              risks and trade-offs.
            </p>
            <span className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116]">
              Generate Portfolio Draft →
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCreationMode("manual")}
            className="group min-h-[230px] rounded-3xl border border-[#ddb159]/20 bg-[#061b12] p-5 text-left text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-[#ddb159]/70 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#072116] sm:p-6"
          >
            <span className="grid size-11 place-items-center rounded-full border border-[#ddb159]/35 bg-[#ddb159]/10 text-xl text-[#ddb159]">
              +
            </span>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-[#ddb159]">
              Full control
            </p>
            <h2 className="mt-1 text-[25px] font-black tracking-[-0.04em]">
              Build manually
            </h2>
            <p className="mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#faf6f0]/58">
              Add your own holdings and cash, then let StockGPT analyse the
              structure.
            </p>
            <span className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#ddb159]/40 px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
              Open manual builder →
            </span>
          </button>
        </section>

        {existingPortfolios.length > 0 && (
          <Link
            href="/portfolio"
            className="mx-auto inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb159]/28 px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10"
          >
            Back to portfolios
          </Link>
        )}
      </div>
    );
  }

  if (portfolio) {
    return (
      <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
        <div className="relative min-w-0 overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159] sm:text-[10px]">
                  New AI-generated portfolio
                </p>

                <h1 className="mt-1 text-[25px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0] sm:text-[32px]">
                  ${portfolio.totalInvested.toLocaleString()} ·{" "}
                  <span className="capitalize">{portfolio.riskTolerance}</span> ·{" "}
                  {horizonLabel(portfolio.timeHorizon)}
                </h1>

                <p className="mt-2 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/56 sm:text-[13px]">
                  This will be saved as a new portfolio. It will not delete,
                  overwrite or replace any existing portfolio.
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !!savedPortfolioId}
                  style={{
                    backgroundColor: savedPortfolioId ? "#10b981" : "#ddb159",
                    color: "#072116",
                  }}
                  className="min-w-0 rounded-full px-4 py-2 text-[11px] font-black transition hover:opacity-90 disabled:opacity-90 sm:px-5 sm:text-[12px]"
                >
                  {savedPortfolioId ? "Saved" : isSaving ? "Saving…" : "Save new"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortfolio(null);
                    setSavedPortfolioId(null);
                    setError(null);
                  }}
                  className="min-w-0 rounded-full border border-[#ddb159]/40 px-4 py-2 text-[11px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10 sm:text-[12px]"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-4 grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/80">
                  Portfolio name
                </span>
                <input
                  value={portfolioName}
                  maxLength={80}
                  onChange={(event) => setPortfolioName(event.target.value)}
                  className="h-11 w-full min-w-0 rounded-2xl border border-[#ddb159]/22 bg-[#04180f]/70 px-4 text-[14px] font-black text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/30 focus:border-[#ddb159]/70"
                  placeholder={suggestedName}
                />
              </label>

              <Link
                href="/portfolio"
                className="inline-flex h-11 min-w-0 items-center justify-center rounded-2xl border border-[#ddb159]/26 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
              >
                Back to portfolios
              </Link>
            </div>

            {error && (
              <p className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-200">
                {error}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-[#ddb159]/80 sm:text-[9px]">
                  Holdings
                </p>
                <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-[#faf6f0] sm:text-[20px]">
                  {portfolio.holdings.length}
                </p>
                <p className="text-[9px] font-semibold text-[#faf6f0]/45 sm:text-[10px]">
                  {portfolio.sectorBreakdown.length} sectors
                </p>
              </div>

              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-[#ddb159]/80 sm:text-[9px]">
                  Avg AI Score
                </p>
                <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-[#faf6f0] sm:text-[20px]">
                  {portfolio.avgScore.toLocaleString()}
                </p>
                <p className="text-[9px] font-semibold text-[#faf6f0]/45 sm:text-[10px]">
                  model strength
                </p>
              </div>

              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-[#ddb159]/80 sm:text-[9px]">
                  Expected Return
                </p>
                <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-emerald-400 sm:text-[20px]">
                  {portfolio.expectedAnnualReturn}%/yr
                </p>
                <p className="text-[9px] font-semibold text-[#faf6f0]/45 sm:text-[10px]">
                  AI projection
                </p>
              </div>

              <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2.5">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-[#ddb159]/80 sm:text-[9px]">
                  Diversification
                </p>
                <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-[#faf6f0] sm:text-[20px]">
                  {portfolio.diversificationScore}
                  <span className="text-[11px] font-bold text-[#faf6f0]/45 sm:text-[12px]">
                    /100
                  </span>
                </p>
                <p className="text-[9px] font-semibold text-[#faf6f0]/45 sm:text-[10px]">
                  {portfolio.diversificationScore >= 75
                    ? "Excellent"
                    : portfolio.diversificationScore >= 60
                      ? "Strong"
                      : portfolio.diversificationScore >= 45
                        ? "Moderate"
                        : "Concentrated"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#ddb159]/30 bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55 sm:text-[10px]">
            AI Investment Strategy
          </p>
          <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#072116]/85 sm:text-[13px]">
            {portfolio.strategy}
          </p>

          <div className="mt-3 rounded-lg border border-[#072116]/10 bg-white/60 p-3">
            <p className="text-[8px] font-extrabold uppercase tracking-wider text-[#072116]/45 sm:text-[9px]">
              Risk Assessment
            </p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#072116]/75 sm:text-[12px]">
              {portfolio.riskAssessment}
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55 sm:text-[10px]">
            AI Sector Allocation
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/55 sm:text-[11px]">
            Why each sector is weighted this way
          </p>

          <div className="mt-3 flex h-3 min-w-0 overflow-hidden rounded-full bg-[#072116]/8">
            {portfolio.sectorBreakdown.map((sector) => (
              <div
                key={sector.sector}
                style={{
                  width: `${sector.pct}%`,
                  backgroundColor: colorFor(sector.sector),
                }}
                title={`${sector.sector}: ${sector.pct}%`}
              />
            ))}
          </div>

          <div className="mt-4 grid min-w-0 gap-2">
            {portfolio.sectorBreakdown.map((sector) => {
              const role = roleColor(sector.role);

              return (
                <div
                  key={sector.sector}
                  className="min-w-0 rounded-xl border border-[#072116]/8 bg-white/70 p-3"
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className="inline-block size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: colorFor(sector.sector) }}
                      />
                      <p className="min-w-0 truncate text-[12px] font-black tracking-[-0.02em] sm:text-[13px]">
                        {sector.sector}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${role.bg} ${role.text} ${role.border}`}
                      >
                        {sector.role}
                      </span>
                    </div>

                    <p className="shrink-0 text-[14px] font-black tabular-nums sm:text-[15px]">
                      {sector.pct}%
                    </p>
                  </div>

                  <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-[#072116]/65 sm:text-[11px]">
                    {sector.rationale}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55 sm:text-[10px]">
            AI Stock Research
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#072116]/55 sm:text-[11px]">
            Sorted by allocation · click any stock for full AI analysis
          </p>

          <div className="mt-3 grid min-w-0 gap-2">
            {portfolio.holdings.map((holding) => (
              <Link
                key={holding.ticker}
                href={`/stock/${holding.ticker}`}
                prefetch={false}
                className="group grid min-w-0 gap-3 rounded-xl border border-[#072116]/8 bg-white px-3 py-3 transition hover:border-[#ddb159] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:flex sm:items-center sm:gap-4 sm:px-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-3 sm:block sm:w-16 sm:shrink-0">
                  <div className="min-w-0">
                    <p className="text-[15px] font-black tracking-[-0.02em] text-[#072116] group-hover:text-[#0b2b1d] sm:text-[16px]">
                      {holding.ticker}
                    </p>
                    <p className="text-[9px] font-bold uppercase text-[#072116]/45">
                      #{holding.rank}
                    </p>
                  </div>

                  <span className="inline-flex min-w-[60px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116] sm:hidden">
                    {holding.score.toLocaleString()}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold sm:text-[13px]">
                    {holding.company}
                  </p>

                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block size-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: colorFor(holding.sector) }}
                    />
                    <p className="truncate text-[10px] font-semibold text-[#072116]/55">
                      {holding.sector}
                    </p>
                  </div>

                  <p className="mt-1 text-[10px] font-medium leading-snug text-[#072116]/45 sm:truncate">
                    {holding.reasoning}
                  </p>
                </div>

                <div className="grid min-w-0 grid-cols-3 gap-2 border-t border-[#072116]/8 pt-3 text-left sm:w-24 sm:shrink-0 sm:border-t-0 sm:pt-0 sm:text-right">
                  <div className="min-w-0 sm:col-span-3">
                    <p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/35 sm:hidden">
                      Allocation
                    </p>
                    <p className="text-[15px] font-black tracking-[-0.02em] sm:text-[16px]">
                      {holding.allocationPct}%
                    </p>
                  </div>

                  <div className="min-w-0 sm:col-span-3">
                    <p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/35 sm:hidden">
                      Value
                    </p>
                    <p className="text-[10px] font-bold text-[#072116]/65 sm:text-[11px]">
                      ${holding.allocationDollars.toLocaleString()}
                    </p>
                  </div>

                  <div className="min-w-0 sm:col-span-3">
                    <p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/35 sm:hidden">
                      Shares
                    </p>
                    <p className="text-[9px] font-medium text-[#072116]/40">
                      {holding.shares} shares
                    </p>
                  </div>
                </div>

                <div className="hidden w-16 shrink-0 text-right sm:block">
                  <span className="inline-flex min-w-[60px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116]">
                    {holding.score.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">
          ⚠️ AI-generated portfolios are based on quantitative factors and
          ranking data. They are research tools, not financial advice.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      <button
        type="button"
        onClick={() => setCreationMode("choice")}
        className="w-fit min-h-11 rounded-full border border-[#ddb159]/30 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10"
      >
        ← Creation options
      </button>
      <div className="relative min-w-0 overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] px-5 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/10 blur-3xl" />

        <div className="relative min-w-0">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                AI Portfolio Builder
              </p>
              <h1 className="mt-1 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0] sm:text-[36px]">
                Build a new portfolio in 30 seconds.
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] font-medium leading-6 text-[#faf6f0]/60 sm:text-[14px]">
                Create a separate named portfolio. Existing portfolios are not
                touched unless you delete them yourself.
              </p>
            </div>

            {existingPortfolios.length > 0 && (
              <Link
                href="/portfolio"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/36 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
              >
                Back to portfolio
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-6">
        <div className="grid min-w-0 gap-5">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
              Portfolio name
            </span>
            <input
              value={portfolioName}
              maxLength={80}
              onChange={(event) => setPortfolioName(event.target.value)}
              placeholder={suggestedName}
              className="h-12 w-full min-w-0 rounded-2xl border-2 border-[#072116]/10 bg-white px-4 text-[15px] font-black tracking-[-0.02em] text-[#072116] outline-none transition placeholder:text-[#072116]/30 focus:border-[#ddb159]"
            />
            <p className="mt-1.5 text-[11px] font-semibold leading-5 text-[#072116]/45">
              This name helps users manage multiple portfolios, for example
              “Trading 212 ISA”, “AI Growth” or “Long-term Core”.
            </p>
          </label>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
              Risk Tolerance
            </p>
            <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  key: "conservative" as const,
                  label: "Conservative",
                  desc: "Stable, lower drawdown",
                },
                {
                  key: "moderate" as const,
                  label: "Moderate",
                  desc: "Balanced growth",
                },
                {
                  key: "aggressive" as const,
                  label: "Aggressive",
                  desc: "Higher growth tilt",
                },
              ].map((option) => {
                const isSelected = risk === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleRiskChange(option.key)}
                    className={[
                      "min-w-0 rounded-xl border-2 px-3 py-3 text-left transition",
                      isSelected
                        ? "border-[#ddb159] bg-[#ddb159]/10"
                        : "border-[#072116]/10 hover:border-[#ddb159]/40",
                    ].join(" ")}
                  >
                    <p className="text-[14px] font-black tracking-[-0.02em]">
                      {option.label}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
                      {option.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
              Time Horizon
            </p>
            <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  key: "short" as const,
                  label: "3–5 years",
                  desc: "8 holdings",
                },
                {
                  key: "medium" as const,
                  label: "5–10 years",
                  desc: "11 holdings",
                },
                {
                  key: "long" as const,
                  label: "10+ years",
                  desc: "15 holdings",
                },
              ].map((option) => {
                const isSelected = horizon === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setHorizon(option.key)}
                    className={[
                      "min-w-0 rounded-xl border-2 px-3 py-3 text-left transition",
                      isSelected
                        ? "border-[#ddb159] bg-[#ddb159]/10"
                        : "border-[#072116]/10 hover:border-[#ddb159]/40",
                    ].join(" ")}
                  >
                    <p className="text-[14px] font-black tracking-[-0.02em]">
                      {option.label}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/55">
                      {option.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
              Investment Amount
            </p>

            <div className="mt-2">
              <div className="flex min-w-0 items-center rounded-xl border-2 border-[#072116]/10 bg-white px-4 py-3 focus-within:border-[#ddb159]">
                <span className="shrink-0 text-[20px] font-black text-[#072116]/50">
                  $
                </span>
                <input
                  type="number"
                  min={100}
                  max={10_000_000}
                  step={100}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="ml-2 w-full min-w-0 bg-transparent text-[20px] font-black tracking-[-0.02em] text-[#072116] outline-none"
                />
              </div>

              <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                {[1000, 5000, 10000, 25000, 50000, 100000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(value)}
                    className={[
                      "rounded-full border px-3 py-1 text-[11px] font-bold transition",
                      amount === value
                        ? "border-[#ddb159] bg-[#ddb159] text-[#072116]"
                        : "border-[#072116]/15 text-[#072116]/65 hover:border-[#ddb159]",
                    ].join(" ")}
                  >
                    {amountLabel(value)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {existingPortfolios.length > 0 && (
            <div className="rounded-2xl border border-[#072116]/8 bg-white/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Existing portfolios stay safe
              </p>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[#072116]/62">
                You currently have {existingPortfolios.length} saved{" "}
                {existingPortfolios.length === 1 ? "portfolio" : "portfolios"}.
                Saving this AI portfolio will create a new one instead of
                overwriting them.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ backgroundColor: "#ddb159", color: "#072116" }}
            className="flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-full text-[14px] font-black transition hover:opacity-90 disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <svg
                  className="size-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="60"
                    strokeLinecap="round"
                  />
                </svg>
                AI is building your portfolio…
              </>
            ) : (
              <>
                Generate AI Portfolio<span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
