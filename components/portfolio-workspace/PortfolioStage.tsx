"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import { RouletteNumber } from "@/components/RouletteNumber";
import {
  filterDisplayablePortfolioChartData,
  type PortfolioChartMeta,
} from "@/lib/portfolio-chart-health";
import { sanitisePortfolioChartData } from "@/lib/portfolio-chart-display";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import styles from "./PortfolioStage.module.css";
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
  const [scrubSelection, setScrubSelection] = useState<{
    point: ChartPoint;
    range: TimeRange;
    height: number;
  } | null>(null);
  const activeData = displayable[activeRange];
  const [chartRevision, setChartRevision] = useState({
    range: activeRange,
    height: chartHeight,
    data: activeData,
    sequence: 0,
  });
  // Reset both the headline and the chart's cursor together when its series or
  // geometry changes. Clearing the state also prevents an old selection from
  // returning if the viewport or available range later switches back.
  if (
    chartRevision.range !== activeRange ||
    chartRevision.height !== chartHeight ||
    chartRevision.data !== activeData
  ) {
    setChartRevision({
      range: activeRange,
      height: chartHeight,
      data: activeData,
      sequence: chartRevision.sequence + 1,
    });
    setScrubSelection(null);
  }

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setChartHeight(query.matches ? 318 : 218);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const scrubPoint = scrubSelection?.range === activeRange && scrubSelection.height === chartHeight
    ? activeData?.find((point) => (
      point.date === scrubSelection.point.date && point.close === scrubSelection.point.close
    )) ?? null
    : null;
  const currentValue = scrubPoint?.close ?? summary.totalValue;
  const valueText = money(currentValue, meta.currency);
  const valueWidth = useMemo(() => (activeData ?? []).reduce(
    (width, point) => Math.max(width, money(point.close, meta.currency).length),
    money(summary.totalValue, meta.currency).length,
  ), [activeData, summary.totalValue, meta.currency]);
  const currentPnl = scrubPoint ? (Number.isFinite(scrubPoint.pnl) ? scrubPoint.pnl! : null) : summary.totalPnl;
  const currentPnlPct = scrubPoint ? (Number.isFinite(scrubPoint.pnlPct) ? scrubPoint.pnlPct! : null) : summary.totalPnlPct;
  const returnText = currentPnl === null
    ? "Return unavailable for this point"
    : `${signedMoney(currentPnl, meta.currency)}${currentPnlPct === null ? "" : ` · ${signedPct(currentPnlPct)}`}`;
  const hasChart = (activeData?.length ?? 0) > 1;

  return (
    <>
      <section
        ref={stageRef}
        aria-label="Portfolio performance"
        className={`sg-portfolio-stage ${styles.stage}`}
      >
        <div className={styles.inner}>
          <div className="flex items-center justify-between gap-3">
            <label className="min-w-0 max-w-[70%]">
              <span className="sr-only">Selected portfolio</span>
              <span className="relative block">
                <select
                  value={portfolioId}
                  onChange={(event) => onPortfolio(event.target.value)}
                  className={styles.portfolioSelect}
                >
                  {portfolios.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id} className="bg-[#061b12]">
                      {portfolio.name}
                    </option>
                  ))}
                </select>
                <PortfolioIcon
                  name="chevron"
                  className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-[#ddb159]"
                />
              </span>
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onAdd}
                aria-label="Add to portfolio"
                data-native-haptic="medium"
                className={`${styles.action} ${styles.addAction} size-11 focus-visible:outline`}
              >
                <PortfolioIcon name="plus" />
                <span className={styles.actionLabel}>Add</span>
              </button>
              <button
                type="button"
                onClick={onManage}
                aria-label="Manage portfolio"
                className={`${styles.action} ${styles.manageAction} size-11 focus-visible:outline`}
              >
                <PortfolioIcon name="settings" />
                <span className={styles.actionLabel}>Manage</span>
              </button>
            </div>
          </div>

          <div className={styles.balance}>
            <div className={styles.captionRow}>
              <p className={styles.caption}>Portfolio value</p>
              <p className={styles.scrubDate}>{scrubPoint ? formatDate(scrubPoint.date, true) : ""}</p>
            </div>
            <h1
              className={styles.value}
              style={{ "--portfolio-value-width": Math.max(5, valueWidth * 0.66) } as CSSProperties}
              title={valueText}
            >
              <RouletteNumber value={valueText} />
            </h1>
            <div className={styles.metadata}>
              <div className="min-w-0">
                <p className={`${styles.returnValue} ${currentPnl === null ? "text-[#faf6f0]/60" : toneClass(currentPnl)}`}>
                  <RouletteNumber value={returnText} />
                </p>
                <p className={styles.detailLabel}>{scrubPoint ? "Total return at this point" : "Total return"}</p>
              </div>
              <div className={styles.health}>
                {summary.holdingsCount > 0 && (
                <span
                  aria-label={`Portfolio health ${summary.score} out of 100, ${summary.label}`}
                  className={styles.healthScore}
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
                  <span>Health <span className={styles.healthNumber}>{summary.score}/100</span></span>
                </span>
                )}
                <p className={styles.detailLabel}>
                  {freshnessCopy(chartMeta)}
                </p>
              </div>
            </div>
          </div>

          <div className={`sg-portfolio-stage-chart ${styles.chart}`}>
            {hasChart ? (
              <StockChart
                key={`${activeRange}-${chartHeight}-${chartRevision.sequence}`}
                ticker="Portfolio"
                data={{ [activeRange]: activeData }}
                initialRange={activeRange}
                height={chartHeight}
                compact
                color="#f2c35f"
                appearance="portfolio"
                formatValue={(value) => money(value, meta.currency)}
                onScrub={(point) => setScrubSelection(point ? { point, range: activeRange, height: chartHeight } : null)}
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
                    {chartMeta.health.displayState === "empty"
                      ? "Your portfolio value and history will appear here as you add holdings."
                      : "StockGPT only plots confirmed portfolio history. Sparse or stale data is rebuilt before it is shown."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            aria-label="Portfolio chart timeframe"
            className={styles.ranges}
          >
            {RANGE_ITEMS.map(({ range, label }) => {
              const available = availableRanges.some((item) => item.range === range);
              const active = available && activeRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  disabled={!available}
                  aria-pressed={active}
                  aria-label={`${label === "All" ? "All available history" : label} chart timeframe`}
                  title={available ? undefined : "Not enough history for this timeframe"}
                  onClick={() => {
                    setRequestedRange(range);
                    setScrubSelection(null);
                  }}
                  className={`${styles.range} min-h-11 focus-visible:outline`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className={`sg-portfolio-section-nav ${styles.sectionNav}`}>
        <div
          ref={sectionAnchorRef}
          data-portfolio-section-anchor
          className={styles.sectionInner}
        >
          <nav aria-label="Portfolio sections" className={styles.sectionTabs} role="tablist">
            {SECTION_ITEMS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={section === item.value}
                onClick={() => onSection(item.value)}
                className={`${styles.sectionTab} focus-visible:outline`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
