"use client";

import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { PortfolioSheet } from "@/components/portfolio-workspace/PortfolioSheet";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";

export function PortfolioAnalysisSheet({
  open,
  onClose,
  summary,
  portfolioId,
  canUsePremium,
}: {
  open: boolean;
  onClose: () => void;
  summary: PortfolioHealthSummary;
  portfolioId: string;
  canUsePremium: boolean;
}) {
  const items = [
    ["Health score", `${summary.score}/100 · ${summary.label}`],
    [
      "Weighted AI score",
      summary.weightedAvgScore?.toLocaleString("en-GB") ?? "Unavailable",
    ],
    [
      "Diversification",
      `${summary.holdingsCount} holdings across ${summary.sectorCount} sectors`,
    ],
    [
      "Portfolio concentration",
      `${summary.largestPositionPct.toFixed(1)}% in the largest position`,
    ],
    ["Action reviews", `${summary.actionAlerts} active`],
    ["Supporting events", `${summary.eventAlerts} active`],
    ["Cash allocation", `${summary.cashDrag.toFixed(1)}%`],
  ];

  return (
    <PortfolioSheet
      open={open}
      onClose={onClose}
      title="Portfolio analysis"
      subtitle="How StockGPT is reading this portfolio"
    >
      <p className="text-[16px] font-black leading-7 text-[#faf6f0]">
        {summary.explanation}
      </p>
      <dl className="mt-7 divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-4">
            <dt className="text-[11px] font-semibold text-[#faf6f0]/42">
              {label}
            </dt>
            <dd className="max-w-[58%] text-right text-[12px] font-black text-[#faf6f0]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <AskStockGPTButton
        canUseAskStockGPT={canUsePremium}
        isAuthenticated
        label="Ask about this portfolio"
        context={{ contextType: "portfolio", portfolioId }}
        className="mt-7 h-12 w-full rounded-2xl"
      />
      {!canUsePremium && (
        <p className="mt-3 text-center text-[10px] font-semibold text-[#faf6f0]/34">
          Core access is required to open contextual portfolio chat.
        </p>
      )}
      <p className="mt-5 text-[10px] font-semibold leading-5 text-[#faf6f0]/34">
        This analysis is generated from portfolio holdings, rankings, alerts and current valuation data. It is educational only and may be incomplete when market data is stale or unavailable.
      </p>
    </PortfolioSheet>
  );
}
