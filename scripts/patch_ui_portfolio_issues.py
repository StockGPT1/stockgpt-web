from pathlib import Path


def patch_portfolio_alerts():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    if 'import { getStockChart } from "@/lib/yahoo";' not in text:
        text = text.replace(
            'import { createClient } from "@/utils/supabase/server";\n',
            'import { createClient } from "@/utils/supabase/server";\nimport { getStockChart } from "@/lib/yahoo";\n',
        )

    helpers = r'''
type TechnicalLevels = {
  support: number | null;
  resistance: number | null;
  swingLow: number | null;
  swingHigh: number | null;
  ma50: number | null;
  ma200: number | null;
  atrPct: number | null;
  source: "technical" | "fallback";
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function nearestBelow(values: number[], price: number) {
  const candidates = values.filter((value) => Number.isFinite(value) && value > 0 && value < price * 0.995);
  return candidates.length ? Math.max(...candidates) : null;
}

function nearestAbove(values: number[], price: number) {
  const candidates = values.filter((value) => Number.isFinite(value) && value > price * 1.005);
  return candidates.length ? Math.min(...candidates) : null;
}

function detectSwingLevels(closes: number[]) {
  const swingLows: number[] = [];
  const swingHighs: number[] = [];
  for (let i = 2; i < closes.length - 2; i++) {
    const value = closes[i];
    if (value < closes[i - 1] && value < closes[i - 2] && value <= closes[i + 1] && value <= closes[i + 2]) {
      swingLows.push(value);
    }
    if (value > closes[i - 1] && value > closes[i - 2] && value >= closes[i + 1] && value >= closes[i + 2]) {
      swingHighs.push(value);
    }
  }
  return { swingLows, swingHighs };
}

async function getTechnicalLevels(ticker: string, currentPrice: number): Promise<TechnicalLevels> {
  try {
    const chart = await getStockChart(ticker, ["6M", "1Y"]);
    const points = (chart["6M"] && chart["6M"]!.length >= 80) ? chart["6M"]! : (chart["1Y"] ?? []);
    const closes = points.map((point) => Number(point.close)).filter((price) => Number.isFinite(price) && price > 0);

    if (closes.length < 40) {
      return { support: null, resistance: null, swingLow: null, swingHigh: null, ma50: null, ma200: null, atrPct: null, source: "fallback" };
    }

    const recent = closes.slice(-126);
    const { swingLows, swingHighs } = detectSwingLevels(recent);
    const ma50 = average(closes.slice(-50));
    const ma200 = closes.length >= 200 ? average(closes.slice(-200)) : null;
    const recentWindow = closes.slice(-45);
    const recentAbsMoves = recentWindow.slice(1).map((price, index) => {
      const previous = recentWindow[index];
      return previous > 0 ? Math.abs((price - previous) / previous) : 0;
    });
    const atrPct = (average(recentAbsMoves) ?? 0.02) * 100;

    const structuralSupports = [
      ...swingLows,
      Math.min(...recent.slice(-63)),
      ...(ma50 && ma50 < currentPrice ? [ma50] : []),
      ...(ma200 && ma200 < currentPrice ? [ma200] : []),
    ];
    const structuralResistances = [
      ...swingHighs,
      Math.max(...recent.slice(-126)),
    ];

    return {
      support: nearestBelow(structuralSupports, currentPrice),
      resistance: nearestAbove(structuralResistances, currentPrice),
      swingLow: nearestBelow(swingLows, currentPrice),
      swingHigh: nearestAbove(swingHighs, currentPrice),
      ma50,
      ma200,
      atrPct,
      source: "technical",
    };
  } catch {
    return { support: null, resistance: null, swingLow: null, swingHigh: null, ma50: null, ma200: null, atrPct: null, source: "fallback" };
  }
}
'''

    if "type TechnicalLevels =" not in text:
        marker = "function buildDynamicTriggers"
        if marker not in text:
            raise SystemExit("buildDynamicTriggers not found for helper insertion")
        text = text.replace("\n" + marker, helpers + "\n" + marker, 1)

    new_function = r'''async function buildDynamicTriggers(p: {
  ticker: string; currentPrice: number; entryPrice: number;
  pnlPercent: number; currentAllocationPct: number;
  score: number; scoreAtEntry: number | null;
  sector: string | null; sectorMomentum: SectorMomentum;
  daysSinceReview: number; daysHeld: number;
  scorePercentile: number; rank: number | null; totalStocks: number;
}): Promise<HoldingTrigger[]> {
  const triggers: HoldingTrigger[] = [];
  const now = new Date();
  const technical = await getTechnicalLevels(p.ticker, p.currentPrice);

  const rankConviction = p.rank && p.totalStocks
    ? Math.max(0, Math.round(100 - ((p.rank - 1) / p.totalStocks) * 100))
    : p.scorePercentile;
  const conviction = rankConviction;

  const isElite = conviction >= 90;
  const isStrong = conviction >= 75;
  const isHealthy = conviction >= 55;
  const isWeak = conviction < 35;
  const isSmall = p.currentAllocationPct < 5;
  const isLarge = p.currentAllocationPct > 15;
  const isRecentlyAdded = p.daysHeld < RECENT_THRESHOLD_DAYS;

  const clampPct = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const priceAt = (price: number, pct: number) => price * (1 + pct / 100);
  const money = (price: number) => `$${price.toFixed(2)}`;
  const pctDistance = (price: number) => ((p.currentPrice - price) / p.currentPrice) * 100;

  const normalNoisePct = clampPct((technical.atrPct ?? 2.0) * 2.2, 4, 12);
  const rankBufferPct = isElite ? 2.2 : isStrong ? 1.8 : isHealthy ? 1.3 : 0.9;
  const maxFallbackStopPct = isElite ? 17 : isStrong ? 14 : isHealthy ? 11 : 7;
  const minFallbackStopPct = isElite ? 10 : isStrong ? 8 : isHealthy ? 6 : 4.5;
  const fallbackStopPct = clampPct(normalNoisePct + (isElite ? 4 : isStrong ? 2.5 : isHealthy ? 1 : 0), minFallbackStopPct, maxFallbackStopPct);

  const supportStop = technical.support && technical.support < p.currentPrice
    ? technical.support * (1 - rankBufferPct / 100)
    : null;
  const maStop = technical.ma50 && technical.ma50 < p.currentPrice
    ? technical.ma50 * (1 - Math.max(1.2, rankBufferPct - 0.5) / 100)
    : null;
  const fallbackStop = priceAt(p.currentPrice, -fallbackStopPct);

  const candidateStops = [supportStop, maStop, fallbackStop]
    .filter((price): price is number => Boolean(price && Number.isFinite(price) && price > 0 && price < p.currentPrice));

  let stopPrice = candidateStops.length ? Math.max(...candidateStops) : fallbackStop;
  const stopDistance = pctDistance(stopPrice);
  if (stopDistance < Math.max(3.5, normalNoisePct * 0.75)) stopPrice = fallbackStop;

  const resistanceTarget = technical.resistance && technical.resistance > p.currentPrice
    ? technical.resistance * 0.995
    : null;
  const recentRange = technical.support && technical.resistance
    ? Math.max(technical.resistance - technical.support, p.currentPrice * 0.08)
    : p.currentPrice * (isElite ? 0.28 : isStrong ? 0.20 : 0.14);
  const breakoutTarget = p.currentPrice + recentRange * (isElite ? 1.0 : isStrong ? 0.75 : 0.55);
  const takeProfitTarget = resistanceTarget && resistanceTarget > p.currentPrice * 1.03 ? resistanceTarget : breakoutTarget;
  const targetPct = ((takeProfitTarget - p.currentPrice) / p.currentPrice) * 100;

  const structureLabel = technical.source === "technical"
    ? technical.support
      ? `below support around ${money(technical.support)}`
      : technical.ma50
        ? `below the 50-day area around ${money(technical.ma50)}`
        : "using volatility fallback because no clean support was found"
    : "using percentage fallback because chart structure was unavailable";

  if (isWeak || (p.rank && p.totalStocks && p.rank > p.totalStocks * 0.85)) {
    const weakStop = technical.support && technical.support < p.currentPrice
      ? Math.max(technical.support * 0.995, priceAt(p.currentPrice, -6))
      : priceAt(p.currentPrice, -5);
    const reliefTarget = resistanceTarget && resistanceTarget > p.currentPrice
      ? resistanceTarget
      : (p.pnlPercent < 0 ? Math.min(p.entryPrice, priceAt(p.currentPrice, 8)) : priceAt(p.currentPrice, 6));

    triggers.push({
      type: "exit_all", icon: "exit", tone: "negative", priority: 1,
      condition: `${p.ticker} is low conviction (rank #${p.rank ?? "—"}, bottom ${Math.max(1, 100 - conviction)}%)`,
      action: `Rotate out unless the AI rank recovers above the top 50%. For weak stocks, technical targets are exit zones, not reasons to hope.`,
    });
    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 2,
      condition: `If ${p.ticker} breaks ${money(weakStop)} (${technical.support ? "below support" : "tight risk stop"})`,
      action: `Sell. Weak AI rank plus a support break is not worth defending.`,
    });
    triggers.push({
      type: "take_profit", icon: "target", tone: "neutral", priority: 3,
      condition: `If ${p.ticker} rebounds toward ${money(reliefTarget)}`,
      action: `Use the bounce to exit or cut heavily. This is a relief target near resistance, not a high-conviction upside target.`,
    });
    return triggers;
  }

  const stopType = p.pnlPercent >= 20 ? "trailing_stop" : "stop_sell";
  triggers.push({
    type: stopType, icon: "shield", tone: "negative", priority: 1,
    condition: `If ${p.ticker} breaks ${money(stopPrice)} (${structureLabel})`,
    action: isElite
      ? `Elite rank gets room, but a support break is meaningful. Hold above structure; reassess hard if it closes below this level.`
      : isStrong
        ? `Strong rank justifies patience, but not below support. Cut or trim if this level breaks and rank weakens.`
        : `Respect the support break. Average-ranked positions should not be protected emotionally.`,
  });

  triggers.push({
    type: "take_profit", icon: "target", tone: "positive", priority: 2,
    condition: `If ${p.ticker} approaches ${money(takeProfitTarget)} (${resistanceTarget ? "prior resistance" : `breakout extension, +${targetPct.toFixed(0)}%`})`,
    action: isElite
      ? `Do not fully sell an elite-ranked stock at first resistance. Trim only 10–20% if oversized; otherwise hold core and trail below support.`
      : isStrong
        ? `Take partial profit around resistance, usually 20–30%, and keep the rest while rank remains top quartile.`
        : isLarge
          ? `Trim 25–40% near resistance. Average conviction plus large size deserves profit protection.`
          : `Trim 20–33% near resistance and let the rest run only if it breaks out cleanly.`,
  });

  if (p.scoreAtEntry) {
    const thresholdMultiplier = isElite ? 0.78 : isStrong ? 0.75 : 0.70;
    const threshold = Math.round(p.scoreAtEntry * thresholdMultiplier);
    triggers.push({
      type: "score_alert", icon: "warning", tone: "neutral", priority: 3,
      condition: `If AI score drops below ${threshold.toLocaleString()} (currently ${p.score.toLocaleString()})`,
      action: isSmall
        ? `Sell the whole position. A small holding is not worth managing through a broken thesis.`
        : `Cut 33–50%. Technical levels matter, but AI-score deterioration is the thesis break.`,
    });
  }

  if (!isRecentlyAdded) {
    const reviewIn = Math.max(0, 90 - p.daysSinceReview);
    const reviewDate = new Date(now);
    reviewDate.setDate(now.getDate() + reviewIn);
    triggers.push({
      type: "review", icon: "calendar", tone: "neutral", priority: 4,
      condition: reviewIn <= 0 ? "Review overdue" : `Review on ${reviewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      action: reviewIn <= 0 ? "Open stock page now and reassess support, resistance, AI rank, and news." : "Quarterly check: update support/resistance and confirm the AI rank still supports the plan.",
    });
  }

  return triggers.sort((a, b) => a.priority - b.priority);
}
'''

    start = text.find("function buildDynamicTriggers")
    end = text.find("\n// ✦ Much smarter, situation-aware AI summary", start)
    if start == -1 or end == -1:
        raise SystemExit("Could not locate exact buildDynamicTriggers block")

    text = text[:start] + new_function + text[end:]

    text = text.replace("const triggers = buildDynamicTriggers({", "const triggers = await buildDynamicTriggers({")

    if "return holdings.map((" in text:
        text = text.replace("return holdings.map((holding) => {", "return await Promise.all(holdings.map(async (holding) => {", 1)
        tail = "\n  });\n}"
        idx = text.rfind(tail)
        if idx != -1:
            text = text[:idx] + "\n  }));\n}" + text[idx + len(tail):]

    if "async function buildDynamicTriggers" not in text or "await getTechnicalLevels" not in text:
        raise SystemExit("Technical trigger replacement failed")

    path.write_text(text)


patch_portfolio_alerts()
print("Force-replaced portfolio trigger function with support/resistance-aware logic.")
