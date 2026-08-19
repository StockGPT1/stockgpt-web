"use client";

import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { PortfolioSheet } from "@/components/portfolio-workspace/PortfolioSheet";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { PortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";
import { intelligenceToneClass } from "@/components/portfolio-workspace/utils";

export function PortfolioAnalysisSheet({
  open,
  onClose,
  intelligence,
  summary,
  portfolioId,
  canUsePremium,
}: {
  open: boolean;
  onClose: () => void;
  intelligence: PortfolioIntelligenceView;
  summary: PortfolioHealthSummary;
  portfolioId: string;
  canUsePremium: boolean;
}) {
  const items = [
    ["Health score", `${summary.score}/100`],
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
    [
      "Holding status",
      intelligence.availability === "ready"
        ? `${intelligence.countsByStatus.urgent_review} urgent · ${intelligence.countsByStatus.review} review · ${intelligence.countsByStatus.monitor} monitor`
        : "Analysis limited",
    ],
    ["Cash allocation", `${summary.cashDrag.toFixed(1)}%`],
  ];

  return (
    <PortfolioSheet
      open={open}
      onClose={onClose}
      title="Portfolio analysis"
      subtitle="How StockGPT is reading this portfolio"
    >
      <div className="rounded-[20px] border border-[#ddb159]/16 bg-[#faf6f0]/[0.035] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">
          Canonical status
        </p>
        <p className={`mt-2 text-[22px] font-black ${intelligenceToneClass(intelligence.tone)}`}>
          {intelligence.statusLabel}
        </p>
        <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/56">
          {intelligence.summary}
        </p>
      </div>

      {intelligence.availability === "ready" && intelligence.reasons.length > 0 && (
        <section className="mt-6" aria-labelledby="portfolio-analysis-reasons">
          <h3 id="portfolio-analysis-reasons" className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Reasons to investigate
          </h3>
          <div className="mt-3 grid gap-3">
            {intelligence.reasons.map((reason) => (
              <article key={reason.code} className="rounded-[18px] border border-[#ddb159]/14 bg-[#faf6f0]/[0.025] p-4">
                <p className="text-[12px] font-black text-[#faf6f0]">{reason.title}</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/48">{reason.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}
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
        Status reflects the currently covered portfolio data. News/event severity is not yet part of the canonical portfolio status model. This analysis is educational only and may be incomplete when market data is stale or unavailable.
      </p>
    </PortfolioSheet>
  );
}
