"use client";

import { useMemo, useState } from "react";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";

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
  chartData,
}: {
  summary: PortfolioHealthSummary;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
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

  return (
    <div
      className="relative mt-2 grid min-h-0 flex-1 grid-cols-[minmax(0,0.95fr)_minmax(118px,1.05fr)] items-stretch gap-3 lg:mb-3"
      onPointerLeave={() => setHoverPoint(null)}
    >
      <div className="flex min-w-0 flex-col justify-between py-1">
        <div>
          <p className="truncate text-[23px] font-black leading-none tracking-[-0.06em] xl:text-[27px]">
            {money(displayValue, summary.currency)}
          </p>
          <p
            className={[
              "mt-1 truncate text-[12px] font-black tabular-nums",
              isPositive ? "text-emerald-300" : "text-red-200",
            ].join(" ")}
          >
            {money(displayPnl, summary.currency)} · {pct(displayPnlPct)}
          </p>
        </div>
        <span className="mt-2 truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
          {summary.label}
        </span>
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
