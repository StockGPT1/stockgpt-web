"use client";

import { useEffect, useRef, useState } from "react";
import { PortfolioStage } from "@/components/portfolio-workspace/PortfolioStage";
import { PortfolioOverview } from "@/components/portfolio-workspace/PortfolioOverview";
import { PortfolioHoldings } from "@/components/portfolio-workspace/PortfolioHoldings";
import { PortfolioActivity } from "@/components/portfolio-workspace/PortfolioActivity";
import type { PortfolioMeta, PortfolioOption, PortfolioSection } from "@/components/portfolio-workspace/types";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { assessPortfolioChartHealth, emptyPortfolioChartHealth, type PortfolioChartMeta } from "@/lib/portfolio-chart-health";

type PreviewCase = "up" | "down" | "empty" | "large";
const ANCHOR = Date.parse("2026-10-07T15:30:00.000Z");
const CREATED_AT = "2025-07-01T15:30:00.000Z";
const DAY = 86_400_000;
const portfolios: PortfolioOption[] = [
  { id: "up", name: "Demo growth portfolio", createdAt: CREATED_AT },
  { id: "down", name: "Demo cautious portfolio", createdAt: CREATED_AT },
  { id: "empty", name: "Demo new portfolio", createdAt: "2026-10-07T15:30:00.000Z" },
  { id: "large", name: "Synthetic large-balance demo", createdAt: CREATED_AT },
];
const positions = [
  { ticker: "NVDA", company: "NVIDIA", sector: "Technology", value: 5580, basis: 4620, shares: 24, score: 8742 },
  { ticker: "MSFT", company: "Microsoft", sector: "Technology", value: 4480, basis: 3820, shares: 18, score: 8516 },
  { ticker: "LLY", company: "Eli Lilly", sector: "Healthcare", value: 3860, basis: 3370, shares: 8, score: 8304 },
  { ticker: "V", company: "Visa", sector: "Financials", value: 3250, basis: 2810, shares: 12, score: 8188 },
  { ticker: "COST", company: "Costco Wholesale", sector: "Consumer Staples", value: 3010, basis: 2390, shares: 5, score: 8021 },
  { ticker: "CAT", company: "Caterpillar", sector: "Industrials", value: 3180, basis: 2488, shares: 10, score: 7894 },
] as const;

function buildDemoHoldings(previewCase: PreviewCase): EnrichedHolding[] {
  if (previewCase === "empty") return [];
  const scale = previewCase === "large" ? 1000 : 1;
  return positions.map((position, index) => {
    const currentValue = position.value * (previewCase === "down" ? 20345 / 23360 : 1) * scale;
    const costBasis = position.basis * (previewCase === "down" ? 23320 / 19498 : 1) * scale;
    const shares = position.shares * scale;
    const pnl = currentValue - costBasis;
    return {
      ticker: position.ticker, company: position.company, sector: position.sector,
      rank: index + 1, score: position.score, maxScore: 10000,
      currentPrice: currentValue / shares, entryPrice: costBasis / shares,
      shares, costBasis, currentValue, totalPnLDollars: pnl,
      currentAllocationPct: currentValue / ((previewCase === "down" ? 21845 : 24860) * scale) * 100,
      targetAllocationPct: index < 2 ? 20 : 15, scoreAtEntry: position.score - 240,
      rankAtEntry: index + 5, addedAt: CREATED_AT, lastReviewedAt: "2026-10-06T15:30:00.000Z",
      purchaseDate: CREATED_AT, source: "development_preview", notes: "Synthetic fixture, not a live holding.",
      daysHeld: 463, pnlDollars: pnl, pnlPercent: pnl / costBasis * 100,
      scoreChange: 240, rankChange: 4, daysSinceReview: 1,
      alerts: [], eventAlerts: [], actionAlerts: [], recommendation: "Hold",
      sectorMomentum: "Mixed", sectorBullishPct: 60, scorePercentile: 82, rankPercentile: 85,
      triggers: [], aiSummary: "Illustrative portfolio position for design review.", isRecentlyAdded: false,
    };
  });
}

function demoSeries(endValue: number, basis: number, count: number, spanMs: number, change: number): ChartPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const movement = Math.sin(index * 0.82) * 0.08 + Math.cos(index * 0.37) * 0.055;
    const close = endValue - change * (1 - progress) + Math.abs(change) * movement * Math.sin(progress * Math.PI);
    const pnl = close - basis;
    // All data in this development-only route is fabricated. The production
    // component filters synthetic placeholders, so fixture points emulate
    // accepted snapshot inputs rather than setting its synthetic flag.
    return { date: new Date(ANCHOR - spanMs * (1 - progress)).toISOString(), close, basis, pnl, pnlPct: pnl / basis * 100 };
  });
}

