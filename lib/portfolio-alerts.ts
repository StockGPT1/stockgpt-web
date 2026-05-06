import { createClient } from "@/utils/supabase/server";
import { getStockChart } from "@/lib/yahoo";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertType =
  | "score_drop" | "score_rise" | "rank_drop" | "rank_rise"
  | "price_target" | "price_stop" | "review_due"
  | "negative_news" | "positive_news"
  | "sector_weak" | "sector_strong"
  | "position_oversize" | "position_tiny"
  | "poor_signal" | "weak_rank";

export type HoldingAlert = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
};

export type SectorMomentum = "Booming" | "Strong" | "Mixed" | "Weak" | "Struggling" | "Unknown";

export type RiskTolerance = "conservative" | "moderate" | "aggressive" | null;

export type EnrichedHolding = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number;
  maxScore: number;
  currentPrice: number;
  entryPrice: number;
  shares: number;
  costBasis: number;
  currentValue: number;
  totalPnLDollars: number;
  currentAllocationPct: number;
  targetAllocationPct: number | null;
  scoreAtEntry: number | null;
  rankAtEntry: number | null;
  addedAt: string;
  lastReviewedAt: string;
  daysHeld: number;
  pnlDollars: number;
  pnlPercent: number;
  scoreChange: number;
  rankChange: number;
  daysSinceReview: number;
  alerts: HoldingAlert[];
  recommendation: "Hold" | "Consider Buying More" | "Consider Trimming" | "Strong Hold" | "Review Urgently" | "Sell Whole Position" | "Sell Immediately";
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  scorePercentile: number;
  rankPercentile: number; // 0-100, where 100 is rank #1
  triggers: HoldingTrigger[];
  aiSummary: string;
  isRecentlyAdded: boolean;
};

export type HoldingTrigger = {
  type: "stop_sell" | "take_profit" | "trailing_stop" | "score_alert" | "review" | "rebalance" | "exit_all";
  icon: "shield" | "target" | "warning" | "calendar" | "scales" | "exit";
  condition: string;
  action: string;
  tone: "positive" | "negative" | "neutral";
  priority: number;
};

const RECENT_THRESHOLD_DAYS = 7;

