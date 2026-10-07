export type ScanVerdict = "bullish" | "bearish" | "inconclusive";
export type SignalKind = "structure" | "pattern" | "candle" | "level" | "indicator" | "volume";
export type PctBox = { x_pct: number; y_pct: number; width_pct: number; height_pct: number };
type JsonRecord = Record<string, unknown>;

export type ChartRegion = {
  id: string;
  name: string;
  placement: "price_overlay" | "panel";
  source_image: number;
  readable: boolean;
  box: PctBox | null;
};

export type ChartLayout = {
  price_series_type: "candles" | "price_line" | "unsupported" | "unknown";
  price_plot_box: PctBox | null;
  indicators: ChartRegion[];
  exclusions: PctBox[];
};

export type ChartScanResult = {
  verdict: ScanVerdict;
  label: string;
  pattern: string;
  confidence: number;
  ticker: string | null;
  timeframe: string | null;
  summary: string;
  confirmation: string;
  invalidation: string;
  watch_for: string;
  observations: string[];
  current_price: string | null;
  retake_required: boolean;
  retake_reason: string | null;
  needs_more_info: boolean;
  more_info_prompt: string | null;
  price_series_type: ChartLayout["price_series_type"];
  chart_coverage: "full" | "partial" | "unclear";
  verification_status: "reviewed" | "unavailable";
  indicator_checks: Array<{
    id: string;
    name: string;
    source_image: number;
    status: "readable" | "unreadable" | "not_confirmed" | "not_reviewed";
    finding: string | null;
  }>;
  signals: Array<{
    name: string;
    kind: SignalKind;
    bias: "bullish" | "bearish" | "neutral";
    confidence: number;
    evidence: string;
    region_id: string;
    source_image: number;
    box: PctBox | null;
  }>;
  trade_plan: {
    entry: string | null;
    stop_loss: string | null;
    take_profit: string | null;
    risk_reward: string | null;
    projected_bars: string | null;
    projected_horizon: string | null;
    plan: string | null;
    rationale: string | null;
  };
  levels: { support: string | null; resistance: string | null; breakout: string | null; invalidation: string | null };
  overlay: {
    price_plot_box: PctBox | null;
    resistance_y_pct: number | null;
    support_y_pct: number | null;
    pattern_box: PctBox | null;
  };
};

export function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function scanText(value: unknown, max = 220): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return !cleaned || /^(null|unknown|n\/a|none)$/i.test(cleaned) ? null : cleaned.slice(0, max);
}

function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function confidence(value: unknown) {
  const n = number(value);
  return n === null ? 0 : Math.max(0, Math.min(100, Math.round(n)));
}

function pct(value: unknown) {
  const n = number(value);
  return n !== null && n >= 0 && n <= 100 ? n : null;
}

export function normaliseScanBox(value: unknown): PctBox | null {
  const box = record(value);
  const x = pct(box.x_pct), y = pct(box.y_pct);
  const w = pct(box.width_pct), h = pct(box.height_pct);
  // Do not coerce null/strings to zero, clamp invalid geometry, or accept zero-area boxes.
  if (x === null || y === null || w === null || h === null || w < 0.5 || h < 0.5) return null;
  if (x + w > 100 || y + h > 100) return null;
  return { x_pct: x, y_pct: y, width_pct: w, height_pct: h };
}

export function boxInside(inner: PctBox | null, outer: PctBox | null) {
  return Boolean(inner && outer && inner.x_pct >= outer.x_pct && inner.y_pct >= outer.y_pct &&
    inner.x_pct + inner.width_pct <= outer.x_pct + outer.width_pct &&
    inner.y_pct + inner.height_pct <= outer.y_pct + outer.height_pct);
}

function intersection(a: PctBox, b: PctBox): PctBox | null {
  const x = Math.max(a.x_pct, b.x_pct), y = Math.max(a.y_pct, b.y_pct);
  const w = Math.min(a.x_pct + a.width_pct, b.x_pct + b.width_pct) - x;
  const h = Math.min(a.y_pct + a.height_pct, b.y_pct + b.height_pct) - y;
  return w > 0 && h > 0 ? { x_pct: x, y_pct: y, width_pct: w, height_pct: h } : null;
}

function overlaps(a: PctBox, b: PctBox) { return intersection(a, b) !== null; }

