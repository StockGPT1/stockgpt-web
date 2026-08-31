"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ManageHoldingDrawer } from "@/components/ManageHoldingDrawer";
import { PortfolioStage } from "@/components/portfolio-workspace/PortfolioStage";
import { PortfolioOverview } from "@/components/portfolio-workspace/PortfolioOverview";
import { PortfolioHoldings } from "@/components/portfolio-workspace/PortfolioHoldings";
import { PortfolioActivity } from "@/components/portfolio-workspace/PortfolioActivity";
import { PortfolioAddSheet } from "@/components/portfolio-workspace/PortfolioAddSheet";
import { PortfolioAnalysisSheet } from "@/components/portfolio-workspace/PortfolioAnalysisSheet";
import { PortfolioManageSheet } from "@/components/portfolio-workspace/PortfolioManageSheet";
import type {
  PortfolioSection,
  PortfolioWorkspaceProps,
} from "@/components/portfolio-workspace/types";
import { holdingIntelligenceForTicker } from "@/lib/portfolio-intelligence-presentation";
import { portfolioTransactionActivityAt } from "@/lib/portfolio-transaction-chronology";

export function PortfolioModernWorkspace({
  portfolioId,
  portfolios,
  portfolioMeta,
  intelligence,
  holdingReferenceLevels,
  summary,
  holdings,
  stockOptions,
  transactions,
  chartData,
  chartMeta,
  usdToWriteRate,
  canUsePremium,
  initialSection,
}: PortfolioWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stageRef = useRef<HTMLElement>(null);
  const sectionAnchorRef = useRef<HTMLDivElement>(null);
  const requestedSection = searchParams.get("section");
  const section: PortfolioSection =
    requestedSection === "holdings" || requestedSection === "activity"
      ? requestedSection
      : initialSection;
  const [stageVisible, setStageVisible] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStageVisible(entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [portfolioId]);

  const holdingMap = useMemo(
    () => new Map(holdings.map((holding) => [holding.ticker.toUpperCase(), holding])),
    [holdings],
  );
  const selectedHolding = selectedTicker
    ? holdingMap.get(selectedTicker.toUpperCase()) ?? null
    : null;
  const selectedAssessment = selectedHolding
    ? holdingIntelligenceForTicker(intelligence, selectedHolding.ticker)
    : null;
  const selectedReferenceLevels = selectedHolding
    ? holdingReferenceLevels[selectedHolding.ticker.toUpperCase()] ?? {
        entryPrice: null,
        savedRiskLevel: null,
        savedTargetLevel: null,
      }
    : null;
  const latestActivityDate = useMemo(() => {
    const values = transactions.map(portfolioTransactionActivityAt);
    return (
      values
        .filter((value) => Number.isFinite(new Date(value).getTime()))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
    );
  }, [transactions]);

  function updateUrl(next: { section?: PortfolioSection; portfolio?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.section) params.set("section", next.section);
    if (next.portfolio) params.set("portfolio", next.portfolio);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function chooseSection(next: PortfolioSection) {
    updateUrl({ section: next });
    window.requestAnimationFrame(() => {
      sectionAnchorRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  return (
    <main className="min-h-full overflow-x-hidden bg-[#061b12] pb-[calc(120px+env(safe-area-inset-bottom))] text-[#faf6f0] lg:pb-12">
      <div className="mx-auto w-full max-w-[1480px] lg:px-6 xl:px-8 2xl:px-10">
        <PortfolioStage
          key={portfolioId}
          portfolioId={portfolioId}
          portfolios={portfolios}
          meta={portfolioMeta}
          intelligence={intelligence}
          summary={summary}
          chartData={chartData}
          chartMeta={chartMeta}
          stageRef={stageRef}
          sectionAnchorRef={sectionAnchorRef}
          stageVisible={stageVisible}
          section={section}
          onSection={chooseSection}
          onPortfolio={(nextPortfolioId) => updateUrl({ portfolio: nextPortfolioId })}
          onAdd={() => setAddOpen(true)}
          onManage={() => setManageOpen(true)}
        />

        <div className="px-4 pt-7 sm:px-6 lg:px-0 lg:pt-9">
          <section
            role="tabpanel"
            aria-label={`${section[0].toUpperCase()}${section.slice(1)} portfolio section`}
          >
            {section === "overview" && (
              <PortfolioOverview
                portfolioId={portfolioId}
                meta={portfolioMeta}
                intelligence={intelligence}
                summary={summary}
                holdings={holdings}
                canUsePremium={canUsePremium}
                latestActivityDate={latestActivityDate}
                onHolding={(holding) => setSelectedTicker(holding.ticker)}
                onAnalysis={() => setAnalysisOpen(true)}
                onViewHoldings={() => chooseSection("holdings")}
                onAdd={() => setAddOpen(true)}
              />
            )}

            {section === "holdings" && (
              <PortfolioHoldings
                holdings={holdings}
                meta={portfolioMeta}
                intelligence={intelligence}
                onHolding={(holding) => setSelectedTicker(holding.ticker)}
              />
            )}

            {section === "activity" && (
              <PortfolioActivity
                transactions={transactions}
                holdings={holdings}
                meta={portfolioMeta}
                onHolding={(holding) => setSelectedTicker(holding.ticker)}
              />
            )}
          </section>
        </div>
      </div>

      <PortfolioAddSheet
        key={`add-${portfolioId}`}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        portfolioId={portfolioId}
        meta={portfolioMeta}
        holdings={holdings}
        stockOptions={stockOptions}
        summary={summary}
        usdToWriteRate={usdToWriteRate}
      />
      <PortfolioManageSheet
        key={`manage-${portfolioId}`}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        portfolioId={portfolioId}
        meta={portfolioMeta}
        holdings={holdings}
        transactions={transactions}
      />
      <PortfolioAnalysisSheet
        key={`analysis-${portfolioId}`}
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        intelligence={intelligence}
        summary={summary}
        portfolioId={portfolioId}
        canUsePremium={canUsePremium}
      />

      {selectedHolding && selectedAssessment && selectedReferenceLevels && (
        <ManageHoldingDrawer
          key={`${portfolioId}-${selectedHolding.ticker}`}
          portfolioId={portfolioId}
          holding={selectedHolding}
          assessment={selectedAssessment}
          referenceLevels={selectedReferenceLevels}
          cashBalance={portfolioMeta.cashBalance}
          displayCurrency={portfolioMeta.currency}
          usdToWriteRate={usdToWriteRate}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </main>
  );
}