function buildDemoFixture(previewCase: PreviewCase) {
  const holdings = buildDemoHoldings(previewCase);
  const scale = previewCase === "large" ? 1000 : 1;
  const cashBalance = previewCase === "empty" ? 0 : 1500 * scale;
  const basis = (previewCase === "down" ? 24820 : previewCase === "empty" ? 0 : 20998) * scale;
  const meta: PortfolioMeta = {
    name: portfolios.find(portfolio => portfolio.id === previewCase)!.name,
    objective: "Long-term growth", riskTolerance: "moderate", timeHorizon: "5 years",
    createdAt: previewCase === "empty" ? new Date(ANCHOR).toISOString() : CREATED_AT,
    cashBalance, cashDepositedTotal: basis, currency: "GBP",
  };
  const summary = buildPortfolioHealthSummary({ id: previewCase, name: meta.name, currency: meta.currency,
    riskTolerance: meta.riskTolerance, holdings, cashBalance, cashDepositedTotal: basis });
  const chartData: Partial<Record<TimeRange, ChartPoint[]>> = {};
  if (previewCase !== "empty") {
    const direction = previewCase === "down" ? -1 : 1;
    for (const [range, count, span, change] of [
      ["1D", 48, 7.5 * 60 * 60 * 1000, 180],
      ["5D", 56, 5 * DAY, 490],
      ["1M", 44, 30 * DAY, 1520],
      ["6M", 78, 182 * DAY, 2860],
      ["1Y", 96, 365 * DAY, 3460],
      ["MAX", 120, ANCHOR - Date.parse(CREATED_AT), 3862],
    ] as const) chartData[range] = demoSeries(summary.totalValue, basis, count, span, change * direction * scale);
  }
  const snapshotRows = (chartData.MAX ?? []).map((point, index, points) => ({
    snapshot_at: point.date, value: point.close, basis: point.basis, cash: cashBalance,
    source: index === points.length - 1 ? "page_current_value" : "backfill",
  }));
  const chartMeta: PortfolioChartMeta = previewCase === "empty"
    ? { source: "empty", health: emptyPortfolioChartHealth() }
    : { source: "snapshots", health: assessPortfolioChartHealth({ portfolioCreatedAt: CREATED_AT,
      chartData, summary, snapshotRows, nowMs: ANCHOR + 60_000 }) };
  return { meta, summary, holdings, chartData, chartMeta };
}

const fixtures = { up: buildDemoFixture("up"), down: buildDemoFixture("down"), empty: buildDemoFixture("empty"), large: buildDemoFixture("large") };
const isPreviewCase = (value: string): value is PreviewCase => value === "up" || value === "down" || value === "empty" || value === "large";