async function getSectorData() {
  const supabase = await createClient();

  const { data: allStocks } = await supabase
    .from("stock_rankings").select("sector, rank, score");

  const totalStocks = (allStocks ?? []).length || 500;
  const topQuartileRank = Math.max(1, Math.ceil(totalStocks * 0.25));
  const topHalfRank = Math.max(1, Math.ceil(totalStocks * 0.50));
  const maxScore = Math.max(...(allStocks ?? []).map((s) => Number(s.score) || 0), 1);

  const bySector: Record<string, { total: number; bullish: number; healthy: number }> = {};
  (allStocks ?? []).forEach((s) => {
    const sector = s.sector ?? "—";
    const rank = Number(s.rank);
    if (!bySector[sector]) bySector[sector] = { total: 0, bullish: 0, healthy: 0 };
    bySector[sector].total++;
    if (Number.isFinite(rank) && rank > 0 && rank <= topQuartileRank) bySector[sector].bullish++;
    if (Number.isFinite(rank) && rank > 0 && rank <= topHalfRank) bySector[sector].healthy++;
  });

  const momentum: Record<string, SectorMomentum> = {};
  const bullishPct: Record<string, number> = {};
  Object.entries(bySector).forEach(([sector, { total, bullish, healthy }]) => {
    const pct = total > 0 ? Math.round((bullish / total) * 100) : 0;
    const healthyPct = total > 0 ? Math.round((healthy / total) * 100) : 0;
    bullishPct[sector] = pct;
    if (pct >= 35) momentum[sector] = "Booming";
    else if (pct >= 25) momentum[sector] = "Strong";
    else if (healthyPct >= 45) momentum[sector] = "Mixed";
    else if (healthyPct >= 30) momentum[sector] = "Weak";
    else momentum[sector] = "Struggling";
  });
  return { momentum, bullishPct, maxScore, totalStocks };
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Risk-aware concentration thresholds ──
function concentrationThreshold(risk: RiskTolerance): number {
  if (risk === "conservative") return 18;
  if (risk === "aggressive") return 32;
  return 25;
}

function buildAlerts(p: {
  ticker: string; scoreChange: number; pnlPercent: number; daysSinceReview: number;
  scoreAtEntry: number | null; score: number; rank: number | null; rankAtEntry: number | null;
  recentNegativeNewsCount: number; recentPositiveNewsCount: number;
  sectorMomentum: SectorMomentum; sectorBullishPct: number;
  sector: string | null; currentPrice: number; entryPrice: number;
  currentAllocationPct: number; targetAllocationPct: number | null;
  scorePercentile: number; rankPercentile: number;
  daysHeld: number; riskTolerance: RiskTolerance; totalStocks: number;
}): HoldingAlert[] {
  const alerts: HoldingAlert[] = [];
  const isRecentlyAdded = p.daysHeld < RECENT_THRESHOLD_DAYS;
  const isSmallPosition = p.currentAllocationPct < 5;

  // ══════════════════════════════════════════════════════
  // 1. ABSOLUTE TERRIBLE SIGNAL — overrides everything else
  // ══════════════════════════════════════════════════════
  if (p.scorePercentile < 25) {
    alerts.push({
      type: "poor_signal", severity: "critical",
      title: `${p.ticker} has a poor AI signal — bottom ${p.scorePercentile}% of stocks`,
      message: `Score of ${p.score.toLocaleString()} is well below the threshold for a healthy hold. Hundreds of stocks are scoring better right now.`,
      recommendation: `Sell at the next opportunity. Don't wait for a price target — better-rated stocks exist to redeploy into.`,
    });
    // Don't bother with other alerts — this is the dominant signal
    if (p.daysHeld >= RECENT_THRESHOLD_DAYS && p.daysSinceReview >= 90) {
      alerts.push({
        type: "review_due", severity: "info",
        title: `${p.ticker} hasn't been reviewed in ${p.daysSinceReview} days`,
        message: "Quarterly review overdue.",
        recommendation: "Open the stock page and decide.",
      });
    }
    return alerts;
  }

  if (p.rank && p.totalStocks && p.rank > p.totalStocks * 0.85) {
    alerts.push({
      type: "weak_rank", severity: "warning",
      title: `${p.ticker} ranks #${p.rank} of ${p.totalStocks} — bottom 15%`,
      message: `Most stocks are scoring better than ${p.ticker} right now.`,
      recommendation: `Consider rotating to a higher-ranked stock with better AI conviction.`,
    });
  }

  // ══════════════════════════════════════════════════════
  // 2. GRACE PERIOD — skip noise for recently added holdings
  // ══════════════════════════════════════════════════════
  if (isRecentlyAdded) {
    // For new holdings, only show the most extreme signals.
    // Skip sector weakness, news clusters, position drift — these need time.
    if (p.scoreAtEntry && p.scoreAtEntry > 0) {
      const dropPct = (p.scoreChange / p.scoreAtEntry) * 100;
      if (dropPct <= -25) {
        alerts.push({
          type: "score_drop", severity: "critical",
          title: `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. Major model shift.`,
          recommendation: `Sell. The thesis broke before you even got going.`,
        });
      }
    }
    return alerts; // grace period — no other alerts
  }

  // ══════════════════════════════════════════════════════
  // 3. NORMAL ALERTS (only after grace period)
  // ══════════════════════════════════════════════════════

  // Score drop
  if (p.scoreAtEntry && p.scoreAtEntry > 0) {
    const dropPct = (p.scoreChange / p.scoreAtEntry) * 100;
    if (dropPct <= -25) {
      alerts.push({
        type: "score_drop", severity: "critical",
        title: `${p.ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `Score dropped from ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()} since you bought.`,
        recommendation: isSmallPosition
          ? `Sell the entire ${p.currentAllocationPct.toFixed(1)}% position. Don't manage a small loser.`
          : `Sell at least half. The AI's view has fundamentally shifted.`,
      });
    } else if (dropPct <= -12) {
      alerts.push({
        type: "score_drop", severity: "warning",
        title: `${p.ticker} AI score weakened ${Math.abs(Math.round(dropPct))}%`,
        message: `From ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()}. Conviction is fading.`,
        recommendation: isSmallPosition
          ? `Consider exiting the whole position. Small holdings aren't worth the babysitting.`
          : `Don't add more. If score drops another 10%, sell at least half.`,
      });
    } else if (dropPct >= 12) {
      alerts.push({
        type: "score_rise", severity: "success",
        title: `${p.ticker} AI conviction is rising — up ${Math.round(dropPct)}%`,
        message: `From ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()}. The AI is more confident.`,
        recommendation: isSmallPosition
          ? `Build this up to 8–12% of portfolio. Add on dips.`
          : `Hold. If price dips 5–8%, that's a buy-more opportunity.`,
      });
    }
  }

  // Rank changes
  if (p.rank && p.rankAtEntry) {
    const rankShift = p.rankAtEntry - p.rank;
    if (rankShift <= -50) {
      alerts.push({
        type: "rank_drop", severity: "warning",
        title: `${p.ticker} fell ${Math.abs(rankShift)} places in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. Other stocks are now scoring better.`,
        recommendation: isSmallPosition
          ? `Sell and rotate the cash into a top-50 ranked stock instead.`
          : `Compare with sector peers. If alternatives are stronger, rotate.`,
      });
    } else if (rankShift >= 30) {
      alerts.push({
        type: "rank_rise", severity: "success",
        title: `${p.ticker} climbed ${rankShift} places in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. Strong outperformance.`,
        recommendation: `Hold the winner. Don't take profits early — this is what compounds wealth.`,
      });
    }
  }

  // News
  if (p.recentNegativeNewsCount >= 3) {
    alerts.push({
      type: "negative_news", severity: "warning",
      title: `${p.recentNegativeNewsCount} negative articles in 14 days`,
      message: `When negative coverage stacks like this, the market often follows.`,
      recommendation: isSmallPosition
        ? `Sell. Small positions don't justify the risk of being wrong on a story.`
        : `Read the news section. Earnings/fundamentals concerns → sell. Just noise → hold.`,
    });
  } else if (p.recentPositiveNewsCount >= 4) {
    alerts.push({
      type: "positive_news", severity: "success",
      title: `${p.ticker} has ${p.recentPositiveNewsCount} positive articles recently`,
      message: `Strong narrative — typically supports the share price.`,
      recommendation: `Hold and watch. If AI score also rises, consider adding.`,
    });
  }

  // Sector momentum (only in mature positions)
  if (p.sectorMomentum === "Struggling" && p.scoreChange < 0) {
    alerts.push({
      type: "sector_weak", severity: "warning",
      title: `${p.sector ?? "Sector"} is struggling — only ${p.sectorBullishPct}% bullish`,
      message: `Most ${p.sector ?? "sector"} stocks are underperforming. ${p.ticker} is fighting headwinds.`,
      recommendation: isSmallPosition
        ? `Cut the position. Re-deploy into a "Booming" sector.`
        : `Consider rotating to stronger sectors like Tech or Communication Services.`,
    });
  } else if (p.sectorMomentum === "Booming") {
    alerts.push({
      type: "sector_strong", severity: "success",
      title: `${p.sector ?? "Sector"} is booming — ${p.sectorBullishPct}% bullish`,
      message: `Strong sector tailwind for ${p.ticker}.`,
      recommendation: isSmallPosition
        ? `Build this up while sector momentum is strong.`
        : `Hold or add — sector momentum is real edge.`,
    });
  }

  // ✦ RISK-AWARE concentration check — only flag if drift is significant
  const threshold = concentrationThreshold(p.riskTolerance);
  if (p.currentAllocationPct > threshold) {
    const driftFromTarget = p.targetAllocationPct
      ? p.currentAllocationPct - p.targetAllocationPct
      : 0;

    // Only flag if it's drifted significantly above target (or no target set)
    const significantDrift = p.targetAllocationPct == null || driftFromTarget > 5;

    if (significantDrift) {
      const riskNote = p.riskTolerance === "aggressive"
        ? "Even for an aggressive portfolio,"
        : p.riskTolerance === "conservative"
          ? "For your conservative profile,"
          : "";

      alerts.push({
        type: "position_oversize", severity: "warning",
        title: `${p.ticker} is ${p.currentAllocationPct.toFixed(1)}% of your portfolio`,
        message: `${riskNote} ${p.currentAllocationPct.toFixed(1)}% in one stock concentrates your bets. ${p.targetAllocationPct ? `Target was ${p.targetAllocationPct.toFixed(1)}%.` : ""}`,
        recommendation: `Trim to ${threshold - 5}–${threshold}% by selling shares. Use proceeds to buy a sector you're under-exposed to.`,
      });
    }
  }

  if (p.daysSinceReview >= 90) {
    alerts.push({
      type: "review_due", severity: "info",
      title: `${p.ticker} hasn't been reviewed in ${p.daysSinceReview} days`,
      message: "Quarterly review is best practice.",
      recommendation: `Open the stock page, check AI score, news, and trade plan, then mark as reviewed.`,
    });
  }

  return alerts;
}