function agreedBox(a: PctBox | null, b: PctBox | null) {
  if (!a || !b) return null;
  const common = intersection(a, b);
  if (!common) return null;
  const commonArea = common.width_pct * common.height_pct;
  const unionArea = a.width_pct * a.height_pct + b.width_pct * b.height_pct - commonArea;
  return commonArea / unionArea >= 0.65 ? common : null;
}

function series(value: unknown): ChartLayout["price_series_type"] {
  return value === "candles" || value === "price_line" || value === "unsupported" ? value : "unknown";
}

export function normaliseChartLayout(value: unknown, imageCount: number): ChartLayout {
  const raw = record(value);
  const candidate = normaliseScanBox(raw.price_plot_box);
  const plot = candidate && candidate.width_pct >= 20 && candidate.height_pct >= 12 ? candidate : null;
  const indicators = list(raw.indicators).slice(0, 10).flatMap((value, index): ChartRegion[] => {
    const item = record(value);
    const source = number(item.source_image);
    const name = scanText(item.name, 60);
    if (!name || source === null || !Number.isInteger(source) || source < 0 || source >= imageCount) return [];
    if (item.placement !== "panel" && item.placement !== "price_overlay") return [];
    const box = normaliseScanBox(item.box);
    return [{
      id: `indicator-${index + 1}`, name, source_image: source, placement: item.placement,
      readable: item.readable === true,
      box: source === 0 && item.placement === "price_overlay" && !boxInside(box, plot) ? null : box,
    }];
  });
  return {
    price_series_type: series(raw.price_series_type), price_plot_box: plot, indicators,
    exclusions: list(raw.exclusions).map(normaliseScanBox).filter((box): box is PctBox => box !== null).slice(0, 16),
  };
}

function signalBias(value: unknown): "bullish" | "bearish" | "neutral" {
  return value === "bullish" || value === "bearish" ? value : "neutral";
}

function verdict(value: unknown): ScanVerdict {
  return value === "bullish" || value === "bearish" ? value : "inconclusive";
}

const signalKinds = new Set<SignalKind>(["structure", "pattern", "candle", "level", "indicator", "volume"]);
const genericSignal = /^(candles?|candlesticks?|price\s*(line|chart|action|plot)|chart|volume|rsi|macd|moving averages?|bollinger bands?)$/i;

export function priceNumber(value: unknown): number | null {
  const price = scanText(value, 40)?.replace(/^[$£€¥]\s*/, "");
  if (!price || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(price)) return null;
  const n = Number(price.replace(/,/g, ""));
  return n > 0 && Number.isFinite(n) ? n : null;
}