export default function PortfolioDesignPreview() {
  const [previewCase, setPreviewCase] = useState<PreviewCase>("up");
  const [section, setSection] = useState<PortfolioSection>("overview");
  const [nativeShell, setNativeShell] = useState(true);
  const [notice, setNotice] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const sectionAnchorRef = useRef<HTMLDivElement>(null);
  const fixture = fixtures[previewCase];

  function chooseSection(next: PortfolioSection) {
    setSection(next);
    window.requestAnimationFrame(() => {
      sectionAnchorRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  useEffect(() => {
    const previousShell = document.documentElement.getAttribute("data-app-shell");
    const previousPath = document.body.getAttribute("data-sg-path");
    document.documentElement.setAttribute("data-app-shell", String(nativeShell));
    document.body.setAttribute("data-sg-path", "portfolio");
    return () => {
      if (previousShell === null) document.documentElement.removeAttribute("data-app-shell");
      else document.documentElement.setAttribute("data-app-shell", previousShell);
      if (previousPath === null) document.body.removeAttribute("data-sg-path");
      else document.body.setAttribute("data-sg-path", previousPath);
    };
  }, [nativeShell]);

  return <div className="sg-app-shell flex h-[100dvh] flex-col overflow-hidden text-[#fffaf2]">
    <header className="sg-app-header relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-[#f2c35f]/24 bg-[#08281b] px-4 py-3 sm:px-6">
      <div><p className="text-sm font-black">StockGPT · Portfolio design preview</p><p className="mt-1 text-[11px] text-[#c7dece]">Synthetic fixtures · no account data or live prices</p></div>
      <button type="button" aria-expanded={optionsOpen} aria-controls="portfolio-preview-options" onClick={() => setOptionsOpen(open => !open)} className="min-h-11 shrink-0 rounded-full border border-[#f2c35f]/35 px-4 text-xs font-semibold text-[#f2c35f]">Examples</button>
      {optionsOpen && <nav id="portfolio-preview-options" aria-label="Preview controls" className="absolute right-3 top-[calc(100%+8px)] flex w-[min(380px,calc(100vw-24px))] flex-wrap gap-2 rounded-2xl border border-[#f2c35f]/30 bg-[#08281b] p-4 shadow-xl">
        {(["up", "down", "empty", "large"] as const).map(value => <button key={value} type="button" aria-pressed={previewCase === value} onClick={() => { setPreviewCase(value); setNotice(""); setOptionsOpen(false); }} className={`min-h-11 rounded-full border px-4 text-xs font-bold ${previewCase === value ? "border-[#f2c35f] bg-[#f2c35f] text-[#062016]" : "border-[#f2c35f]/35 text-[#f2c35f]"}`}>{value === "up" ? "Upward" : value === "down" ? "Downward" : value === "empty" ? "Empty" : "Large balance · synthetic"}</button>)}
        <button type="button" aria-pressed={nativeShell} onClick={() => { setNativeShell(value => !value); setOptionsOpen(false); }} className="min-h-11 rounded-full border border-[#f2c35f]/35 px-4 text-xs font-bold text-[#f2c35f]">{nativeShell ? "Native app styles" : "Website styles"}</button>
      </nav>}
    </header>
    <section className="sg-app-content sg-candle-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(112px+env(safe-area-inset-bottom))] sm:p-3 lg:pb-3">
      <div aria-hidden="true" className="sg-page-backdrop pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(221,177,89,0.065),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(250,246,240,0.035),transparent_26%)]" /></div>
      <div className="sg-route-content relative z-10 min-h-full lg:h-full lg:min-h-0">
        <main className="sg-portfolio-workspace sg-native-portfolio-shell min-h-full overflow-x-hidden bg-transparent pb-[calc(120px+env(safe-area-inset-bottom))] text-[#fffaf2] lg:pb-12">
          <div className="mx-auto w-full max-w-[1480px] lg:px-6 xl:px-8 2xl:px-10">
            <PortfolioStage key={previewCase} portfolioId={previewCase} portfolios={portfolios} meta={fixture.meta} summary={fixture.summary} chartData={fixture.chartData} chartMeta={fixture.chartMeta} stageRef={stageRef} sectionAnchorRef={sectionAnchorRef} section={section} onSection={chooseSection} onPortfolio={value => { if (isPreviewCase(value)) { setPreviewCase(value); setNotice(""); } }} onAdd={() => setNotice("Preview only: Add does not change any portfolio.")} onManage={() => setNotice("Preview only: Manage does not open account tools.")} />
            <div className="sg-portfolio-body px-4 pt-5 sm:px-6 lg:mx-auto lg:max-w-[1180px] lg:px-0 lg:pt-9">
              {notice && <p role="status" className="mb-4 rounded-xl border border-[#f2c35f]/25 bg-[#f2c35f]/10 px-4 py-3 text-sm text-[#ffe3a0]">{notice}</p>}
              <section role="tabpanel" aria-label={`${section} preview`}>
                {section === "overview" && <PortfolioOverview
                  portfolioId={previewCase} meta={fixture.meta} summary={fixture.summary}
                  holdings={fixture.holdings} opportunities={[]} canUsePremium={false}
                  latestActivityDate={fixture.holdings.length ? "2026-10-06T15:30:00.000Z" : null}
                  onHolding={holding => setNotice(`Preview only: ${holding.ticker} selected. No account tools are opened.`)}
                  onAnalysis={() => setNotice("Preview only: the full analysis sheet is not connected to an account.")}
                  onViewHoldings={() => chooseSection("holdings")}
                  onAdd={() => setNotice("Preview only: Add does not change any portfolio.")}
                />}
                {section === "holdings" && <PortfolioHoldings key={previewCase}
                  holdings={fixture.holdings} meta={fixture.meta}
                  onHolding={holding => setNotice(`Preview only: ${holding.ticker} selected. No account tools are opened.`)}
                  onAdd={() => setNotice("Preview only: Add does not change any portfolio.")}
                />}
                {section === "activity" && <PortfolioActivity transactions={[]} holdings={fixture.holdings} meta={fixture.meta} onHolding={holding => setNotice(`Preview only: ${holding.ticker} selected.`)} />}
              </section>
              <p className="mt-6 text-[11px] leading-5 text-[#c7dece]">Development-only preview. All balances, holdings, chart history and health scores are illustrative. Range buttons and chart scrubbing use the actual portfolio components; no account changes are made.</p>
            </div>
          </div>
        </main>
      </div>
    </section>
  </div>;
}
