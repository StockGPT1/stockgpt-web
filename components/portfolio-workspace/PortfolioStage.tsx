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
import { sanitisePortfolioChartData } from "@/lib/portfolio-chart-display";
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
  { range: "5D", label: "5D" },
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
  section: PortfolioSection;
  onSection: (section: PortfolioSection) => void;
  onPortfolio: (portfolioId: string) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const displayable = useMemo(
    () => filterDisplayablePortfolioChartData(sanitisePortfolioChartData(chartData)),
    [chartData],
  );
  const availableRanges = useMemo(
    () => RANGE_ITEMS.filter(({ range }) => (displayable[range]?.length ?? 0) > 1),
    [displayable],
  );
  const preferredRange = availableRanges.some(({ range }) => range === "1M")
    ? "1M"
    : availableRanges[0]?.range ?? "1M";
  const [requestedRange, setRequestedRange] = useState<TimeRange>(preferredRange);
  const [chartHeight, setChartHeight] = useState(218);
  const activeRange = availableRanges.some(({ range }) => range === requestedRange)
    ? requestedRange
    : preferredRange;
  const [scrubPoint, setScrubPoint] = useState<ChartPoint | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setChartHeight(query.matches ? 318 : 218);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

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
        className="sg-portfolio-stage relative isolate overflow-hidden border-b border-[#f2c35f]/20 px-4 pb-3 pt-3 sm:px-6 lg:mt-5 lg:min-h-[470px] lg:rounded-[30px] lg:border lg:px-8 lg:pb-7 lg:pt-7"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-2%,rgba(255,224,138,0.18),transparent_31%),radial-gradient(circle_at_12%_46%,rgba(52,211,153,0.10),transparent_34%),linear-gradient(180deg,#0d3a27_0%,#082b1d_60%,#062117_100%)]" />
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-center justify-between gap-3">
            <label className="min-w-0 max-w-[70%]">
              <span className="sr-only">Selected portfolio</span>
              <span className="relative block">
                <select
                  value={portfolioId}
                  onChange={(event) => onPortfolio(event.target.value)}
                  className="h-11 w-full appearance-none truncate rounded-full border border-[#f2c35f]/32 bg-[#052218]/72 pl-4 pr-9 text-[12px] font-black text-[#fffaf2] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur focus:border-[#f2c35f] focus-visible:ring-2 focus-visible:ring-[#f2c35f]/32 lg:h-12 lg:text-[13px]"
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
                data-native-haptic="medium"
                className="grid size-11 place-items-center rounded-full border border-[#ffe6a0]/55 bg-[linear-gradient(180deg,#ffeaa3,#f2c35f_52%,#d99f2f)] text-[#062016] shadow-[0_10px_26px_rgba(242,195,95,0.24),inset_0_1px_0_rgba(255,255,255,0.52)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#fffaf2] lg:size-12"
              >
                <PortfolioIcon name="plus" />
              </button>
              <button
                type="button"
                onClick={onManage}
                aria-label="Manage portfolio"
                className="grid size-11 place-items-center rounded-full border border-[#f2c35f]/28 bg-[#052218]/72 text-[#f2c35f] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:bg-[#f2c35f]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2c35f] lg:size-12"
              >
                <PortfolioIcon name="settings" />
              </button>
            </div>
          </div>

          <div className="mt-4 lg:mt-5">
            <div className="flex items-end justify-between gap-3 lg:gap-8">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#faf6f0]/42 lg:text-[11px]">
                  Portfolio value
                </p>
                <h1 className="mt-1 truncate text-[clamp(38px,10.5vw,52px)] font-black leading-none tracking-[-0.065em] tabular-nums text-[#fffaf2] drop-shadow-[0_6px_24px_rgba(242,195,95,0.08)] lg:mt-2 lg:text-[62px]">
                  {money(currentValue, meta.currency)}
                </h1>
                <p className={`mt-2 text-[14px] font-black tabular-nums lg:mt-3 lg:text-[17px] ${toneClass(currentPnl)}`}>
                  {signedMoney(currentPnl, meta.currency)} · {signedPct(currentPnlPct)}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  aria-label={`Portfolio health ${summary.score} out of 100, ${summary.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#f2c35f]/34 bg-[#f2c35f]/12 py-1.5 pl-2.5 pr-3 shadow-[0_8px_20px_rgba(242,195,95,0.08)]"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${
                      summary.score >= 67
                        ? "bg-emerald-400"
                        : summary.score >= 40
                          ? "bg-[#ddb159]"
                          : "bg-red-400"
                    }`}
                  />
                  <span className="text-[11px] font-black tabular-nums text-[#f7cd72] lg:text-[13px]">
                    {summary.score}/100
                  </span>
                </span>
                <p className="max-w-[124px] truncate text-[9px] font-semibold text-[#faf6f0]/38 lg:max-w-none lg:text-[10px]">
                  {freshnessCopy(chartMeta)}
                </p>
                {scrubPoint && (
                  <p className="text-[9px] font-semibold text-[#ddb159] lg:text-[10px]">
                    {formatDate(scrubPoint.date, true)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-1 w-full lg:mt-2">
            {hasChart ? (
              <StockChart
                key={`${activeRange}-${chartHeight}`}
                ticker="Portfolio"
                data={{ [activeRange]: activeData }}
                initialRange={activeRange}
                height={chartHeight}
                compact
                color="#f2c35f"
                mobileTransparentFrame
                onScrub={(point) => setScrubPoint(point)}
              />
            ) : (
              <div
                className="flex items-center justify-center border-y border-[#faf6f0]/8 text-center"
                style={{ height: chartHeight }}
              >
                <div className="max-w-md px-6">
                  <p className="text-[16px] font-black text-[#faf6f0] lg:text-[18px]">
                    {chartStateTitle(chartMeta)}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/48 lg:text-[12px] lg:leading-6">
                    StockGPT only plots confirmed portfolio history. Sparse or stale data is rebuilt before it is shown.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            aria-label="Portfolio chart timeframe"
            className="mt-1 grid min-h-10 grid-cols-6 items-center gap-0 lg:mt-2 lg:min-h-11 lg:gap-1"
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
                    setRequestedRange(range);
                    setScrubPoint(null);
                  }}
                  className={`mx-auto grid min-h-10 min-w-10 place-items-center rounded-full px-2 text-[11px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] lg:min-h-11 lg:min-w-11 lg:px-3 lg:text-[12px] ${
                    active
                      ? "bg-[linear-gradient(180deg,#fff0b5,#f2c35f)] text-[#062016] shadow-[0_7px_18px_rgba(242,195,95,0.18)]"
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

      <div className="border-b border-[#f2c35f]/18 bg-[#08281b]/92 backdrop-blur-xl">
        <div
          ref={sectionAnchorRef}
          data-portfolio-section-anchor
          className="grid h-[48px] grid-cols-[1fr_auto] items-stretch px-1 sm:px-4 lg:h-[52px] lg:px-8"
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
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[#f2c35f] shadow-[0_0_12px_rgba(242,195,95,0.45)]" />
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
