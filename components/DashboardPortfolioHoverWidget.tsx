"use client";

import { useMemo, useState } from "react";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { PortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";
import { intelligenceToneClass } from "@/components/portfolio-workspace/utils";

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: safe >= 1000 ? 0 : 2,
  }).format(safe);
}

function pct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

function validPoint(point: ChartPoint | null) {
  if (!point || !Number.isFinite(point.close) || point.close <= 0) return null;
  return point;
}

export function DashboardPortfolioHoverWidget({
  summary,
  intelligence,
  canUsePremium,
  chartData,
  valuationState = "exact",
}: {
  summary: PortfolioHealthSummary;
  intelligence: PortfolioIntelligenceView | null;
  canUsePremium: boolean;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  valuationState?: "exact" | "partial" | "unavailable" | "empty";
}) {
  const [hoverPoint, setHoverPoint] = useState<ChartPoint | null>(null);
  const costBasis = useMemo(
    () => summary.totalValue - summary.totalPnl,
    [summary.totalPnl, summary.totalValue],
  );

  const point = validPoint(hoverPoint);
  const displayValue = point?.close ?? summary.totalValue;
  const displayPnl = point?.pnl ?? displayValue - costBasis;
  const displayPnlPct =
    point?.pnlPct ?? (costBasis > 0 ? (displayPnl / costBasis) * 100 : summary.totalPnlPct);
  const isPositive = displayPnl >= 0;
  const valueUnavailable = valuationState === "unavailable";

  return (
    <div
      className="relative mt-2 grid min-h-0 flex-1 grid-cols-[minmax(0,0.95fr)_minmax(118px,1.05fr)] items-stretch gap-3 lg:mb-3"
      onPointerLeave={() => setHoverPoint(null)}
    >
      <div className="flex min-w-0 flex-col justify-between py-1">
        <div>
          <p className="truncate text-[23px] font-black leading-none tracking-[-0.06em] xl:text-[27px]">
            {valueUnavailable ? "Value unavailable" : money(displayValue, summary.currency)}
          </p>
          {!valueUnavailable && <p
            className={[
              "mt-1 truncate text-[12px] font-black tabular-nums",
              isPositive ? "text-emerald-300" : "text-red-200",
            ].join(" ")}
          >
            {money(displayPnl, summary.currency)} · {pct(displayPnlPct)}
          </p>}
          {valuationState === "partial" && <p className="mt-1 text-[10px] font-bold text-[#e7c56c]">Estimated · latest price coverage is partial</p>}
          {valueUnavailable && <p className="mt-1 text-[10px] font-bold text-[#e7c56c]">Latest prices failed; zero is not being shown.</p>}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-[0.09em]">
          <span
            aria-label={
              canUsePremium && intelligence
                ? `Portfolio status ${intelligence.statusLabel}`
                : "Portfolio status locked"
            }
            className={`truncate rounded-full border border-[#ddb159]/24 px-2 py-1 ${
              canUsePremium && intelligence
                ? intelligenceToneClass(intelligence.tone)
                : "text-[#ddb159]"
            }`}
          >
            Status · {canUsePremium && intelligence ? intelligence.statusLabel : "Locked"}
          </span>
          <span
            aria-label={
              canUsePremium
                ? `Portfolio health ${summary.score} out of 100`
                : "Portfolio health locked"
            }
            className="rounded-full border border-white/10 px-2 py-1 text-[#faf6f0]/55"
          >
            Health · {canUsePremium ? `${summary.score}/100` : "Locked"}
          </span>
        </div>
      </div>

      <div className="min-h-[74px] overflow-hidden rounded-xl border border-[#ddb159]/12 bg-[#04180f]/40">
        <StockChart
          ticker="Dashboard portfolio"
          data={chartData}
          initialRange="MAX"
          height={74}
          compact
          onScrub={(point) => setHoverPoint(validPoint(point))}
        />
      </div>
    </div>
  );
}