function deriveRecommendation(
  alerts: HoldingAlert[],
  positionPct: number,
  scorePercentile: number,
  rank: number | null,
  totalStocks: number
): EnrichedHolding["recommendation"] {
  // Bottom-quartile stocks get the most decisive recommendation
  if (scorePercentile < 25) return "Sell Immediately";
  if (rank && totalStocks && rank > totalStocks * 0.9) return "Sell Immediately";

  const isSmallPosition = positionPct < 5;
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning").length;
  const successes = alerts.filter((a) => a.severity === "success").length;

  if (hasCritical && isSmallPosition) return "Sell Whole Position";
  if (hasCritical) return "Review Urgently";
  if (isSmallPosition && warnings >= 2) return "Sell Whole Position";
  if (warnings >= 2) return "Consider Trimming";
  if (successes >= 2 && warnings === 0) return "Consider Buying More";
  if (successes >= 1 && warnings === 0) return "Strong Hold";
  return "Hold";
}

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
    if (
      value < closes[i - 1] && value < closes[i - 2] &&
      value <= closes[i + 1] && value <= closes[i + 2]
    ) {
      swingLows.push(value);
    }
    if (
      value > closes[i - 1] && value > closes[i - 2] &&
      value >= closes[i + 1] && value >= closes[i + 2]
    ) {
      swingHighs.push(value);
    }
  }
  return { swingLows, swingHighs };
}

