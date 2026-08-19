"use client";

import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import { HoldingLedgerRow, PortfolioExposureView } from "@/components/portfolio-workspace/PortfolioHoldingsVisuals";
import type { PortfolioMeta } from "@/components/portfolio-workspace/types";
import {
  holdingIntelligenceForTicker,
  type PortfolioIntelligenceView,
} from "@/lib/portfolio-intelligence-presentation";
import {
  formatDate,
  intelligenceToneClass,
  money,
  signedMoney,
  signedPct,
  toneClass,
} from "@/components/portfolio-workspace/utils";

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[23px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0] lg:text-[28px]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="w-[166px] shrink-0 snap-start border-l border-[#ddb159]/18 px-4 py-2 first:border-l-0 first:pl-0 lg:w-auto lg:first:border-l lg:first:pl-4">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/36">
        {label}
      </p>
      <p className={`mt-2 truncate text-[21px] font-black tabular-nums ${tone ?? "text-[#faf6f0]"}`}>
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#faf6f0]/34">{detail}</p>
    </div>
  );
}

export function PortfolioOverview({
  portfolioId,
  meta,
  intelligence,
  summary,
  holdings,
  canUsePremium,
  latestActivityDate,
  onHolding,
  onAnalysis,
  onViewHoldings,
  onAdd,
}: {
  portfolioId: string;
  meta: PortfolioMeta;
  intelligence: PortfolioIntelligenceView;
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  canUsePremium: boolean;
  latestActivityDate: string | null;
  onHolding: (holding: ExtendedHolding) => void;
  onAnalysis: () => void;
  onViewHoldings: () => void;
  onAdd: () => void;
}) {
  const sortedHoldings = holdings.slice().sort((a, b) => b.currentValue - a.currentValue);
  const topHoldings = sortedHoldings.slice(0, 5);
  const canonicalReviewCount =
    intelligence.countsByStatus.review +
    intelligence.countsByStatus.urgent_review;
  const canonicalMonitorCount = intelligence.countsByStatus.monitor;

  return (
    <div className="space-y-12 lg:space-y-14">
      <section aria-labelledby="portfolio-briefing-title">
        <SectionHeading eyebrow="Portfolio briefing" title="At a glance" />
        <p id="portfolio-briefing-title" className="sr-only">Portfolio briefing at a glance</p>
        <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
          <Metric
            label="Current value"
            value={money(summary.totalValue, meta.currency)}
            detail="Latest confirmed valuation"
          />
          <Metric
            label="Total return"
            value={`${signedMoney(summary.totalPnl, meta.currency)} · ${signedPct(summary.totalPnlPct)}`}
            detail="Realised and unrealised"
            tone={toneClass(summary.totalPnl)}
          />
          <Metric
            label="Reviews"
            value={
              intelligence.availability === "ready"
                ? String(canonicalReviewCount)
                : "—"
            }
            detail={
              intelligence.availability === "ready"
                ? `${canonicalMonitorCount} to monitor`
                : "Analysis limited"
            }
            tone={intelligenceToneClass(intelligence.tone)}
          />
          <Metric
            label="Largest position"
            value={`${summary.largestPositionPct.toFixed(1)}%`}
            detail={latestActivityDate ? `Activity ${formatDate(latestActivityDate)}` : "No recent activity"}
            tone={summary.largestPositionPct > 30 ? "text-[#e8bd61]" : "text-[#faf6f0]"}
          />
        </div>
      </section>

      <section className="border-y border-[#faf6f0]/8 py-8 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)] lg:gap-10 lg:border-y-0 lg:py-0">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
            Portfolio Pulse
          </p>
          <h2 className="mt-2 max-w-3xl text-[28px] font-black leading-[1.16] tracking-[-0.045em] text-[#faf6f0] lg:text-[36px]">
            {intelligence.statusLabel}
          </h2>
          <p className="mt-4 max-w-3xl text-[14px] font-semibold leading-7 text-[#faf6f0]/54">
            {intelligence.summary}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(intelligence.availability === "ready"
              ? [
                  `${canonicalReviewCount} review${canonicalReviewCount === 1 ? "" : "s"}`,
                  `${canonicalMonitorCount} to monitor`,
                  `${summary.sectorCount} sectors`,
                ]
              : ["Analysis limited", `${summary.sectorCount} sectors`]
            ).map((signal) => (
              <span
                key={signal}
                className="inline-flex min-h-9 items-center rounded-full border border-[#ddb159]/16 bg-[#ddb159]/6 px-3 text-[10px] font-black text-[#f2d27a]"
              >
                {signal}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <AskStockGPTButton
              canUseAskStockGPT={canUsePremium}
              isAuthenticated
              label="Ask about this portfolio"
              context={{ contextType: "portfolio", portfolioId }}
              className="h-12 rounded-2xl px-5"
            />
            <button
              type="button"
              onClick={onAnalysis}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#ddb159]/22 px-5 text-[11px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
            >
              View full analysis
            </button>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[#faf6f0]/8 pt-6 lg:mt-0 lg:rounded-[20px] lg:border lg:border-[#ddb159]/14 lg:bg-[#0a2a1d]/45 lg:p-6">
          {[
            ["Holdings", String(summary.holdingsCount), `${summary.sectorCount} sectors`],
            ["Cash", money(meta.cashBalance, meta.currency), `${summary.cashDrag.toFixed(1)}% allocation`],
            ["AI score", summary.weightedAvgScore?.toLocaleString("en-GB") ?? "—", "Value weighted"],
            ["Health", `${summary.score}/100`, "Separate descriptive score"],
          ].map(([label, value, detail]) => (
            <div key={label}>
              <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/34">{label}</dt>
              <dd className="mt-2 text-[20px] font-black tabular-nums text-[#faf6f0]">{value}</dd>
              <p className="mt-1 text-[10px] font-semibold text-[#faf6f0]/34">{detail}</p>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <SectionHeading
          eyebrow="Portfolio construction"
          title="Conviction × exposure"
          action={<span className="hidden text-[11px] font-semibold text-[#faf6f0]/36 sm:block">Tap a holding to investigate</span>}
        />
        <p className="mt-3 max-w-2xl text-[12px] font-semibold leading-6 text-[#faf6f0]/44">
          See which positions are large, which still carry strong model conviction and where concentration deserves attention.
        </p>
        <div className="mt-5">
          <PortfolioExposureView
            holdings={holdings}
            intelligence={intelligence}
            currency={meta.currency}
            onSelect={onHolding}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Portfolio"
          title="Top holdings"
          action={
            holdings.length > 5 ? (
              <button
                type="button"
                onClick={onViewHoldings}
                className="inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
              >
                View all →
              </button>
            ) : undefined
          }
        />
        {topHoldings.length > 0 ? (
          <div className="mt-4 border-t border-[#faf6f0]/8">
            {topHoldings.map((holding) => (
              <HoldingLedgerRow
                key={holding.ticker}
                holding={holding}
                currency={meta.currency}
                assessment={holdingIntelligenceForTicker(intelligence, holding.ticker)}
                onOpen={onHolding}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 border-y border-[#faf6f0]/8 py-10 text-center">
            <p className="text-[16px] font-black text-[#faf6f0]">This portfolio is ready to build</p>
            <p className="mx-auto mt-2 max-w-lg text-[12px] font-semibold leading-6 text-[#faf6f0]/44">
              Add cash, log an existing holding or import a Trading 212 CSV.
            </p>
            <button
              type="button"
              onClick={onAdd}
              className="mt-5 h-12 rounded-2xl bg-[#ddb159] px-6 text-[11px] font-black text-[#061b12]"
            >
              Add to portfolio
            </button>
          </div>
        )}
      </section>

      <details className="border-y border-[#faf6f0]/8 py-1">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[12px] font-black text-[#faf6f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">
          Portfolio diagnostics
          <span className="text-[#ddb159]">View details</span>
        </summary>
        <dl className="grid gap-x-8 gap-y-5 border-t border-[#faf6f0]/8 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Holdings", String(summary.holdingsCount), `${summary.sectorCount} sectors`],
            ["Cash", money(meta.cashBalance, meta.currency), `${summary.cashDrag.toFixed(1)}% of portfolio`],
            [
              "Reviews",
              intelligence.availability === "ready" ? String(canonicalReviewCount) : "—",
              intelligence.availability === "ready"
                ? `${canonicalMonitorCount} to monitor`
                : "Analysis limited",
            ],
            ["Largest position", `${summary.largestPositionPct.toFixed(1)}%`, "Current factual allocation"],
          ].map(([label, value, detail]) => (
            <div key={label}>
              <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/34">{label}</dt>
              <dd className="mt-2 text-[20px] font-black text-[#faf6f0]">{value}</dd>
              <p className="mt-1 text-[10px] font-semibold text-[#faf6f0]/34">{detail}</p>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