export function normaliseChartScan(
  value: unknown,
  layout: ChartLayout,
  reviewed: boolean,
): ChartScanResult {
  const raw = record(value), overlay = record(raw.overlay), plan = record(raw.trade_plan), levels = record(raw.levels);
  const finalSeries = series(raw.price_series_type);
  const seriesAgrees = layout.price_series_type === finalSeries;
  const mustRetake = raw.retake_required === true || finalSeries === "unknown" || finalSeries === "unsupported";
  const plot = reviewed && seriesAgrees && overlay.price_plot_confirmed === true
    ? agreedBox(layout.price_plot_box, normaliseScanBox(overlay.price_plot_box)) : null;
  const checks = list(raw.indicator_checks).map(record);
  const indicatorChecks: ChartScanResult["indicator_checks"] = layout.indicators.map(region => {
    const check = checks.find(item => item.id === region.id);
    const finding = scanText(check?.finding, 240);
    const status = !reviewed ? "not_reviewed"
      : check?.status === "readable" && finding ? "readable"
        : check?.status === "not_confirmed" ? "not_confirmed" : "unreadable";
    return { id: region.id, name: region.name, source_image: region.source_image, status, finding: status === "readable" ? finding : null };
  });
  const seen = new Set<string>();
  const signals: ChartScanResult["signals"] = list(raw.signals).flatMap(value => {
    const item = record(value);
    const name = scanText(item.name, 80), evidence = scanText(item.evidence, 260);
    const kind = item.kind as SignalKind;
    const source = number(item.source_image);
    const regionId = scanText(item.region_id, 40);
    if (!name || !evidence || !signalKinds.has(kind) || genericSignal.test(name) || !regionId || source === null) return [];
    if (reviewed && item.supported !== true) return [];
    const region = layout.indicators.find(region => region.id === regionId && region.source_image === source);
    if (kind === "indicator" || kind === "volume") {
      if (!region || (reviewed && !indicatorChecks.some(check => check.id === region.id && check.status === "readable"))) return [];
    } else if (regionId !== "price" || source !== 0) return [];
    if (kind === "candle" && (finalSeries !== "candles" || layout.price_series_type !== "candles")) return [];
    const key = `${source}:${regionId}:${name.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const candidate = normaliseScanBox(item.box);
    // Separate indicator panels are legitimate evidence regions. Never draw a
    // supporting photo's coordinates over the primary screenshot.
    const owner = region?.placement === "panel" ? region.box : plot;
    const freeOfUI = candidate && !layout.exclusions.some(exclusion => overlaps(candidate, exclusion));
    const panelSafe = candidate && (region || !layout.indicators.some(indicator =>
      indicator.source_image === 0 && indicator.placement === "panel" && indicator.box && overlaps(candidate, indicator.box)));
    const safe = reviewed && source === 0 && item.localisation_confirmed === true &&
      confidence(item.localisation_confidence) >= 80 && boxInside(candidate, owner) && freeOfUI && panelSafe &&
      (!region || region.placement === "panel" || boxInside(candidate, region.box));
    return [{ name, evidence, kind, source_image: source, region_id: regionId,
      bias: signalBias(item.bias), confidence: confidence(item.confidence), box: safe ? candidate : null }];
  }).slice(0, 8);
  const rejectedEvidence = reviewed && !mustRetake && signals.length === 0;
  const resolvedVerdict = mustRetake || rejectedEvidence ? "inconclusive" : verdict(raw.verdict);
  const currentPrice = scanText(raw.current_price, 40);
  const coverage = raw.chart_coverage === "full" || raw.chart_coverage === "partial" ? raw.chart_coverage : "unclear";
  const needsMoreInfo = !mustRetake && raw.needs_more_info === true && coverage === "partial";
  const entry = priceNumber(plan.entry), stop = priceNumber(plan.stop_loss), target = priceNumber(plan.take_profit);
  const orderedPlan = entry !== null && stop !== null && target !== null &&
    (resolvedVerdict === "bullish" ? stop < entry && entry < target : resolvedVerdict === "bearish" && target < entry && entry < stop);
  const canPlan = reviewed && !mustRetake && !needsMoreInfo && priceNumber(currentPrice) !== null &&
    plan.price_scale_readable === true && orderedPlan && signals.length > 0;
  const timeframe = scanText(raw.timeframe, 24);
  const safeY = (value: unknown, level: unknown) => {
    const y = pct(value);
    if (!plot || y === null || priceNumber(level) === null || overlay.levels_confirmed !== true) return null;
    const line = { x_pct: plot.x_pct, y_pct: y - 0.15, width_pct: plot.width_pct, height_pct: 0.3 };
    return y > plot.y_pct + 1 && y < plot.y_pct + plot.height_pct - 1 &&
      !layout.exclusions.some(exclusion => overlaps(line, exclusion)) &&
      !layout.indicators.some(region => region.source_image === 0 && region.placement === "panel" && region.box && overlaps(line, region.box)) ? y : null;
  };
  return {
    verdict: resolvedVerdict,
    label: mustRetake ? "Chart not readable" : rejectedEvidence ? "No confirmed setup" : scanText(raw.label, 70) ?? "Mixed evidence",
    pattern: mustRetake ? "No reliable chart read" : rejectedEvidence ? "No supported pattern" : scanText(raw.pattern, 90) ?? "No clear pattern",
    confidence: mustRetake || rejectedEvidence ? 0 : confidence(raw.confidence),
    ticker: scanText(raw.ticker, 14)?.toUpperCase() ?? null, timeframe,
    current_price: currentPrice, price_series_type: finalSeries, chart_coverage: coverage,
    retake_required: mustRetake,
    retake_reason: mustRetake ? scanText(raw.retake_reason, 220) ?? "Include the actual price chart with readable candles or a price line." : null,
    needs_more_info: needsMoreInfo,
    more_info_prompt: needsMoreInfo ? scanText(raw.more_info_prompt, 220) ?? "Add a view of the missing chart area and price scale." : null,
    summary: rejectedEvidence ? "The proposed signals could not be confirmed from this image. No directional setup is supported by the reviewed evidence." : scanText(raw.summary, 480) ?? "There is not enough visible evidence for a reliable directional read.",
    confirmation: scanText(raw.confirmation, 260) ?? "Wait for a clear reaction at the visible structure.",
    invalidation: scanText(raw.invalidation, 260) ?? "A break against the visible structure would invalidate the setup.",
    watch_for: scanText(raw.watch_for, 220) ?? "Watch the next confirmed reaction at the nearest visible level.",
    observations: list(raw.observations).map(item => scanText(item, 200)).filter((item): item is string => item !== null).slice(0, 4),
    verification_status: reviewed ? "reviewed" : "unavailable",
    indicator_checks: indicatorChecks, signals: mustRetake ? [] : signals,
    trade_plan: {
      entry: canPlan ? scanText(plan.entry, 40) : null,
      stop_loss: canPlan ? scanText(plan.stop_loss, 40) : null,
      take_profit: canPlan ? scanText(plan.take_profit, 40) : null,
      risk_reward: canPlan ? `${(Math.abs(target! - entry!) / Math.abs(entry! - stop!)).toFixed(1)}:1` : null,
      projected_bars: canPlan && timeframe ? scanText(plan.projected_bars, 60) : null,
      projected_horizon: canPlan && timeframe ? scanText(plan.projected_horizon, 80) : null,
      plan: canPlan ? scanText(plan.plan, 320) : null,
      rationale: canPlan ? scanText(plan.rationale, 220) : null,
    },
    levels: {
      support: priceNumber(levels.support) !== null && !mustRetake ? scanText(levels.support, 40) : null,
      resistance: priceNumber(levels.resistance) !== null && !mustRetake ? scanText(levels.resistance, 40) : null,
      breakout: priceNumber(levels.breakout) !== null && !mustRetake ? scanText(levels.breakout, 40) : null,
      invalidation: priceNumber(levels.invalidation) !== null && !mustRetake ? scanText(levels.invalidation, 40) : null,
    },
    overlay: {
      price_plot_box: mustRetake ? null : plot,
      resistance_y_pct: mustRetake ? null : safeY(overlay.resistance_y_pct, levels.resistance),
      support_y_pct: mustRetake ? null : safeY(overlay.support_y_pct, levels.support),
      // Only evidence-specific highlights are displayed, never an extra speculative pattern rectangle.
      pattern_box: null,
    },
  };
}

export function parseScanJson(content: string): JsonRecord | null {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = stripped.indexOf("{"), end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(stripped.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
  } catch { return null; }
}

export function isChartAnalysis(value: JsonRecord | null) {
  return Boolean(value && ["bullish", "bearish", "inconclusive"].includes(String(value.verdict)) &&
    ["candles", "price_line", "unsupported", "unknown"].includes(String(value.price_series_type)) &&
    typeof value.summary === "string" && Array.isArray(value.signals) && Array.isArray(value.indicator_checks));
}

type ScanPass = { value: JsonRecord | null; model: string };
type ScanPasses = {
  locate: () => Promise<ScanPass>;
  analyse: (layout: ChartLayout) => Promise<ScanPass>;
  review: (layout: ChartLayout, candidate: JsonRecord) => Promise<ScanPass>;
};

export async function runGroundedChartScan(passes: ScanPasses, imageCount: number) {
  const located = await passes.locate();
  // Mapping may fail without making the whole image unreadable. An independent
  // analysis can still explain evidence, but localisation fails closed.
  const layout = normaliseChartLayout(located.value, imageCount);
  const candidate = await passes.analyse(layout);
  if (!candidate.value) return null;
  // The technical pass can find a panel the inventory missed. Give it an id
  // before the independent reviewer checks it, rather than discarding it.
  const additional = normaliseChartLayout({
    price_plot_box: layout.price_plot_box,
    indicators: candidate.value.additional_indicators,
  }, imageCount).indicators.map(region => ({ ...region, id: region.id.replace("indicator-", "analysis-indicator-") }));
  const enrichedLayout = { ...layout, indicators: [...layout.indicators, ...additional.filter(region =>
    !layout.indicators.some(existing => existing.name.toLowerCase() === region.name.toLowerCase() && existing.source_image === region.source_image))] };
  const review = await passes.review(enrichedLayout, candidate.value);
  const reviewed = review.value !== null;
  return {
    result: normaliseChartScan(review.value ?? candidate.value, enrichedLayout, reviewed),
    model: reviewed ? review.model : candidate.model,
    passes: 3,
  };
}
