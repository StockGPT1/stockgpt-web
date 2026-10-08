export type PriceAxis = {
  scale: "linear" | "log" | "unknown";
  ticks: Array<{ price: number; y_pct: number }>;
};
export type PriceCalibration = { scale: "linear" | "log"; slope: number; intercept: number; min: number; max: number };
export type ChartPattern = {
  name: string;
  status: "forming" | "confirmed";
  evidence: string;
  neckline: number | null;
  extreme_1: number | null;
  extreme_2: number | null;
};
export type TradeScenario = {
  side: "long" | "short";
  status: "confirmed" | "conditional" | "estimated" | "relative" | "unavailable";
  entry: string | null;
  stop_loss: string | null;
  take_profit: string | null;
  entry_value: number | null;
  stop_value: number | null;
  target_value: number | null;
  stop_pct: number | null;
  target_pct: number | null;
  risk_reward: string | null;
  price_basis: "image" | "user" | "relative";
  levels_basis: "structure" | "estimated" | "illustrative";
  assumptions: string | null;
  projected_bars: string | null;
  projected_horizon: string | null;
  plan: string | null;
  rationale: string | null;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max = 280) {
  return typeof value === "string" && value.trim() && !/^(null|unknown|n\/a|none)$/i.test(value.trim()) ? value.trim().slice(0, max) : null;
}
export function positivePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const cleaned = text(value, 40)?.replace(/^[$£€¥]\s*/, "");
  if (!cleaned || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned.replace(/,/g, ""));
  return n > 0 && Number.isFinite(n) ? n : null;
}
function finite(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function boundedScore(value: unknown) { return Math.max(0, Math.min(100, finite(value) ?? 0)); }

export function normalisePriceAxis(value: unknown): PriceAxis {
  const raw = object(value), usedPrices = new Set<number>();
  const ticks = (Array.isArray(raw.ticks) ? raw.ticks : []).slice(0, 12).flatMap(value => {
    const item = object(value), price = positivePrice(item.price), y = finite(item.y_pct);
    if (price === null || y === null || y < 0 || y > 100 || usedPrices.has(price)) return [];
    usedPrices.add(price);
    return [{ price, y_pct: y }];
  });
  return { scale: raw.scale === "linear" || raw.scale === "log" ? raw.scale : "unknown", ticks };
}

export function calibratePriceAxis(mapped: PriceAxis, checked: PriceAxis): PriceCalibration | null {
  // Read the same actual axis labels twice. Ignore model-suggested level Y's.
  const common = mapped.ticks.flatMap(tick => {
    const other = checked.ticks.find(item => Math.abs(item.price - tick.price) <= tick.price * 1e-8);
    return other && Math.abs(other.y_pct - tick.y_pct) <= 0.6 ? [{ price: tick.price, y: (tick.y_pct + other.y_pct) / 2 }] : [];
  });
  if (common.length < 3 || Math.max(...common.map(p => p.y)) - Math.min(...common.map(p => p.y)) < 8) return null;
  if (mapped.scale !== "unknown" && checked.scale !== "unknown" && mapped.scale !== checked.scale) return null;
  const known = checked.scale !== "unknown" ? checked.scale : mapped.scale;
  const fits = (["linear", "log"] as const).filter(scale => known === "unknown" || scale === known).map(scale => {
    const points = common.map(p => ({ x: scale === "log" ? Math.log(p.price) : p.price, y: p.y }));
    const mx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const my = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0);
    if (variance <= 0) return null;
    const slope = points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / variance;
    const intercept = my - slope * mx;
    const residual = Math.max(...points.map(p => Math.abs(slope * p.x + intercept - p.y)));
    if (!Number.isFinite(slope) || slope === 0 || residual > 0.3) return null;
    return { scale, slope, intercept, residual, min: Math.min(...common.map(p => p.price)), max: Math.max(...common.map(p => p.price)) };
  }).filter((fit): fit is NonNullable<typeof fit> => fit !== null).sort((a, b) => a.residual - b.residual);
  return fits[0] ?? null;
}

export function priceToY(price: number | null, calibration: PriceCalibration | null, top: number, height: number) {
  if (!calibration || price === null || price <= 0) return null;
  const value = calibration.scale === "log" ? Math.log(price) : price;
  const y = calibration.slope * value + calibration.intercept;
  const bottom = top + height;
  // A small extrapolation into the plot margin is fine; drawing outside it isn't.
  // A fitted tick exactly on an edge can land a few trillionths beyond it.
  // Tolerate only numerical rounding, never move an off-chart price into view.
  const roundingTolerance = 1e-9;
  return Number.isFinite(y) && y >= top - roundingTolerance && y <= bottom + roundingTolerance
    ? Math.max(top, Math.min(bottom, y)) : null;
}

