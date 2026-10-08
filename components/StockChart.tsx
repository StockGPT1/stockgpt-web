"use client";

import { useState, useMemo, useRef, useCallback, useEffect, useId, type KeyboardEvent } from "react";
import { RouletteNumber } from "@/components/RouletteNumber";
import { nativeHaptic } from "@/lib/ios-native";
import timeframeStyles from "@/components/ChartTimeframes.module.css";

export type ChartPoint = {
  date: string;
  close: number;
  basis?: number;
  pnl?: number;
  pnlPct?: number;
  synthetic?: boolean;
};

export type TimeRange = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "MAX";

type Props = {
  ticker: string;
  data: Partial<Record<TimeRange, ChartPoint[]>>;
  initialRange?: TimeRange;
  height?: number;
  compact?: boolean;
  color?: string;
  mobileTransparentFrame?: boolean;
  rangeOrder?: TimeRange[];
  showUnavailableRanges?: boolean;
  appearance?: "default" | "portfolio";
  interaction?: "default" | "stock";
  formatValue?: (value: number) => string;
  onScrub?: (point: ChartPoint | null, context: { range: TimeRange }) => void;
};

const DEFAULT_RANGES: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"];

function formatPrice(n: number) {
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string, range: TimeRange) {
  const d = new Date(iso);

  if (range === "1D") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "5D") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "1M" || range === "6M") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pointTime(point: ChartPoint) {
  const ms = new Date(point.date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function StockChart({
  ticker,
  data,
  initialRange = "1Y",
  height = 280,
  compact = false,
  color,
  mobileTransparentFrame = false,
  rangeOrder = DEFAULT_RANGES,
  showUnavailableRanges = false,
  appearance = "default",
  interaction = "default",
  formatValue,
  onScrub,
}: Props) {
  const [range, setRange] = useState<TimeRange>(initialRange);
  const [hoverSelection, setHoverSelection] = useState<{ index: number; points: ChartPoint[]; ticker: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const moveFrameRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const activePointerRef = useRef<{ id: number; target: SVGSVGElement } | null>(null);
  const scrubScrollLockedRef = useRef(false);
  const gradientId = `portfolio-chart-fill-${useId().replaceAll(":", "")}`;
  const isPortfolioAppearance = appearance === "portfolio";
  const isStockInteraction = interaction === "stock";
  const valueFormatter = formatValue ?? formatPrice;

  const availableRanges = useMemo(
    () => rangeOrder.filter((r) => (data[r]?.length ?? 0) > 1),
    [data, rangeOrder],
  );

  const resolvedRange =
    (data[range]?.length ?? 0) > 1 ? range : availableRanges[0] ?? range;
  const points = useMemo(() => data[resolvedRange] ?? [], [data, resolvedRange]);
  if (hoverSelection && (hoverSelection.points !== points || hoverSelection.ticker !== ticker)) {
    setHoverSelection(null);
  }
  const hoverIdx = hoverSelection?.points === points && hoverSelection.ticker === ticker
    ? hoverSelection.index : null;

  const direction = useMemo(() => {
    if (points.length < 2) return "flat";

    const first = points[0].close;
    const last = points[points.length - 1].close;

    return last >= first ? "up" : "down";
  }, [points]);

  const lineColor =
    color ??
    (direction === "up"
      ? "#10b981"
      : direction === "down"
        ? "#ef4444"
        : "#ddb159");

  const fillColor = `${lineColor}26`;
  const isPortfolioMiniChart = compact && ticker === "Portfolio";
  const lineStrokeWidth = isPortfolioAppearance ? 2 : isPortfolioMiniChart ? 1.35 : 2;

  const {
    svgWidth,
    padding,
    plotW,
    plotH,
    minPrice,
    maxPrice,
    pathD,
    areaD,
    gridPrices,
    pointXs,
  } = useMemo(() => {
    const svgWidth = 800;

    const padding = compact || isPortfolioAppearance
      ? { top: 8, right: 8, bottom: 8, left: 8 }
      : { top: 16, right: 12, bottom: 32, left: 56 };

    const plotW = svgWidth - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    if (points.length < 2) {
      return {
        svgWidth,
        padding,
        plotW,
        plotH,
        minPrice: 0,
        maxPrice: 0,
        pathD: "",
        areaD: "",
        gridPrices: [] as number[],
        pointXs: [] as number[],
      };
    }

    const closes = points.map((p) => p.close);
    let minP = Math.min(...closes);
    let maxP = Math.max(...closes);

    if (minP === maxP) {
      minP -= 1;
      maxP += 1;
    } else {
      const buffer = (maxP - minP) * 0.08;
      minP -= buffer;
      maxP += buffer;
    }

    const times = points.map((point, index) => pointTime(point) ?? index);
    let minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    if (minTime === maxTime) {
      minTime -= 1;
      maxTime += 1;
    }

    const yScale = (price: number) =>
      padding.top + plotH * (1 - (price - minP) / (maxP - minP));

    const xScale = (ms: number) =>
      padding.left + plotW * ((ms - minTime) / (maxTime - minTime));

    const pointXs = times.map((ms) => xScale(ms));

    let pathD = "";
    let areaD = "";

    points.forEach((p, i) => {
      const x = pointXs[i] ?? padding.left;
      const y = yScale(p.close);

      if (i === 0) {
        pathD = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
        areaD = `M ${x.toFixed(2)} ${(padding.top + plotH).toFixed(
          2,
        )} L ${x.toFixed(2)} ${y.toFixed(2)}`;
      } else {
        pathD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        areaD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    });

    const lastX = pointXs.at(-1) ?? padding.left + plotW;
    areaD += ` L ${lastX.toFixed(2)} ${(padding.top + plotH).toFixed(2)} Z`;

    const gridPrices: number[] = [];

    if (!compact && !isPortfolioAppearance) {
      for (let i = 0; i <= 4; i++) {
        gridPrices.push(minP + ((maxP - minP) * i) / 4);
      }
    }

    return {
      svgWidth,
      padding,
      plotW,
      plotH,
      minPrice: minP,
      maxPrice: maxP,
      pathD,
      areaD,
      gridPrices,
      pointXs,
    };
  }, [points, height, compact, isPortfolioAppearance]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!svgRef.current || points.length < 2) return;

      const rect = svgRef.current.getBoundingClientRect();
      const cursorX = ((clientX - rect.left) / rect.width) * svgWidth;
      const idx = pointXs.reduce(
        (nearest, x, index) =>
          Math.abs(x - cursorX) < Math.abs((pointXs[nearest] ?? 0) - cursorX)
            ? index
            : nearest,
        0,
      );

      setHoverSelection({ index: idx, points, ticker });

      onScrub?.(points[idx], { range: resolvedRange });
    },
    [points, ticker, svgWidth, pointXs, onScrub, resolvedRange],
  );

  const scheduleMove = useCallback(
    (clientX: number) => {
      pendingClientXRef.current = clientX;
      if (moveFrameRef.current != null) return;

      moveFrameRef.current = window.requestAnimationFrame(() => {
        moveFrameRef.current = null;
        const pendingClientX = pendingClientXRef.current;
        if (pendingClientX != null) handleMove(pendingClientX);
      });
    },
    [handleMove],
  );

  const cancelPendingMove = useCallback(() => {
    pendingClientXRef.current = null;
    if (moveFrameRef.current != null) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
  }, []);

  const releaseStockPointer = useCallback(() => {
    scrubScrollLockedRef.current = false;
    const active = activePointerRef.current;
    activePointerRef.current = null;
    if (active) {
      try { active.target.releasePointerCapture(active.id); } catch { /* The browser may already have released a cancelled pointer. */ }
    }
  }, []);

  useEffect(() => {
    if (!isStockInteraction) return cancelPendingMove;
    const blockScrubScroll = (event: WheelEvent) => {
      if (scrubScrollLockedRef.current) event.preventDefault();
    };
    // A non-passive listener also blocks trackpad scrolling in nested page scrollers.
    document.addEventListener("wheel", blockScrubScroll, { passive: false });
    return () => {
      document.removeEventListener("wheel", blockScrubScroll);
      cancelPendingMove();
      releaseStockPointer();
    };
  }, [isStockInteraction, resolvedRange, points, ticker, cancelPendingMove, releaseStockPointer]);

  const handlePointerLeave = useCallback(() => {
    cancelPendingMove();
    releaseStockPointer();
    setHoverSelection(null);
    onScrub?.(null, { range: resolvedRange });
  }, [cancelPendingMove, releaseStockPointer, onScrub, resolvedRange]);

  const handleKeyDown = useCallback((event: KeyboardEvent<SVGSVGElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      handlePointerLeave();
      return;
    }
    pendingClientXRef.current = null;
    if (moveFrameRef.current != null) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
    const current = hoverIdx ?? points.length - 1;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? points.length - 1
        : Math.max(0, Math.min(points.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1)));
    setHoverSelection({ index: next, points, ticker });
    onScrub?.(points[next], { range: resolvedRange });
  }, [handlePointerLeave, hoverIdx, onScrub, points, ticker, resolvedRange]);

  const summary = useMemo(() => {
    if (points.length < 2) return null;

    const first = points[0].close;
    const last = points[points.length - 1].close;
    const change = last - first;
    const changePct = first !== 0 ? (change / first) * 100 : 0;

    return { first, last, change, changePct };
  }, [points]);

  const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;
  const displayedChange = summary
    ? (isStockInteraction && hoverPoint ? hoverPoint.close : summary.last) - summary.first
    : 0;
  const displayedChangePct = summary?.first ? (displayedChange / summary.first) * 100 : 0;

  const yScale = (price: number) =>
    minPrice === maxPrice
      ? padding.top + plotH / 2
      : padding.top + plotH * (1 - (price - minPrice) / (maxPrice - minPrice));

  const xPos =
    hoverIdx != null
      ? pointXs[hoverIdx] ?? 0
      : 0;

  const yPos = hoverPoint ? yScale(hoverPoint.close) : 0;
  const hideTooltip = isPortfolioAppearance || (compact && ticker === "Portfolio");
  const scrubDateLeft = hoverPoint
    ? `clamp(0.75rem, calc(${(xPos / svgWidth) * 100}% - 5rem), calc(100% - 10.85rem))`
    : "0.75rem";
  const stockScrubDateLeft = `clamp(0.375rem, calc(${(xPos / svgWidth) * 100}% - 4rem), calc(100% - 8.375rem))`;

  if (points.length < 2) {
    return (
      <div
        className={[
          "flex items-center justify-center",
          isPortfolioAppearance ? "bg-transparent" : mobileTransparentFrame ? "bg-transparent sm:rounded-xl sm:bg-[#072116]/40" : "rounded-xl bg-[#072116]/40",
        ].join(" ")}
        style={{ height: `${height}px` }}
      >
        <p className="text-[12px] font-semibold text-[#faf6f0]/40">
          No chart data available
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {!compact && summary && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#faf6f0]/45">
              {ticker} · {resolvedRange}
            </p>

            <p className="mt-0.5 text-[24px] font-black tabular-nums tracking-[-0.03em] text-[#faf6f0]">
              <RouletteNumber
                value={valueFormatter(hoverPoint ? hoverPoint.close : summary.last)}
              />
            </p>

            {hoverPoint && !isStockInteraction ? (
              <p className="text-[11px] font-semibold text-[#faf6f0]/55">
                {formatDate(hoverPoint.date, resolvedRange)}
              </p>
            ) : (
              <p
                className={`text-[11px] font-bold ${
                  displayedChange >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                <RouletteNumber
                  value={isStockInteraction
                    ? `${displayedChange >= 0 ? "+" : "-"}${valueFormatter(Math.abs(displayedChange))} (${displayedChangePct >= 0 ? "+" : ""}${displayedChangePct.toFixed(2)}%)`
                    : `${summary.change >= 0 ? "+" : ""}${valueFormatter(summary.change)} (${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(2)}%)`}
                />
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className={[
          "sg-stock-chart-frame relative overflow-hidden",
          isPortfolioAppearance ? "bg-transparent" : mobileTransparentFrame ? "bg-transparent sm:rounded-xl sm:bg-[#072116]/40" : "rounded-xl bg-[#072116]/40",
        ].join(" ")}
        style={{ height: `${height}px` }}
      >
        <svg
          key={resolvedRange}
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${height}`}
          preserveAspectRatio="none"
          className={`sg-stock-chart-canvas h-full w-full ${isStockInteraction || !isPortfolioAppearance ? "touch-none" : "touch-pan-y"} ${isPortfolioAppearance ? "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159]" : ""}`}
          data-stock-chart-scrub-lock={isStockInteraction ? true : undefined}
          tabIndex={isPortfolioAppearance ? 0 : undefined}
          role={isPortfolioAppearance ? "slider" : undefined}
          aria-label={isPortfolioAppearance ? `${ticker} value history, ${resolvedRange}` : undefined}
          aria-description={isPortfolioAppearance ? "Use Left and Right arrows to inspect recorded values, Home and End for the first and last points, and Escape to return to the latest value. The dashed guide marks the first value in view." : undefined}
          aria-valuemin={isPortfolioAppearance ? 0 : undefined}
          aria-valuemax={isPortfolioAppearance ? points.length - 1 : undefined}
          aria-valuenow={isPortfolioAppearance ? hoverIdx ?? points.length - 1 : undefined}
          aria-valuetext={isPortfolioAppearance ? `${formatDate((hoverPoint ?? points[points.length - 1]).date, resolvedRange)}: ${valueFormatter((hoverPoint ?? points[points.length - 1]).close)}` : undefined}
          onKeyDown={isPortfolioAppearance ? handleKeyDown : undefined}
          onBlur={isPortfolioAppearance ? handlePointerLeave : undefined}
          onPointerMove={(e) => {
            if (isStockInteraction) {
              if (e.isPrimary === false || (activePointerRef.current && activePointerRef.current.id !== e.pointerId)) return;
              scrubScrollLockedRef.current = true;
            }
            scheduleMove(e.clientX);
          }}
          onPointerDown={(e) => {
            if (isStockInteraction) {
              if (!e.isPrimary || e.button !== 0 || (activePointerRef.current && activePointerRef.current.id !== e.pointerId)) return;
              scrubScrollLockedRef.current = true;
              activePointerRef.current = { id: e.pointerId, target: e.currentTarget };
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch {
                activePointerRef.current = null;
              }
            }
            if (isPortfolioAppearance && e.isPrimary && e.button === 0) {
              try { nativeHaptic("light"); } catch { /* Feedback is optional when the native bridge is unavailable. */ }
            }
            handleMove(e.clientX);
          }}
          onPointerLeave={() => {
            if (isStockInteraction && activePointerRef.current) return;
            handlePointerLeave();
          }}
          onPointerCancel={(e) => {
            if (isStockInteraction && activePointerRef.current && activePointerRef.current.id !== e.pointerId) return;
            handlePointerLeave();
          }}
          onLostPointerCapture={isStockInteraction ? (e) => {
            if (activePointerRef.current?.id === e.pointerId) handlePointerLeave();
          } : undefined}
          onPointerUp={(e) => {
            if (isStockInteraction) {
              if (e.isPrimary === false || (activePointerRef.current && activePointerRef.current.id !== e.pointerId)) return;
              cancelPendingMove();
              handleMove(e.clientX);
              releaseStockPointer();
              return;
            }
            if (onScrub) {
              handlePointerLeave();
              return;
            }
            handleMove(e.clientX);
          }}
        >
          {isPortfolioAppearance && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.08" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>
          )}
          {!compact && !isPortfolioAppearance &&
            gridPrices.map((price, i) => {
              const y = yScale(price);

              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    x2={padding.left + plotW}
                    y1={y}
                    y2={y}
                    stroke="#ddb159"
                    strokeOpacity="0.08"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={padding.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#faf6f0"
                    fillOpacity="0.4"
                    fontWeight="600"
                  >
                    {valueFormatter(price)}
                  </text>
                </g>
              );
            })}

          <path className="sg-stock-chart-area" d={areaD} fill={isPortfolioAppearance ? `url(#${gradientId})` : fillColor} />

          {isPortfolioAppearance && (
            <line
              x1={padding.left}
              x2={padding.left + plotW}
              y1={yScale(points[0].close)}
              y2={yScale(points[0].close)}
              stroke={lineColor}
              strokeOpacity="0.22"
              strokeDasharray="2 5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <path
            className="sg-stock-chart-line"
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={lineStrokeWidth}
            vectorEffect={isPortfolioAppearance ? "non-scaling-stroke" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={isPortfolioAppearance ? undefined : { filter: `drop-shadow(0 0 7px ${lineColor}66)` }}
          />

          {isPortfolioAppearance && !hoverPoint && (
            <circle cx={pointXs[points.length - 1]} cy={yScale(points[points.length - 1].close)} r="3" fill={lineColor} />
          )}

          {hoverPoint && (
            <>
              <line
                x1={xPos}
                x2={xPos}
                y1={padding.top}
                y2={padding.top + plotH}
                stroke="#ddb159"
                strokeOpacity={compact ? "0.55" : "0.4"}
                strokeDasharray="3 3"
              />
              <circle cx={xPos} cy={yPos} r={compact ? "4" : "5"} fill={lineColor} />
              <circle
                cx={xPos}
                cy={yPos}
                r={compact ? "7" : "9"}
                fill={lineColor}
                fillOpacity="0.25"
              />
            </>
          )}

          {!compact && !isPortfolioAppearance && points.length > 2 && (
            <>
              {[0, Math.floor(points.length / 2), points.length - 1].map(
                (idx, i) => {
                  const x = pointXs[idx] ?? padding.left;
                  const dateText = formatDate(points[idx].date, resolvedRange);

                  return (
                    <text
                      key={i}
                      x={x}
                      y={height - 10}
                      textAnchor={
                        i === 0 ? "start" : i === 2 ? "end" : "middle"
                      }
                      fontSize="10"
                      fill="#faf6f0"
                      fillOpacity="0.4"
                      fontWeight="600"
                    >
                      {dateText}
                    </text>
                  );
                },
              )}
            </>
          )}
        </svg>

        {hoverPoint && isStockInteraction && (
          <div
            data-stock-chart-scrub-date
            aria-hidden="true"
            className="pointer-events-none absolute top-1 z-20 w-32 whitespace-nowrap rounded-md border border-[#ddb159]/20 bg-[#072116]/90 px-1 py-1 text-center text-[10px] font-semibold tabular-nums text-[#faf6f0]/80"
            style={{ left: stockScrubDateLeft }}
          >
            {formatDate(hoverPoint.date, resolvedRange)}
          </div>
        )}

        {hoverPoint && !hideTooltip && (
          <div
            className={[
              "pointer-events-none absolute rounded-lg border border-[#ddb159]/30 bg-[#072116]/95 backdrop-blur",
              compact
                ? "right-2 top-2 px-2.5 py-1.5"
                : "right-3 top-3 px-3 py-2",
            ].join(" ")}
          >
            <p
              className={[
                "font-bold uppercase tracking-wider text-[#ddb159]/75",
                compact ? "text-[8px]" : "text-[9px]",
              ].join(" ")}
            >
              {formatDate(hoverPoint.date, resolvedRange)}
            </p>

            <p
              className={[
                "font-black tabular-nums text-[#faf6f0]",
                compact ? "mt-0.5 text-[12px]" : "mt-0.5 text-[14px]",
              ].join(" ")}
            >
              <RouletteNumber value={valueFormatter(hoverPoint.close)} />
            </p>
          </div>
        )}

        {hoverPoint && hideTooltip && !isPortfolioAppearance && (
          <div
            className="pointer-events-none absolute bottom-3 z-20 w-[10rem] rounded-full border border-[#ddb159]/28 bg-[#072116]/92 px-2.5 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.06em] text-[#ddb159] shadow-[0_10px_22px_rgba(0,0,0,0.28)] backdrop-blur"
            style={{ left: scrubDateLeft }}
          >
            {formatDate(hoverPoint.date, resolvedRange)}
          </div>
        )}
      </div>

      {!compact && (showUnavailableRanges ? rangeOrder.length > 1 : availableRanges.length > 1) && (
        <div
          aria-label={`${ticker} chart timeframe`}
          className={isPortfolioAppearance ? timeframeStyles.ranges : "flex flex-wrap gap-1"}
        >
          {(showUnavailableRanges ? rangeOrder : availableRanges).map((r) => {
            const available = (data[r]?.length ?? 0) > 1;
            const label = isPortfolioAppearance && r === "MAX" ? "All" : r;
            return (
              <button
                key={r}
                type="button"
                disabled={!available}
                aria-pressed={available && resolvedRange === r}
                aria-label={available ? `Show ${label} chart` : `${label} chart temporarily unavailable`}
                onClick={() => {
                  if (!available) return;
                  cancelPendingMove();
                  releaseStockPointer();
                  setHoverSelection(null);
                  onScrub?.(null, { range: r });
                  setRange(r);
                }}
                className={isPortfolioAppearance ? `${timeframeStyles.range} min-h-11 focus-visible:outline` : `rounded-md px-3 py-1 text-[11px] font-black transition ${
                  resolvedRange === r
                    ? "sg-metal-gold-fill"
                    : available
                      ? "bg-[#072116]/40 text-[#faf6f0]/65 hover:bg-[#072116]/60 hover:text-[#faf6f0]"
                      : "cursor-not-allowed bg-[#072116]/20 text-[#faf6f0]/22"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