async function getTechnicalLevels(ticker: string, currentPrice: number): Promise<TechnicalLevels> {
  try {
    const chart = await getStockChart(ticker, ["6M", "1Y"]);
    const points = (chart["6M"] && chart["6M"]!.length >= 80) ? chart["6M"]! : (chart["1Y"] ?? []);
    const closes = points
      .map((point) => Number(point.close))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (closes.length < 40) {
      return { support: null, resistance: null, swingLow: null, swingHigh: null, ma50: null, ma200: null, atrPct: null, source: "fallback" };
    }

    const recent = closes.slice(-126);
    const { swingLows, swingHighs } = detectSwingLevels(recent);
    const ma50 = average(closes.slice(-50));
    const ma200 = closes.length >= 200 ? average(closes.slice(-200)) : null;
    const recentAbsMoves = closes.slice(-45).slice(1).map((price, index) => {
      const previous = closes.slice(-45)[index];
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

function buildDynamicTriggers(p: {
  ticker: string; currentPrice: number; entryPrice: number;
  pnlPercent: number; currentAllocationPct: number;
  score: number; scoreAtEntry: number | null;
  sector: string | null; sectorMomentum: SectorMomentum;
  daysSinceReview: number; daysHeld: number;
  scorePercentile: number; rank: number | null; totalStocks: number;
}): HoldingTrigger[] {
  const triggers: HoldingTrigger[] = [];
  const now = new Date();

  const conviction = p.scorePercentile; // rank-based: 100 = best, 0 = worst
  const isElite = conviction >= 90;
  const isStrong = conviction >= 75;
  const isHealthy = conviction >= 55;
  const isWeak = conviction < 35;
  const isSmall = p.currentAllocationPct < 5;
  const isLarge = p.currentAllocationPct > 15;
  const isVeryLarge = p.currentAllocationPct > 25;
  const isRecentlyAdded = p.daysHeld < RECENT_THRESHOLD_DAYS;
  const scoreChangePct = p.scoreAtEntry && p.scoreAtEntry > 0
    ? (p.score - p.scoreAtEntry) / p.scoreAtEntry
    : 0;

  const clampPct = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const priceAt = (price: number, pct: number) => price * (1 + pct / 100);
  const money = (price: number) => `$${price.toFixed(2)}`;

  const sectorAdjustment =
    p.sectorMomentum === "Booming" ? 1.5 :
    p.sectorMomentum === "Strong" ? 1 :
    p.sectorMomentum === "Struggling" ? -2 :
    p.sectorMomentum === "Weak" ? -1 :
    0;

  const concentrationAdjustment = isVeryLarge ? -3 : isLarge ? -1.5 : isSmall ? 1 : 0;

  const baseRoomPct = isElite ? 14 : isStrong ? 12 : isHealthy ? 9 : 7;
  const stopRoomPct = clampPct(
    baseRoomPct + sectorAdjustment + concentrationAdjustment + (isRecentlyAdded ? 1 : 0),
    isWeak ? 4.5 : 6,
    isElite ? 17 : 13,
  );

  const trailingRoomPct = clampPct(
    (isElite ? 15 : isStrong ? 12 : isHealthy ? 9 : 6)
      + sectorAdjustment
      + concentrationAdjustment
      + (p.pnlPercent >= 75 ? -2 : 0),
    5,
    16,
  );

  const upsideTargetPct = clampPct(
    (isElite ? 38 : isStrong ? 28 : isHealthy ? 18 : 10)
      + (p.sectorMomentum === "Booming" ? 5 : 0)
      + (scoreChangePct > 0.12 ? 5 : 0)
      - (isVeryLarge ? 8 : isLarge ? 4 : 0),
    8,
    48,
  );

  // ══════════════════════════════════════════════════════
  // OVERRIDE: weak AI signal means preservation beats target-setting.
  // ══════════════════════════════════════════════════════
  if (isWeak || (p.rank && p.totalStocks && p.rank > p.totalStocks * 0.85)) {
    const exitStop = priceAt(p.currentPrice, -5);
    const reliefTarget = p.pnlPercent < 0
      ? Math.min(p.entryPrice, priceAt(p.currentPrice, 8))
      : priceAt(p.currentPrice, 6);

    triggers.push({
      type: "exit_all", icon: "exit", tone: "negative", priority: 1,
      condition: `${p.ticker} is low conviction (rank #${p.rank ?? "—"}, bottom ${Math.max(1, 100 - conviction)}%)`,
      action: `Do not wait for a big target. Exit or rotate into a top-ranked stock unless the AI rank recovers above the top 50%.`,
    });
    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 2,
      condition: `If ${p.ticker} falls to ${money(exitStop)} (-5% from current)`,
      action: `Sell the position. Weak AI rank means downside protection matters more than giving it room.`,
    });
    triggers.push({
      type: "take_profit", icon: "target", tone: "neutral", priority: 3,
      condition: `If ${p.ticker} rebounds to ${money(reliefTarget)}`,
      action: `Use the bounce to exit or cut heavily. This is a relief target, not a high-conviction profit target.`,
    });
    return triggers;
  }

  // ══════════════════════════════════════════════════════
  // 1. DOWNSIDE / STOP LOGIC
  // ══════════════════════════════════════════════════════
  if (p.pnlPercent >= 60) {
    const trailingStop = priceAt(p.currentPrice, -trailingRoomPct);
    triggers.push({
      type: "trailing_stop", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops to ${money(trailingStop)} (-${trailingRoomPct.toFixed(0)}% from current)`,
      action: isElite || isStrong
        ? `Let the winner run, but protect the gain. Sell 25–50% only if the trailing stop breaks or AI rank weakens.`
        : `Sell at least half. Big gains with only average conviction should be protected.`,
    });
  } else if (p.pnlPercent >= 20) {
    const trailingStop = priceAt(p.currentPrice, -trailingRoomPct);
    triggers.push({
      type: "trailing_stop", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops to ${money(trailingStop)} (-${trailingRoomPct.toFixed(0)}% from current)`,
      action: isStrong
        ? `Hold unless the trailing stop breaks. Strong AI rank justifies giving the trade room.`
        : `Trim 25–33% if this breaks. Protect a profitable but not elite setup.`,
    });
  } else if (p.pnlPercent <= -12) {
    const lossStopPct = isStrong ? 7 : 5;
    const stopPrice = priceAt(p.currentPrice, -lossStopPct);
    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} falls to ${money(stopPrice)} (-${lossStopPct}% from current)`,
      action: isStrong
        ? `Cut only if it keeps breaking down. AI rank is still strong, so avoid panic-selling the first drawdown.`
        : `Sell. A losing position without strong conviction should not be allowed to grow into a portfolio problem.`,
    });
  } else {
    const entryStop = priceAt(p.entryPrice, -stopRoomPct);
    const currentStop = priceAt(p.currentPrice, -Math.min(stopRoomPct, 8));
    const stopPrice = p.currentPrice > p.entryPrice
      ? Math.max(entryStop, currentStop)
      : Math.min(entryStop, currentStop);

    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} falls to ${money(stopPrice)} (${stopRoomPct.toFixed(0)}% risk room)`,
      action: isStrong
        ? `Use this as a thesis-break level, not a panic button. Strong rank gets more room; break below this means reassess and cut.`
        : `Sell or cut heavily. Average-ranked positions should not be given unlimited downside.`,
    });
  }

  // ══════════════════════════════════════════════════════
  // 2. UPSIDE / TAKE-PROFIT LOGIC
  // ══════════════════════════════════════════════════════
  if (isElite && p.pnlPercent < 75) {
    const target = priceAt(p.currentPrice, upsideTargetPct);
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `If ${p.ticker} reaches ${money(target)} (+${upsideTargetPct.toFixed(0)}% from current)`,
      action: isVeryLarge
        ? `Trim 15–25% only because position size is high. Otherwise let the elite-ranked stock compound.`
        : `Do not fully sell. For elite-ranked stocks, take only a small trim or keep riding with the trailing stop.`,
    });
  } else if (isStrong && p.pnlPercent < 50) {
    const target = priceAt(p.currentPrice, upsideTargetPct);
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `If ${p.ticker} reaches ${money(target)} (+${upsideTargetPct.toFixed(0)}% from current)`,
      action: isLarge
        ? `Trim 20–30% and keep the rest. Strong AI rank means avoid selling the whole winner.`
        : `Take a partial profit only. Hold the core while rank remains top quartile.`,
    });
  } else if (p.pnlPercent >= 75) {
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `${p.ticker} is already up ${p.pnlPercent.toFixed(0)}%`,
      action: isElite || isStrong
        ? `No hard upside cap. Keep a core position and let it run; only trim 20–25% if it becomes oversized.`
        : `Bank 33–50%. Very large gains with average conviction should be harvested.`,
    });
  } else if (p.pnlPercent <= -8) {
    const recoveryTarget = isStrong ? p.entryPrice * 1.08 : p.entryPrice;
    triggers.push({
      type: "take_profit", icon: "target", tone: isStrong ? "positive" : "neutral", priority: 2,
      condition: `If ${p.ticker} recovers to ${money(recoveryTarget)}`,
      action: isStrong
        ? `Do not rush out at breakeven. Strong AI rank supports holding for a proper recovery.`
        : `Use the recovery to exit or reduce. Do not let relief turn into another drawdown.`,
    });
  } else {
    const target = priceAt(p.currentPrice, upsideTargetPct);
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `If ${p.ticker} reaches ${money(target)} (+${upsideTargetPct.toFixed(0)}% from current)`,
      action: isSmall
        ? `Sell most or all. Small positions are not worth micro-trimming.`
        : `Trim 20–33% and keep the rest if AI rank remains strong.`,
    });
  }

  // ══════════════════════════════════════════════════════
  // 3. SCORE-BASED THESIS BREAK
  // ══════════════════════════════════════════════════════
  if (p.scoreAtEntry) {
    const thresholdMultiplier = isElite ? 0.78 : isStrong ? 0.75 : 0.70;
    const threshold = Math.round(p.scoreAtEntry * thresholdMultiplier);
    triggers.push({
      type: "score_alert", icon: "warning", tone: "neutral", priority: 3,
      condition: `If AI score drops below ${threshold.toLocaleString()} (currently ${p.score.toLocaleString()})`,
      action: isSmall
        ? `Sell the whole position. A small holding is not worth managing through a broken thesis.`
        : `Cut 33–50%. Price stops matter, but AI-score deterioration is the real thesis break.`,
    });
  }

  // 4. REVIEW
  if (!isRecentlyAdded) {
    const reviewIn = Math.max(0, 90 - p.daysSinceReview);
    const reviewDate = new Date(now);
    reviewDate.setDate(now.getDate() + reviewIn);
    triggers.push({
      type: "review", icon: "calendar", tone: "neutral", priority: 4,
      condition: reviewIn <= 0 ? "Review overdue" : `Review on ${reviewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      action: reviewIn <= 0 ? "Open stock page now and reassess." : "Quarterly check: AI score, news, sector momentum, and whether stop/target still fit the rank.",
    });
  }

  return triggers.sort((a, b) => a.priority - b.priority);
}


// ✦ Much smarter, situation-aware AI summary
function buildAISummary(p: {
  recommendation: EnrichedHolding["recommendation"];
  scorePercentile: number;
  pnlPercent: number;
  sectorMomentum: SectorMomentum;
  alerts: HoldingAlert[];
  currentAllocationPct: number;
  ticker: string;
  daysHeld: number;
  rank: number | null;
  totalStocks: number;
  isRecentlyAdded: boolean;
  scoreChange: number;
  scoreAtEntry: number | null;
}): string {
  // ── Recently added — special case
  if (p.isRecentlyAdded) {
    if (p.recommendation === "Sell Immediately") {
      return `⚠ Even though you just added ${p.ticker}, the AI signal is in the bottom 25%. This was a poor pick by the metrics — strongly consider selling and replacing with a top-100 ranked stock.`;
    }
    if (p.scorePercentile >= 75) {
      return `Recently added — you bought a top ${100 - p.scorePercentile}% AI-rated stock. Give it 2–4 weeks to develop before judging. Standard alerts are paused until you've held it longer.`;
    }
    return `Recently added (${p.daysHeld} ${p.daysHeld === 1 ? "day" : "days"} ago). The AI is giving this position a grace period — only critical signals will fire until you've held it for a week. Let the thesis develop.`;
  }

  // ── Poor signal — top priority
  if (p.recommendation === "Sell Immediately") {
    return `⚠ Sell ${p.ticker}. It's ranked #${p.rank ?? "—"} of ${p.totalStocks} — bottom ${100 - p.scorePercentile}% of stocks. There are hundreds of better-rated stocks to redeploy this cash into. Don't try to make this work.`;
  }

  // ── Sell whole — small position with warnings
  if (p.recommendation === "Sell Whole Position") {
    return `Sell ${p.ticker} entirely. At ${p.currentAllocationPct.toFixed(1)}% of your portfolio, this position is too small to justify managing through warnings. Cleaner to exit and redeploy.`;
  }

  // ── Critical alerts present
  if (p.recommendation === "Review Urgently") {
    const trigger = p.alerts.find((a) => a.severity === "critical");
    return `⚠ ${trigger?.title ?? `${p.ticker} has critical alerts`}. ${p.currentAllocationPct.toFixed(1)}% of portfolio. Decide now: cut losses or hold with conviction. Don't drift.`;
  }

  // ── Big winner
  if (p.pnlPercent >= 50) {
    return `${p.ticker} is up ${p.pnlPercent.toFixed(0)}% from entry — a strong winner. ${p.currentAllocationPct.toFixed(1)}% of portfolio. Don't take profits early. Use a trailing stop to protect gains; let it run.`;
  }

  // ── Up nicely
  if (p.pnlPercent >= 20) {
    return `${p.ticker} is up ${p.pnlPercent.toFixed(0)}% — solid performance. ${p.currentAllocationPct.toFixed(1)}% of portfolio. ${p.recommendation === "Strong Hold" ? "Top-tier signal continues — hold." : p.recommendation === "Consider Buying More" ? "Add on dips while signal is strong." : "Hold steady."}`;
  }

  // ── Underwater
  if (p.pnlPercent <= -10) {
    if (p.scorePercentile >= 70) {
      return `${p.ticker} is down ${Math.abs(p.pnlPercent).toFixed(0)}%, but the AI signal remains strong (top ${100 - p.scorePercentile}%). This may be a buy-the-dip opportunity rather than a problem.`;
    }
    return `${p.ticker} is down ${Math.abs(p.pnlPercent).toFixed(0)}% from your entry. ${p.currentAllocationPct.toFixed(1)}% of portfolio. ${p.recommendation === "Consider Trimming" ? "AI signal is weakening — consider cutting before losses grow." : "Reassess your thesis. If it still holds, this is a buy zone. If not, get out."}`;
  }

  // ── Trimming candidate
  if (p.recommendation === "Consider Trimming") {
    const warningCount = p.alerts.filter((a) => a.severity === "warning").length;
    return `${warningCount} yellow flag${warningCount === 1 ? "" : "s"} on ${p.ticker}. ${p.currentAllocationPct.toFixed(1)}% of portfolio. Reduce exposure: sell some now, watch how it develops before deciding on the rest.`;
  }

  // ── Buy more candidate
  if (p.recommendation === "Consider Buying More") {
    return `${p.ticker} is set up well: top ${100 - p.scorePercentile}% AI score, ${p.sectorMomentum.toLowerCase()} sector backdrop. ${p.currentAllocationPct.toFixed(1)}% of portfolio. If you have cash, this is the kind of position you add to on any 5%+ dip.`;
  }

  // ── Strong hold
  if (p.recommendation === "Strong Hold") {
    return `${p.ticker} is performing as the AI expected — top ${100 - p.scorePercentile}% AI score in a ${p.sectorMomentum.toLowerCase()} sector. ${p.currentAllocationPct.toFixed(1)}% of portfolio. Hold patiently; don't take profits early.`;
  }

  // ── Default hold
  return `${p.ticker}: rank #${p.rank ?? "—"} (top ${100 - p.scorePercentile}%), sector is ${p.sectorMomentum.toLowerCase()}, ${p.currentAllocationPct.toFixed(1)}% of portfolio. No urgent action — let the thesis play out.`;
}