export function normalisePatternChecks(value: unknown): ChartPattern[] {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : []).flatMap(value => {
    const item = object(value), name = text(item.name, 70), evidence = text(item.evidence, 240);
    if (!name || !evidence || (item.status !== "forming" && item.status !== "confirmed") || seen.has(name.toLowerCase())) return [];
    const neckline = positivePrice(item.neckline), first = positivePrice(item.extreme_1), second = positivePrice(item.extreme_2);
    // A pair of lows without a rebound/neckline is not a W reversal. Likewise for M tops.
    if (/double[ -]?bottom/i.test(name) || /double[ -]?top/i.test(name)) {
      if (item.two_swings_visible !== true || item.intervening_swing_visible !== true) return [];
      if (neckline !== null && first !== null && second !== null &&
        (/bottom/i.test(name) ? neckline <= Math.max(first, second) : neckline >= Math.min(first, second))) return [];
    }
    seen.add(name.toLowerCase());
    const status = item.status === "confirmed" && item.breakout_confirmed === true ? "confirmed" as const : "forming" as const;
    return [{ name, status, evidence, neckline, extreme_1: first, extreme_2: second }];
  }).slice(0, 6);
}

function priceLabel(price: number, sample: unknown, extraPrecision = 0) {
  const template = text(sample, 40) ?? "";
  const currency = template.match(/^[$£€¥]/)?.[0] ?? "";
  const decimalPlaces = template.replace(/,/g, "").split(".")[1]?.length ?? 0;
  const smallPricePrecision = price < 1 ? Math.ceil(-Math.log10(price)) + 3 : 2;
  const precision = Math.min(12, Math.max(decimalPlaces, smallPricePrecision, extraPrecision));
  return currency + price.toLocaleString("en-US", { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

export function buildTradeScenario(
  raw: Record<string, unknown>,
  context: {
    usable: boolean; reviewed: boolean; referencePrice?: number | null;
    patterns: ChartPattern[];
    signals: Array<{ bias: string; confidence: number }>;
  },
): TradeScenario {
  const plan = object(raw.trade_plan), levels = object(raw.levels);
  const weight = context.signals.reduce((sum, signal) => sum + (signal.bias === "bullish" ? 1 : signal.bias === "bearish" ? -1 : 0) * signal.confidence, 0);
  const candidatePattern = context.patterns.find(pattern => /double[ -]?(bottom|top)/i.test(pattern.name));
  const side = plan.side === "long" || plan.side === "short" ? plan.side
    : raw.verdict === "bullish" ? "long" : raw.verdict === "bearish" ? "short"
      : candidatePattern ? /bottom/i.test(candidatePattern.name) ? "long" : "short" : weight < 0 ? "short" : "long";
  const preferredPattern = context.patterns.find(pattern => side === "long" ? /double[ -]?bottom/i.test(pattern.name) : /double[ -]?top/i.test(pattern.name));
  const direction = side === "long" ? 1 : -1;
  const imagePrice = positivePrice(raw.current_price);
  const reference = imagePrice ?? context.referencePrice ?? null;
  const readableAnchor = plan.price_scale_readable === true || imagePrice !== null || context.referencePrice != null;
  const proposedEntry = readableAnchor ? positivePrice(plan.entry) : null;
  const entry = proposedEntry ?? preferredPattern?.neckline ?? reference;
  const priceBasis = plan.price_basis === "user" && context.referencePrice ? "user" : proposedEntry !== null || imagePrice !== null || preferredPattern?.neckline ? "image" : context.referencePrice ? "user" : "relative";
  const modelStop = readableAnchor ? positivePrice(plan.stop_loss) : null, modelTarget = readableAnchor ? positivePrice(plan.take_profit) : null;
  const validStop = entry !== null && modelStop !== null && (entry - modelStop) * direction > 0;
  const validTarget = entry !== null && modelTarget !== null && (modelTarget - entry) * direction > 0;
  const empty: TradeScenario = {
    side, status: "unavailable", entry: null, stop_loss: null, take_profit: null,
    entry_value: null, stop_value: null, target_value: null, stop_pct: null, target_pct: null,
    risk_reward: null, price_basis: "relative", levels_basis: "illustrative", assumptions: null,
    projected_bars: null, projected_horizon: null, plan: null, rationale: null,
  };
  if (!context.usable) return empty;
  const noDirectionalEvidence = context.signals.every(signal => signal.bias === "neutral") && !preferredPattern && raw.verdict !== "bullish" && raw.verdict !== "bearish";
  const sample = proposedEntry !== null ? plan.entry : imagePrice !== null ? raw.current_price : entry;
  if (entry === null) {
    return { ...empty, status: "relative", entry: "On entry confirmation",
      stop_loss: `${side === "long" ? "−" : "+"}2% from entry`, take_profit: `${side === "long" ? "+" : "−"}4% from entry`,
      stop_pct: 2, target_pct: 4, risk_reward: "2.0:1", price_basis: "relative",
      assumptions: "Illustrative 2% risk / 4% reward distances. The image has no readable reference price; these are not chart-derived price levels.",
      plan: text(plan.plan) ?? text(raw.confirmation) ?? "Use this scenario only after the entry condition is confirmed.",
    };
  }
  const structureStop = [positivePrice(levels.invalidation),
    side === "long" ? positivePrice(levels.support) : positivePrice(levels.resistance),
    preferredPattern?.extreme_2 ?? null].find(price => price !== null && (entry - price) * direction > 0);
  const stop = validStop ? modelStop! : structureStop != null
    ? structureStop - direction * entry * 0.001 : entry * (1 - direction * 0.02);
  const risk = Math.abs(entry - stop);
  const structuralTarget = side === "long" ? positivePrice(levels.resistance) : positivePrice(levels.support);
  const measuredTarget = preferredPattern?.neckline != null && preferredPattern.extreme_2 != null
    ? preferredPattern.neckline + direction * Math.abs(preferredPattern.neckline - preferredPattern.extreme_2) : null;
  const target = validTarget ? modelTarget! : [measuredTarget, structuralTarget].find(price =>
    price !== null && (price - entry) * direction > 0) ?? entry + direction * risk * 2;
  // Positive-price instruments cannot have zero/negative targets or stops.
  if (!Number.isFinite(stop) || !Number.isFinite(target) || stop <= 0 || target <= 0 || risk <= 0) return {
    ...empty, status: "relative", entry: priceLabel(entry, sample),
    stop_loss: `${side === "long" ? "−" : "+"}2% from entry`, take_profit: `${side === "long" ? "+" : "−"}4% from entry`,
    stop_pct: 2, target_pct: 4, risk_reward: "2.0:1",
    assumptions: "The supplied structure gives invalid price levels. These are illustrative percentage distances instead.",
    plan: text(raw.confirmation) ?? "Wait for an entry confirmation.",
  };
  const completeModelPlan = validStop && validTarget && plan.levels_basis !== "illustrative";
  const levelsBasis = noDirectionalEvidence ? "illustrative" : completeModelPlan && plan.levels_basis !== "estimated" && priceBasis !== "user" ? "structure" : "estimated";
  const displayPrecision = Math.min(12, Math.max(2, Math.ceil(-Math.log10(Math.min(risk, Math.abs(target - entry)))) + 2));
  const entryLabel = priceLabel(entry, sample, displayPrecision), stopLabel = priceLabel(stop, sample, displayPrecision), targetLabel = priceLabel(target, sample, displayPrecision);
  const displayedEntry = positivePrice(entryLabel)!, displayedStop = positivePrice(stopLabel)!, displayedTarget = positivePrice(targetLabel)!;
  const displayedRisk = Math.abs(displayedEntry - displayedStop);
  const status = levelsBasis !== "structure" || !context.reviewed ? "estimated"
    : plan.activation === "confirmed" && raw.verdict !== "inconclusive" && (!preferredPattern || preferredPattern.status === "confirmed") ? "confirmed" : "conditional";
  const genericRisk = !validStop && structureStop == null;
  const genericTarget = !validTarget && measuredTarget == null && (structuralTarget === null || (structuralTarget - entry) * direction <= 0);
  const assumptions = levelsBasis === "illustrative"
    ? "No directional edge is confirmed. This is an illustrative scenario, not a detected trade signal."
    : genericRisk || genericTarget ? `Estimated fallback: ${genericRisk ? "a fixed 2% entry-to-stop distance" : "stop based on visible invalidation"}${genericTarget ? " and a 2R target" : ", with a visible target"}. These estimates are not volatility-calibrated.`
      : levelsBasis === "estimated" ? "One or more levels are estimated from visible structure and need confirmation." : null;
  return {
    side, status, entry: entryLabel, stop_loss: stopLabel, take_profit: targetLabel,
    entry_value: displayedEntry, stop_value: displayedStop, target_value: displayedTarget,
    stop_pct: displayedRisk / displayedEntry * 100, target_pct: Math.abs(displayedTarget - displayedEntry) / displayedEntry * 100,
    risk_reward: `${(Math.abs(displayedTarget - displayedEntry) / displayedRisk).toFixed(1)}:1`, price_basis: priceBasis, levels_basis: levelsBasis,
    assumptions,
    projected_bars: text(raw.timeframe) ? text(plan.projected_bars, 60) : null,
    projected_horizon: text(raw.timeframe) ? text(plan.projected_horizon, 80) : null,
    plan: preferredPattern?.status === "forming"
      ? `Wait for a candle to close ${side === "long" ? "above" : "below"} the ${priceLabel(preferredPattern.neckline ?? entry, sample, displayPrecision)} neckline (the level between the two swings) before entering. The pattern is still forming.`
      : text(plan.plan) ?? text(raw.confirmation) ?? `Wait for a candle to close ${side === "long" ? "above" : "below"} ${entryLabel} before considering this ${side} scenario.`,
    rationale: text(plan.rationale),
  };
}

export function stockGPTScore(
  rawConfidence: unknown,
  plan: TradeScenario,
  reviewed: boolean,
  signals: Array<{ bias: string; confidence: number; kind?: string; name?: string; region_id?: string }>,
  patterns: ChartPattern[],
) {
  if (plan.status === "unavailable") return { value: 0, label: "No chart read", reasons: ["A readable chart is required."] };
  const matching = signals.filter(signal => signal.bias === (plan.side === "long" ? "bullish" : "bearish"));
  const opposing = signals.filter(signal => signal.bias === (plan.side === "long" ? "bearish" : "bullish"));
  const family = (signal: typeof signals[number]) => {
    if (signal.kind === "volume" || /volume/i.test(signal.name ?? "")) return "volume";
    if (["structure", "pattern", "candle", "level"].includes(signal.kind ?? "")) return "price";
    if (/rsi|macd|stoch|momentum/i.test(signal.name ?? "")) return "momentum";
    if (/moving.average|\b[es]ma\b|vwap|ichimoku/i.test(signal.name ?? "")) return "trend";
    if (/bollinger|band|\batr\b|volatility/i.test(signal.name ?? "")) return "volatility";
    return signal.region_id ?? "unclassified";
  };
  const supportingFamilies = new Set(matching.map(family)).size;
  const opposingFamilies = new Set(opposing.map(family)).size;
  let value = boundedScore(rawConfidence) * 0.6 + Math.min(22, supportingFamilies * 7) - opposingFamilies * 8;
  value += plan.levels_basis === "structure" ? 10 : -8;
  value += patterns.some(pattern => pattern.status === "confirmed") ? 8 : 0;
  value -= plan.status === "conditional" ? 5 : 0;
  if (!reviewed) value = Math.min(40, value - 15);
  if (plan.levels_basis === "illustrative" || plan.price_basis === "relative") value = Math.min(20, value);
  if (Number.parseFloat(plan.risk_reward ?? "0") < 1) value -= 10;
  if (plan.status === "estimated") value = Math.min(60, value);
  if (matching.length === 0) value = Math.min(35, value);
  if (supportingFamilies < 2) value = Math.min(70, value);
  const score = Math.round(Math.max(5, Math.min(95, value)));
  const reasons = [
    matching.length ? `${matching.length} supporting finding${matching.length === 1 ? "" : "s"}` : "No supporting directional finding",
    ...(matching.length ? [`${supportingFamilies} evidence ${supportingFamilies === 1 ? "family" : "families"}; related clues count together`] : []),
    ...(opposing.length ? [`${opposing.length} opposing finding${opposing.length === 1 ? "" : "s"}`] : []),
    ...(plan.status === "conditional" ? ["Entry confirmation still needed"] : []),
    ...(plan.levels_basis !== "structure" ? ["Risk levels include estimates"] : []),
    ...(!reviewed ? ["Independent review incomplete"] : []),
    ...(plan.price_basis === "relative" ? ["Reference price unreadable"] : []),
  ];
  return { value: score, label: score >= 75 ? "Stronger setup" : score >= 50 ? "Developing setup" : "Speculative setup", reasons };
}
