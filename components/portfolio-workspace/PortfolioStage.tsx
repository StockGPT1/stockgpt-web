"use client";

import {
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import {
  filterDisplayablePortfolioChartData,
  type PortfolioChartMeta,
} from "@/lib/portfolio-chart-health";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import type {
  PortfolioMeta,
  PortfolioOption,
  PortfolioSection,
} from "@/components/portfolio-workspace/types";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import {
  formatDate,
  freshnessCopy,
  money,
  signedMoney,
  signedPct,
  toneClass,
} from "@/components/portfolio-workspace/utils";

const RANGE_ITEMS: Array<{ range: TimeRange; label: string }> = [
  { range: "1D", label: "1D" },
  { range: "1M", label: "1M" },
  { range: "6M", label: "6M" },
  { range: "1Y", label: "1Y" },
  { range: "MAX", label: "All" },
];

const SECTION_ITEMS: Array<{ value: PortfolioSection; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "holdings", label: "Holdings" },
  { value: "activity", label: "Activity" },
];

function chartStateTitle(meta: PortfolioChartMeta) {
  if (meta.health.displayState === "empty") return "Add holdings to start charting";
  if (meta.health.displayState === "error_no_cache") return "Chart history unavailable";
  if (meta.health.displayState === "error_with_cache") return "Using the last reliable chart";
  if (meta.health.displayState === "repairing") return "Repairing chart history";
  if (meta.health.displayState === "building") return "Building chart history";
  return "Preparing reliable chart history";
}