export async function enrichHoldings(
  holdings: Array<{
    ticker: string;
    entry_price: number | null;
    score_at_entry: number | null;
    rank_at_entry: number | null;
    shares: number | null;
    allocation_pct: number | null;
    added_at: string;
    last_reviewed_at: string;
  }>,
  riskTolerance: RiskTolerance = null
): Promise<EnrichedHolding[]> {
  if (holdings.length === 0) return [];

  const supabase = await createClient();
  const tickers = holdings.map((h) => h.ticker);

  const { data: currentData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score, price")
    .in("ticker", tickers);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNews } = await supabase
    .from("news_articles").select("impact, affected_tickers")
    .gte("published_at", fourteenDaysAgo).limit(200);

  const { momentum, bullishPct, maxScore, totalStocks } = await getSectorData();

  const currentMap = new Map((currentData ?? []).map((s) => [s.ticker as string, s]));

  const newsImpactByTicker: Record<string, { positive: number; negative: number }> = {};
  (recentNews ?? []).forEach((n) => {
    const tickers = Array.isArray(n.affected_tickers) ? n.affected_tickers : [];
    const impact = (n.impact ?? "").toLowerCase();
    tickers.forEach((t: string) => {
      if (!newsImpactByTicker[t]) newsImpactByTicker[t] = { positive: 0, negative: 0 };
      if (impact === "positive") newsImpactByTicker[t].positive++;
      else if (impact === "negative") newsImpactByTicker[t].negative++;
    });
  });

  const now = new Date();

  const totalPortfolioValue = holdings.reduce((sum, h) => {
    const current = currentMap.get(h.ticker);
    const price = Number(current?.price) || 0;
    const shares = Number(h.shares) || 1;
    return sum + price * shares;
  }, 0);

  return await Promise.all(holdings.map(async (h) => {
    const current = currentMap.get(h.ticker);
    const score = Number(current?.score) || 0;
    const currentPrice = Number(current?.price) || 0;
    const entryPrice = Number(h.entry_price) || currentPrice;
    const sector = (current?.sector as string) ?? null;
    const rank = Number(current?.rank) || null;
    const shares = Number(h.shares) || 1;

    const costBasis = entryPrice * shares;
    const currentValue = currentPrice * shares;
    const totalPnLDollars = currentValue - costBasis;
    const currentAllocationPct = totalPortfolioValue > 0
      ? (currentValue / totalPortfolioValue) * 100 : 0;

    const scoreChange = score - (h.score_at_entry ?? score);
    const rankChange = h.rank_at_entry ? h.rank_at_entry - (rank ?? h.rank_at_entry) : 0;
    const pnlDollars = currentPrice - entryPrice;
    const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
    const daysSinceReview = daysBetween(now, new Date(h.last_reviewed_at));
    const daysHeld = daysBetween(now, new Date(h.added_at));
    const isRecentlyAdded = daysHeld < RECENT_THRESHOLD_DAYS;

    const news = newsImpactByTicker[h.ticker] ?? { positive: 0, negative: 0 };
    const sectorMomentumValue = sector ? (momentum[sector] ?? "Unknown") : "Unknown";
    const sectorBullishPctValue = sector ? (bullishPct[sector] ?? 0) : 0;
    const scorePercentile = Math.round((score / maxScore) * 100);
    const rankPercentile = rank ? Math.round((1 - (rank - 1) / Math.max(totalStocks - 1, 1)) * 100) : 50;

    const alerts = buildAlerts({
      ticker: h.ticker, scoreChange, pnlPercent, daysSinceReview,
      scoreAtEntry: h.score_at_entry, score, rank, rankAtEntry: h.rank_at_entry,
      recentNegativeNewsCount: news.negative, recentPositiveNewsCount: news.positive,
      sectorMomentum: sectorMomentumValue, sectorBullishPct: sectorBullishPctValue,
      sector, currentPrice, entryPrice, currentAllocationPct,
      targetAllocationPct: h.allocation_pct, scorePercentile, rankPercentile,
      daysHeld, riskTolerance, totalStocks,
    });

    const recommendation = deriveRecommendation(alerts, currentAllocationPct, scorePercentile, rank, totalStocks);

    const triggers = await buildDynamicTriggers({
      ticker: h.ticker, currentPrice, entryPrice, pnlPercent,
      currentAllocationPct, score, scoreAtEntry: h.score_at_entry,
      sector, sectorMomentum: sectorMomentumValue, daysSinceReview, daysHeld,
      scorePercentile, rank, totalStocks,
    });

    const aiSummary = buildAISummary({
      recommendation, scorePercentile, pnlPercent,
      sectorMomentum: sectorMomentumValue, alerts,
      currentAllocationPct, ticker: h.ticker,
      daysHeld, rank, totalStocks, isRecentlyAdded,
      scoreChange, scoreAtEntry: h.score_at_entry,
    });

    return {
      ticker: h.ticker, company: (current?.company as string) ?? null, sector, rank, score, maxScore,
      currentPrice, entryPrice, shares,
      costBasis: Math.round(costBasis * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
      totalPnLDollars: Math.round(totalPnLDollars * 100) / 100,
      currentAllocationPct: Math.round(currentAllocationPct * 10) / 10,
      targetAllocationPct: h.allocation_pct,
      scoreAtEntry: h.score_at_entry, rankAtEntry: h.rank_at_entry,
      addedAt: h.added_at, lastReviewedAt: h.last_reviewed_at, daysHeld,
      pnlDollars: Math.round(pnlDollars * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 10) / 10,
      scoreChange, rankChange, daysSinceReview, alerts, recommendation,
      sectorMomentum: sectorMomentumValue, sectorBullishPct: sectorBullishPctValue,
      scorePercentile, rankPercentile, triggers, aiSummary, isRecentlyAdded,
    };
  }));
}
