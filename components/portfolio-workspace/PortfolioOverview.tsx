"use client";

import Link from "next/link";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";
import { HoldingLedgerRow, PortfolioExposureView } from "@/components/portfolio-workspace/PortfolioHoldingsVisuals";
import type { PortfolioMeta } from "@/components/portfolio-workspace/types";
import {
  formatDate,
  money,
  signedMoney,
  signedPct,
  toneClass,
} from "@/components/portfolio-workspace/utils";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";

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
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159] lg:text-[10px]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[21px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0] lg:text-[28px]">
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
    <div className="min-w-0 border-l border-[#ddb159]/16 pl-3 first:border-l-0 first:pl-0 lg:px-4 lg:first:border-l lg:first:pl-4">
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/36 lg:text-[9px]">
        {label}
      </p>
      <p className={`mt-1.5 truncate text-[18px] font-black tabular-nums lg:mt-2 lg:text-[21px] ${tone ?? "text-[#faf6f0]"}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[9px] font-semibold text-[#faf6f0]/34 lg:mt-1 lg:text-[10px]">{detail}</p>
    </div>
  );
}

export function PortfolioOverview({
  portfolioId,
  meta,
  summary,
  holdings,
  opportunities,
  canUsePremium,
  latestActivityDate,
  onHolding,
  onAnalysis,
  onViewHoldings,
  onAdd,
}: {
  portfolioId: string;
  meta: PortfolioMeta;
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  opportunities: DashboardPortfolioOpportunity[];
  canUsePremium: boolean;
  latestActivityDate: string | null;
  onHolding: (holding: ExtendedHolding) => void;
  onAnalysis: () => void;
  onViewHoldings: () => void;
  onAdd: () => void;
}) {
  const sortedHoldings = holdings.slice().sort((a, b) => b.currentValue - a.currentValue);
  const topHoldings = sortedHoldings.slice(0, 5);

  return (
    <div className="space-y-8 lg:space-y-14">
      <section aria-labelledby="portfolio-briefing-title">
        <p id="portfolio-briefing-title" className="sr-only">Portfolio briefing at a glance</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-[20px] border border-[#ddb159]/12 bg-[#0a2a1d]/40 px-4 py-4 lg:grid-cols-4 lg:gap-0 lg:bg-transparent lg:px-0 lg:py-0">
          <Metric
            label="Value"
            value={money(summary.totalValue, meta.currency)}
            detail="Latest valuation"
          />
          <Metric
            label="Return"
            value={signedPct(summary.totalPnlPct)}
            detail={signedMoney(summary.totalPnl, meta.currency)}
            tone={toneClass(summary.totalPnl)}
          />
          <Metric
            label="Reviews"
            value={String(summary.actionAlerts)}
            detail={`${summary.eventAlerts} supporting events`}
            tone={summary.actionAlerts > 0 ? "text-[#e8bd61]" : "text-[#61d7ab]"}
          />
          <Metric
            label="Largest"
            value={`${summary.largestPositionPct.toFixed(1)}%`}
            detail={latestActivityDate ? `Active ${formatDate(latestActivityDate)}` : "No recent activity"}
            tone={summary.largestPositionPct > 30 ? "text-[#e8bd61]" : "text-[#faf6f0]"}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Your portfolio"
          title="Holdings"
          action={
            holdings.length > 0 ? (
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
          <div className="mt-3 overflow-hidden rounded-[20px] border border-[#faf6f0]/8 bg-[#081f15]/52 px-3 lg:mt-4 lg:rounded-none lg:border-x-0 lg:bg-transparent lg:px-0">
            {topHoldings.map((holding) => (
              <HoldingLedgerRow
                key={holding.ticker}
                holding={holding}
                currency={meta.currency}
                riskTolerance={meta.riskTolerance}
                onOpen={onHolding}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-[#ddb159]/14 bg-[#0a2a1d]/45 px-5 py-8 text-center">
            <p className="text-[16px] font-black text-[#faf6f0]">This portfolio is ready to build</p>
            <p className="mx-auto mt-2 max-w-lg text-[12px] font-semibold leading-6 text-[#faf6f0]/44">
              Add cash, log an existing holding or import a Trading 212 CSV.
            </p>
            <button
              type="button"
              onClick={onAdd}
              data-native-haptic="medium"
              className="mt-5 h-12 rounded-2xl bg-[#ddb159] px-6 text-[11px] font-black text-[#061b12]"
            >
              Add to portfolio
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-[#ddb159]/14 bg-[#0a2a1d]/42 p-5 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)] lg:gap-10 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159] lg:text-[10px]">
            Portfolio pulse
          </p>
          <h2 className="mt-2 max-w-3xl text-[23px] font-black leading-[1.15] tracking-[-0.04em] text-[#faf6f0] lg:text-[36px]">
            {summary.label}{summary.actionAlerts > 0 ? " · review needed" : " · no urgent action"}
          </h2>
          <p className="mt-3 line-clamp-3 max-w-3xl text-[12px] font-semibold leading-6 text-[#faf6f0]/54 lg:mt-4 lg:line-clamp-none lg:text-[14px] lg:leading-7">
            {summary.explanation}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 lg:mt-6">
            {[
              `${summary.actionAlerts} review${summary.actionAlerts === 1 ? "" : "s"}`,
              `${summary.oversizedCount} oversized`,
              `${summary.sectorCount} sectors`,
            ].map((signal) => (
              <span
                key={signal}
                className="inline-flex min-h-8 items-center rounded-full border border-[#ddb159]/16 bg-[#ddb159]/6 px-3 text-[9px] font-black text-[#f2d27a] lg:min-h-9 lg:text-[10px]"
              >
                {signal}
              </span>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:items-center lg:mt-7">
            <AskStockGPTButton
              canUseAskStockGPT={canUsePremium}
              isAuthenticated
              label="Ask StockGPT"
              context={{ contextType: "portfolio", portfolioId }}
              className="h-11 rounded-2xl px-3 lg:h-12 lg:px-5"
            />
            <button
              type="button"
              onClick={onAnalysis}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#ddb159]/22 px-3 text-[10px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] lg:h-12 lg:px-5 lg:text-[11px]"
            >
              Full analysis
            </button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-[#faf6f0]/8 pt-4 lg:mt-0 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-6 lg:rounded-[20px] lg:border lg:border-[#ddb159]/14 lg:bg-[#0a2a1d]/45 lg:p-6">
          {[
            ["Holdings", String(summary.holdingsCount), `${summary.sectorCount} sectors`],
            ["Cash", money(meta.cashBalance, meta.currency), `${summary.cashDrag.toFixed(1)}%`],
            ["AI score", summary.weightedAvgScore?.toLocaleString("en-GB") ?? "—", "Weighted"],
            ["Health", `${summary.score}/100`, summary.label],
          ].map(([label, value, detail]) => (
            <div key={label} className="min-w-0">
              <dt className="truncate text-[7.5px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/34 lg:text-[9px]">{label}</dt>
              <dd className="mt-1.5 truncate text-[15px] font-black tabular-nums text-[#faf6f0] lg:mt-2 lg:text-[20px]">{value}</dd>
              <p className="mt-0.5 truncate text-[8px] font-semibold text-[#faf6f0]/34 lg:mt-1 lg:text-[10px]">{detail}</p>
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
        <p className="mt-2 max-w-2xl text-[11px] font-semibold leading-5 text-[#faf6f0]/44 lg:mt-3 lg:text-[12px] lg:leading-6">
          Position size versus model conviction, so concentration issues stand out quickly.
        </p>
        <div className="mt-4 lg:mt-5">
          <PortfolioExposureView
            holdings={holdings}
            riskTolerance={meta.riskTolerance}
            currency={meta.currency}
            onSelect={onHolding}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="StockGPT opportunities"
          title="Portfolio-fit ideas"
          action={
            opportunities.length > 0 ? (
              <Link
                href="/rankings"
                className="hidden min-h-11 items-center text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] sm:inline-flex"
              >
                Review rankings →
              </Link>
            ) : undefined
          }
        />
        {opportunities.length > 0 ? (
          <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-5 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-3">
            {opportunities.slice(0, 6).map((opportunity) => (
              <article
                key={`${opportunity.ticker}-${opportunity.category}`}
                className="flex min-h-[210px] w-[calc(100vw-56px)] max-w-[390px] shrink-0 snap-center flex-col rounded-[20px] border border-[#ddb159]/16 bg-[#0a2a1d]/72 p-4 shadow-[0_16px_34px_rgba(0,0,0,0.18)] lg:min-h-[232px] lg:w-auto lg:max-w-none lg:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[18px] font-black text-[#faf6f0] lg:text-[19px]">
                      {opportunity.ticker}
                      <span className="ml-2 font-semibold text-[#faf6f0]/38">{opportunity.company}</span>
                    </p>
                    <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159] lg:text-[10px]">
                      {opportunity.category}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#ddb159]/18 px-3 py-1 text-[9px] font-black text-[#f2d27a] lg:text-[10px]">
                    AI {Math.round(opportunity.score).toLocaleString("en-GB")}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-[11px] font-semibold leading-5 text-[#faf6f0]/58 lg:mt-4 lg:text-[12px] lg:leading-6">
                  {opportunity.reason}
                </p>
                <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-5 text-[#f1908d]/72 lg:mt-3 lg:text-[11px]">
                  Risk: {opportunity.risk}
                </p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-4 lg:pt-5">
                  <span className="text-[8px] font-semibold text-[#faf6f0]/30 lg:text-[9px]">
                    {opportunity.updatedAt ? formatDate(opportunity.updatedAt, true) : "Freshness unavailable"}
                  </span>
                  <Link
                    href={`/stock/${opportunity.ticker}`}
                    className="inline-flex min-h-10 items-center gap-2 text-[10px] font-black text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] lg:min-h-11 lg:text-[11px]"
                  >
                    Research <PortfolioIcon name="arrow" className="size-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-[#faf6f0]/8 py-7 text-center lg:mt-5 lg:border-x-0 lg:py-9">
            <p className="text-[15px] font-black text-[#faf6f0] lg:text-[16px]">No strong fit ideas right now</p>
            <p className="mx-auto mt-2 max-w-lg px-4 text-[11px] font-semibold leading-5 text-[#faf6f0]/44 lg:text-[12px] lg:leading-6">
              StockGPT only surfaces ideas when the model finds a meaningful portfolio-specific reason and a clear risk to consider.
            </p>
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
            ["Active reviews", String(summary.actionAlerts), `${summary.eventAlerts} supporting events`],
            ["Largest position", `${summary.largestPositionPct.toFixed(1)}%`, `${summary.oversizedCount} oversized`],
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