export function PortfolioStage({
  portfolioId,
  portfolios,
  meta,
  summary,
  chartData,
  chartMeta,
  stageRef,
  sectionAnchorRef,
  stageVisible,
  section,
  onSection,
  onPortfolio,
  onAdd,
  onManage,
}: {
  portfolioId: string;
  portfolios: PortfolioOption[];
  meta: PortfolioMeta;
  summary: PortfolioHealthSummary;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta: PortfolioChartMeta;
  stageRef: RefObject<HTMLElement | null>;
  sectionAnchorRef: RefObject<HTMLDivElement | null>;
  stageVisible: boolean;
  section: PortfolioSection;
  onSection: (section: PortfolioSection) => void;
  onPortfolio: (portfolioId: string) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const displayable = useMemo(
    () => filterDisplayablePortfolioChartData(chartData),
    [chartData],
  );
  const availableRanges = useMemo(
    () => RANGE_ITEMS.filter(({ range }) => (displayable[range]?.length ?? 0) > 1),
    [displayable],
  );
  const [activeRange, setActiveRange] = useState<TimeRange>(
    availableRanges.some(({ range }) => range === "1M")
      ? "1M"
      : availableRanges[0]?.range ?? "1M",
  );
  const [scrubPoint, setScrubPoint] = useState<ChartPoint | null>(null);

  useEffect(() => {
    if (availableRanges.some(({ range }) => range === activeRange)) return;
    setActiveRange(
      availableRanges.some(({ range }) => range === "1M")
        ? "1M"
        : availableRanges[0]?.range ?? "1M",
    );
    setScrubPoint(null);
  }, [activeRange, availableRanges]);

  const currentValue = scrubPoint?.close ?? summary.totalValue;
  const currentPnl = scrubPoint?.pnl ?? summary.totalPnl;
  const currentPnlPct = scrubPoint?.pnlPct ?? summary.totalPnlPct;
  const activeData = displayable[activeRange];
  const hasChart = (activeData?.length ?? 0) > 1;

  return (
    <>
      <section
        ref={stageRef}
        aria-label="Portfolio performance"
        className="relative isolate min-h-[520px] overflow-hidden border-b border-[#ddb159]/14 px-4 pb-5 pt-5 sm:px-6 lg:mt-5 lg:min-h-[470px] lg:rounded-[28px] lg:border lg:px-8 lg:pb-7 lg:pt-7"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(221,177,89,0.12),transparent_34%),linear-gradient(180deg,#0a2a1d_0%,#061b12_74%)]" />
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-start justify-between gap-3">
            <label className="min-w-0 max-w-[72%]">
              <span className="sr-only">Selected portfolio</span>
              <span className="relative block">
                <select
                  value={portfolioId}
                  onChange={(event) => onPortfolio(event.target.value)}
                  className="h-12 w-full appearance-none truncate rounded-full border border-[#ddb159]/26 bg-[#04140c]/62 pl-4 pr-10 text-[13px] font-black text-[#faf6f0] outline-none backdrop-blur focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/32"
                >
                  {portfolios.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id} className="bg-[#061b12]">
                      {portfolio.name}
                    </option>
                  ))}
                </select>
                <PortfolioIcon
                  name="chevron"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#ddb159]"
                />
              </span>
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onAdd}
                aria-label="Add to portfolio"
                className="grid size-12 place-items-center rounded-full border border-[#ddb159]/30 bg-[#ddb159] text-[#061b12] shadow-[0_10px_24px_rgba(221,177,89,0.16)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#faf6f0]"
              >
                <PortfolioIcon name="plus" />
              </button>
              <button
                type="button"
                onClick={onManage}
                aria-label="Manage portfolio"
                className="grid size-12 place-items-center rounded-full border border-[#ddb159]/24 bg-[#04140c]/62 text-[#ddb159] transition hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
              >
                <PortfolioIcon name="settings" />
              </button>
            </div>
          </div>

          <div className="mt-8 text-center lg:mt-5 lg:text-left">
            <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/42">
                  Current portfolio value
                </p>
                <h1 className="mt-2 truncate text-[clamp(42px,12vw,62px)] font-black leading-none tracking-[-0.065em] tabular-nums text-[#faf6f0] lg:text-[60px]">
                  {money(currentValue, meta.currency)}
                </h1>
                <p className={`mt-3 text-[17px] font-black tabular-nums ${toneClass(currentPnl)}`}>
                  {signedMoney(currentPnl, meta.currency)} · {signedPct(currentPnlPct)}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-center gap-4 lg:mt-0 lg:justify-end">
                <div
                  className="grid size-16 shrink-0 place-items-center rounded-full border border-[#ddb159]/34 bg-[#ddb159]/8 text-center"
                  aria-label={`Portfolio health ${summary.score} out of 100, ${summary.label}`}
                >
                  <span className="block text-[20px] font-black leading-none text-[#ddb159]">
                    {summary.score}
                  </span>
                  <span className="mt-0.5 block text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/45">
                    Health
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-black text-[#faf6f0]">{summary.label}</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#faf6f0]/42">
                    {freshnessCopy(chartMeta)}
                  </p>
                  {scrubPoint && (
                    <p className="mt-1 text-[10px] font-semibold text-[#ddb159]">
                      {formatDate(scrubPoint.date, true)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 min-h-[300px] w-full lg:mt-2">
            {hasChart ? (
              <StockChart
                key={activeRange}
                ticker="Portfolio"
                data={{ [activeRange]: activeData }}
                initialRange={activeRange}
                height={318}
                compact
                color="#ddb159"
                mobileTransparentFrame
                onScrub={(point) => setScrubPoint(point)}
              />
            ) : (
              <div className="flex h-[318px] items-center justify-center border-y border-[#faf6f0]/8 text-center">
                <div className="max-w-md px-6">
                  <p className="text-[18px] font-black text-[#faf6f0]">
                    {chartStateTitle(chartMeta)}
                  </p>
                  <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/48">
                    StockGPT only plots confirmed portfolio snapshots. It will not invent movement while history is incomplete.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            aria-label="Portfolio chart timeframe"
            className="mt-2 grid min-h-11 grid-cols-5 items-center gap-1"
          >
            {RANGE_ITEMS.map(({ range, label }) => {
              const available = availableRanges.some((item) => item.range === range);
              const active = activeRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  disabled={!available}
                  aria-pressed={active}
                  onClick={() => {
                    setActiveRange(range);
                    setScrubPoint(null);
                  }}
                  className={`mx-auto grid min-h-11 min-w-11 place-items-center rounded-full px-3 text-[12px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] ${
                    active
                      ? "bg-[#faf6f0] text-[#061b12]"
                      : available
                        ? "text-[#faf6f0]/56 hover:bg-[#faf6f0]/5 hover:text-[#faf6f0]"
                        : "cursor-not-allowed text-[#faf6f0]/18"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div
        className={`sticky top-0 z-40 border-b border-[#ddb159]/14 bg-[#061b12]/94 backdrop-blur-xl transition ${
          stageVisible ? "" : "shadow-[0_14px_32px_rgba(0,0,0,0.24)]"
        }`}
      >
        {!stageVisible && (
          <button
            type="button"
            onClick={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex h-[52px] w-full items-center justify-between gap-3 px-4 text-left sm:px-6 lg:px-8"
          >
            <span className="min-w-0 truncate text-[12px] font-black text-[#faf6f0]">
              {meta.name}
            </span>
            <span className="shrink-0 text-right">
              <span className="text-[14px] font-black tabular-nums text-[#faf6f0]">
                {money(summary.totalValue, meta.currency)}
              </span>
              <span className={`ml-2 text-[11px] font-black ${toneClass(summary.totalPnlPct)}`}>
                {signedPct(summary.totalPnlPct)}
              </span>
            </span>
          </button>
        )}

        <div
          ref={sectionAnchorRef}
          data-portfolio-section-anchor
          className="grid h-[52px] grid-cols-[1fr_auto] items-stretch px-1 sm:px-4 lg:px-8"
        >
          <nav aria-label="Portfolio sections" className="grid grid-cols-3" role="tablist">
            {SECTION_ITEMS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={section === item.value}
                onClick={() => onSection(item.value)}
                className={`relative min-w-0 px-2 text-[12px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159] ${
                  section === item.value
                    ? "text-[#faf6f0]"
                    : "text-[#faf6f0]/42 hover:text-[#faf6f0]/70"
                }`}
              >
                {item.label}
                {section === item.value && (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[#ddb159]" />
                )}
              </button>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#061b12]"
            >
              <PortfolioIcon name="plus" className="size-4" /> Add
            </button>
            <button
              type="button"
              onClick={onManage}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[#ddb159]/24 px-4 text-[11px] font-black text-[#ddb159]"
            >
              <PortfolioIcon name="settings" className="size-4" /> Manage
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
