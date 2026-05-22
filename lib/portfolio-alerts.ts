import { createClient } from "@/utils/supabase/server";
import { getStockChart } from "@/lib/yahoo";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertCategory = "event" | "action";

export type AlertAction = "none" | "review" | "buy_more" | "trim" | "sell";

export type AlertType =
  | "score_event"
  | "rank_event"
  | "news_event"
  | "sector_event"
  | "price_event"
  | "sell_action"
  | "trim_action"
  | "buy_more_action"
  | "review_action";

export type HoldingAlert = {
  id: string;
  category: AlertCategory;
  type: AlertType;
  severity: AlertSeverity;
  action: AlertAction;
  title: string;
  message: string;
  recommendation: string;
  evidence: string[];
  priority: number;
  expiresWhen: string;
};

export type SectorMomentum = "Booming" | "Strong" | "Mixed" | "Weak" | "Struggling" | "Unknown";
export type RiskTolerance = "conservative" | "moderate" | "aggressive" | null;

export type HoldingTrigger = {
  type: "stop_loss" | "take_profit" | "score_floor" | "review";
  icon: "shield" | "target" | "warning" | "calendar";
  condition: string;
  action: string;
  tone: "positive" | "negative" | "neutral";
  priority: number;
};

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
  eventAlerts: HoldingAlert[];
  actionAlerts: HoldingAlert[];
  recommendation:
    | "Hold"
    | "Strong Hold"
    | "Consider Buying More"
    | "Consider Trimming"
    | "Review Urgently"
    | "Sell Whole Position"
    | "Sell Immediately";
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  scorePercentile: number;
  rankPercentile: number;
  triggers: HoldingTrigger[];
  aiSummary: string;
  isRecentlyAdded: boolean;
};

type TechnicalLevels = {
  stopLoss: number | null;
  takeProfit: number | null;
  support: number | null;
  resistance: number | null;
  ma50: number | null;
  volatilityPct: number | null;
  source: "technical" | "fallback";
};

type AlertContext = {
  ticker: string;
  company: string | null;
  sector: string | null;
  score: number;
  scoreAtEntry: number | null;
  rank: number | null;
  rankAtEntry: number | null;
  currentPrice: number;
  entryPrice: number;
  pnlPercent: number;
  currentAllocationPct: number;
  targetAllocationPct: number | null;
  daysHeld: number;
  daysSinceReview: number;
  isRecentlyAdded: boolean;
  rankPercentile: number;
  scorePercentile: number;
  totalStocks: number;
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  recentNegativeNewsCount: number;
  recentPositiveNewsCount: number;
  latestNegativeHeadline: string | null;
  latestPositiveHeadline: string | null;
  riskTolerance: RiskTolerance;
  factorDiagnostics?: Record<string, any> | null;
  technical: TechnicalLevels;
};

const RECENT_HOLDING_GRACE_DAYS = 7;
const NEWS_WINDOW_DAYS = 14;

function finiteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctChange(current: number | null, previous: number | null) {
  if (!current || !previous || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function concentrationThreshold(risk: RiskTolerance) {
  if (risk === "conservative") return 18;
  if (risk === "aggressive") return 32;
  return 25;
}

function formatFactorName(factor: string) {
  return factor
    .replace(/_/g, " ")
    .replace(/\brel\b/gi, "relative")
    .replace(/\bz\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function makeAlert(input: Omit<HoldingAlert, "id"> & { ticker: string }): HoldingAlert {
  const id = `${input.ticker}-${input.category}-${input.type}`;
  const { ticker: _ticker, ...alert } = input;
  return { id, ...alert };
}

function latestDiagnosticScore(diagnostics?: Record<string, any> | null) {
  if (!diagnostics) return null;
  return nullableNumber(diagnostics.smoothed_score) ?? nullableNumber(diagnostics.current_score);
}

function previousDiagnosticScore(diagnostics?: Record<string, any> | null) {
  if (!diagnostics) return null;
  return nullableNumber(diagnostics.previous_score);
}

function sleeveChanges(diagnostics?: Record<string, any> | null) {
  if (!diagnostics) return [];

  return [
    ["Momentum", nullableNumber(diagnostics.momentum_change)],
    ["Growth", nullableNumber(diagnostics.growth_change)],
    ["Quality", nullableNumber(diagnostics.quality_change)],
    ["Value", nullableNumber(diagnostics.value_change)],
    ["Risk", nullableNumber(diagnostics.risk_change)],
    ["Income", nullableNumber(diagnostics.income_change)],
  ]
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .sort((a, b) => a[1] - b[1]);
}

function negativeFactorEvidence(diagnostics?: Record<string, any> | null) {
  if (!diagnostics) return [];

  const evidence: string[] = [];
  const negativeSleeves = sleeveChanges(diagnostics)
    .filter(([, value]) => value <= -0.025)
    .slice(0, 3);

  if (negativeSleeves.length > 0) {
    evidence.push(
      `Pressure from ${negativeSleeves.map(([label, value]) => `${label} (${value.toFixed(3)})`).join(", ")}`,
    );
  }

  const topNegative = Array.isArray(diagnostics.top_negative_factors)
    ? diagnostics.top_negative_factors.slice(0, 4)
    : [];

  if (topNegative.length > 0) {
    evidence.push(
      `Weakest factors: ${topNegative
        .map((item: any) => {
          const factor = formatFactorName(String(item.factor ?? "Unknown"));
          const change = nullableNumber(item.change);
          return change === null ? factor : `${factor} (${change.toFixed(3)})`;
        })
        .join(", ")}`,
    );
  }

  const diagnosis = typeof diagnostics.diagnosis === "string" ? diagnostics.diagnosis : null;
  if (diagnosis && diagnosis !== "no single factor driver exceeded the diagnostic threshold") {
    evidence.push(diagnosis);
  }

  return evidence;
}

function positiveFactorEvidence(diagnostics?: Record<string, any> | null) {
  if (!diagnostics) return [];

  const evidence: string[] = [];
  const positiveSleeves = sleeveChanges(diagnostics)
    .filter(([, value]) => value >= 0.025)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (positiveSleeves.length > 0) {
    evidence.push(
      `Strength from ${positiveSleeves.map(([label, value]) => `${label} (+${value.toFixed(3)})`).join(", ")}`,
    );
  }

  const topPositive = Array.isArray(diagnostics.top_positive_factors)
    ? diagnostics.top_positive_factors.slice(0, 4)
    : [];

  if (topPositive.length > 0) {
    evidence.push(
      `Improving factors: ${topPositive
        .map((item: any) => {
          const factor = formatFactorName(String(item.factor ?? "Unknown"));
          const change = nullableNumber(item.change);
          return change === null ? factor : `${factor} (+${change.toFixed(3)})`;
        })
        .join(", ")}`,
    );
  }

  return evidence;
}

async function getSectorData() {
  const supabase = await createClient();
  const { data } = await supabase.from("stock_rankings").select("sector, rank, score");

  const allStocks = (data ?? []) as Array<{ sector: string | null; rank: number | null; score: number | null }>;
  const totalStocks = allStocks.length || 500;
  const topQuartileRank = Math.max(1, Math.ceil(totalStocks * 0.25));
  const topHalfRank = Math.max(1, Math.ceil(totalStocks * 0.5));
  const scores = allStocks.map((stock) => finiteNumber(stock.score, 0)).filter((score) => score > 0);
  const maxScore = scores.length ? Math.max(...scores, 1) : 1;

  const bySector: Record<string, { total: number; bullish: number; healthy: number }> = {};

  allStocks.forEach((stock) => {
    const sector = stock.sector ?? "Unknown";
    const rank = finiteNumber(stock.rank, 0);

    if (!bySector[sector]) bySector[sector] = { total: 0, bullish: 0, healthy: 0 };
    bySector[sector].total += 1;
    if (rank > 0 && rank <= topQuartileRank) bySector[sector].bullish += 1;
    if (rank > 0 && rank <= topHalfRank) bySector[sector].healthy += 1;
  });

  const momentum: Record<string, SectorMomentum> = {};
  const bullishPct: Record<string, number> = {};

  Object.entries(bySector).forEach(([sector, value]) => {
    const bullish = value.total > 0 ? Math.round((value.bullish / value.total) * 100) : 0;
    const healthy = value.total > 0 ? Math.round((value.healthy / value.total) * 100) : 0;

    bullishPct[sector] = bullish;
    if (bullish >= 35) momentum[sector] = "Booming";
    else if (bullish >= 25) momentum[sector] = "Strong";
    else if (healthy >= 45) momentum[sector] = "Mixed";
    else if (healthy >= 30) momentum[sector] = "Weak";
    else momentum[sector] = "Struggling";
  });

  return { momentum, bullishPct, maxScore, totalStocks };
}

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

  for (let i = 2; i < closes.length - 2; i += 1) {
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
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { stopLoss: null, takeProfit: null, support: null, resistance: null, ma50: null, volatilityPct: null, source: "fallback" };
  }

  try {
    const chart = await getStockChart(ticker, ["6M", "1Y"]);
    const sixMonth = (chart as any)["6M"] ?? [];
    const oneYear = (chart as any)["1Y"] ?? [];
    const points = Array.isArray(sixMonth) && sixMonth.length >= 80 ? sixMonth : oneYear;

    const closes = points
      .map((point: any) => finiteNumber(point.close, 0))
      .filter((price: number) => Number.isFinite(price) && price > 0);

    if (closes.length < 40) {
      return {
        stopLoss: currentPrice * 0.92,
        takeProfit: currentPrice * 1.14,
        support: null,
        resistance: null,
        ma50: null,
        volatilityPct: 4,
        source: "fallback",
      };
    }

    const recent = closes.slice(-126);
    const { swingLows, swingHighs } = detectSwingLevels(recent);
    const ma50 = average(closes.slice(-50));
    const last45: number[] = closes.slice(-45);
    const recentAbsMoves = last45.slice(1).map((price: number, index: number) => {
      const previous = last45[index];
      return previous > 0 ? Math.abs((price - previous) / previous) : 0;
    });

    const volatilityPct = Math.max(1.5, Math.min(7, (average(recentAbsMoves) ?? 0.02) * 100));
    const support = nearestBelow([...swingLows, Math.min(...recent.slice(-63)), ...(ma50 && ma50 < currentPrice ? [ma50] : [])], currentPrice);
    const resistance = nearestAbove([...swingHighs, Math.max(...recent.slice(-126))], currentPrice);
    const volatilityStop = currentPrice * (1 - Math.max(0.055, (volatilityPct * 2.2) / 100));
    const supportStop = support ? support * 0.99 : null;
    const stopLoss = Math.max(...[volatilityStop, supportStop].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0));
    const takeProfit = resistance && resistance > currentPrice * 1.04 ? resistance * 0.995 : currentPrice * (1 + Math.max(0.1, (volatilityPct * 3.2) / 100));

    return { stopLoss, takeProfit, support, resistance, ma50, volatilityPct, source: "technical" };
  } catch {
    return {
      stopLoss: currentPrice * 0.92,
      takeProfit: currentPrice * 1.14,
      support: null,
      resistance: null,
      ma50: null,
      volatilityPct: 4,
      source: "fallback",
    };
  }
}

function buildEventAlerts(ctx: AlertContext): HoldingAlert[] {
  const alerts: HoldingAlert[] = [];
  const heldPastGrace = ctx.daysHeld >= RECENT_HOLDING_GRACE_DAYS;
  const scoreFromEntryPct = pctChange(ctx.score, ctx.scoreAtEntry);
  const latestScorePct = pctChange(latestDiagnosticScore(ctx.factorDiagnostics), previousDiagnosticScore(ctx.factorDiagnostics));
  const rankMove = ctx.rank && ctx.rankAtEntry ? ctx.rank - ctx.rankAtEntry : null;
  const negativeEvidence = negativeFactorEvidence(ctx.factorDiagnostics);
  const positiveEvidence = positiveFactorEvidence(ctx.factorDiagnostics);

  if (latestScorePct !== null && latestScorePct <= -8) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "score_event",
      severity: latestScorePct <= -14 ? "warning" : "info",
      action: "review",
      title: `${ctx.ticker} score moved sharply in the latest model run`,
      message: `The latest diagnostics show a ${Math.abs(latestScorePct).toFixed(1)}% score decline versus the previous run.`,
      recommendation: "Review the stock, but only act if the action alert also confirms deterioration.",
      evidence: [`Latest run score change: ${latestScorePct.toFixed(1)}%`, ...negativeEvidence.slice(0, 3)],
      priority: 30,
      expiresWhen: "This alert disappears when the latest model-run score change is no longer material.",
    }));
  }

  if (latestScorePct !== null && latestScorePct >= 10) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "score_event",
      severity: "success",
      action: "none",
      title: `${ctx.ticker} score improved materially`,
      message: `The latest diagnostics show a ${latestScorePct.toFixed(1)}% score improvement versus the previous run.`,
      recommendation: "No automatic action. This supports holding, and may support adding only if the action alert confirms it.",
      evidence: [`Latest run score change: +${latestScorePct.toFixed(1)}%`, ...positiveEvidence.slice(0, 3)],
      priority: 70,
      expiresWhen: "This alert disappears when the improvement is no longer present in the latest run.",
    }));
  }

  if (heldPastGrace && scoreFromEntryPct !== null && scoreFromEntryPct <= -15) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "score_event",
      severity: scoreFromEntryPct <= -25 ? "warning" : "info",
      action: "review",
      title: `${ctx.ticker} AI score is materially below your entry score`,
      message: `The score is down ${Math.abs(scoreFromEntryPct).toFixed(1)}% since you added the position.`,
      recommendation: "Review whether the original thesis still holds. This becomes actionable only with weak rank, price, news or factor confirmation.",
      evidence: [`Entry score: ${ctx.scoreAtEntry?.toLocaleString() ?? "—"}`, `Current score: ${ctx.score.toLocaleString()}`, ...negativeEvidence.slice(0, 2)],
      priority: 35,
      expiresWhen: "This alert disappears when the score recovers above the material-deterioration threshold.",
    }));
  }

  if (heldPastGrace && scoreFromEntryPct !== null && scoreFromEntryPct >= 18) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "score_event",
      severity: "success",
      action: "none",
      title: `${ctx.ticker} AI score is stronger than at entry`,
      message: `The score is up ${scoreFromEntryPct.toFixed(1)}% since you added the position.`,
      recommendation: "This supports holding. Only buy more if the separate action alert confirms the stock is still attractively positioned.",
      evidence: [`Entry score: ${ctx.scoreAtEntry?.toLocaleString() ?? "—"}`, `Current score: ${ctx.score.toLocaleString()}`, ...positiveEvidence.slice(0, 2)],
      priority: 75,
      expiresWhen: "This alert disappears when the score improvement fades.",
    }));
  }

  if (heldPastGrace && rankMove !== null && rankMove >= 60) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "rank_event",
      severity: rankMove >= 100 ? "warning" : "info",
      action: "review",
      title: `${ctx.ticker} fell ${rankMove} places in the rankings`,
      message: `The stock moved from #${ctx.rankAtEntry} at entry to #${ctx.rank} now.`,
      recommendation: "Review against stronger alternatives. This becomes a sell/trim only if the action logic confirms weak conviction.",
      evidence: [`Entry rank: #${ctx.rankAtEntry}`, `Current rank: #${ctx.rank}`, `Current rank percentile: ${ctx.rankPercentile}/100`],
      priority: 40,
      expiresWhen: "This alert disappears when the rank recovers enough that the move is no longer material.",
    }));
  }

  if (heldPastGrace && rankMove !== null && rankMove <= -40) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "rank_event",
      severity: "success",
      action: "none",
      title: `${ctx.ticker} climbed ${Math.abs(rankMove)} places in the rankings`,
      message: `The stock moved from #${ctx.rankAtEntry} at entry to #${ctx.rank} now.`,
      recommendation: "Positive confirmation. Hold unless price or concentration risk says otherwise.",
      evidence: [`Entry rank: #${ctx.rankAtEntry}`, `Current rank: #${ctx.rank}`, `Current rank percentile: ${ctx.rankPercentile}/100`],
      priority: 80,
      expiresWhen: "This alert disappears when the ranking improvement is no longer material.",
    }));
  }

  if (ctx.recentNegativeNewsCount >= 3) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "news_event",
      severity: "warning",
      action: "review",
      title: `${ctx.ticker} has a negative news cluster`,
      message: `${ctx.recentNegativeNewsCount} negative articles were detected in the last ${NEWS_WINDOW_DAYS} days.`,
      recommendation: "Read the recent news before adding. If the AI signal is also weakening, this may become an action alert.",
      evidence: [`${ctx.recentNegativeNewsCount} negative articles`, ctx.latestNegativeHeadline ? `Latest: ${ctx.latestNegativeHeadline}` : "Recent negative coverage detected"],
      priority: 32,
      expiresWhen: "This alert disappears when the negative news cluster leaves the recent-news window.",
    }));
  }

  if (ctx.recentPositiveNewsCount >= 4) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "news_event",
      severity: "success",
      action: "none",
      title: `${ctx.ticker} has strong positive news flow`,
      message: `${ctx.recentPositiveNewsCount} positive articles were detected in the last ${NEWS_WINDOW_DAYS} days.`,
      recommendation: "Positive context, but not enough by itself to buy more.",
      evidence: [`${ctx.recentPositiveNewsCount} positive articles`, ctx.latestPositiveHeadline ? `Latest: ${ctx.latestPositiveHeadline}` : "Recent positive coverage detected"],
      priority: 85,
      expiresWhen: "This alert disappears when the positive news cluster leaves the recent-news window.",
    }));
  }

  if (heldPastGrace && ctx.sectorMomentum === "Struggling" && ctx.sectorBullishPct <= 20 && ctx.rankPercentile < 60) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "sector_event",
      severity: "warning",
      action: "review",
      title: `${ctx.sector ?? "Sector"} backdrop has weakened`,
      message: `Only ${ctx.sectorBullishPct}% of stocks in this sector are currently top-quartile ranked.`,
      recommendation: "Avoid adding. Consider rotation only if the action alert confirms weak stock-specific conviction.",
      evidence: [`Sector momentum: ${ctx.sectorMomentum}`, `Sector top-quartile participation: ${ctx.sectorBullishPct}%`, `Stock rank percentile: ${ctx.rankPercentile}/100`],
      priority: 55,
      expiresWhen: "This alert disappears when the sector backdrop improves or the stock regains strong relative rank.",
    }));
  }

  if (ctx.sectorMomentum === "Booming" && ctx.sectorBullishPct >= 35 && ctx.rankPercentile >= 70) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "sector_event",
      severity: "success",
      action: "none",
      title: `${ctx.sector ?? "Sector"} backdrop is strong`,
      message: `${ctx.sectorBullishPct}% of stocks in this sector are currently top-quartile ranked.`,
      recommendation: "Sector support improves the hold case. Buy more only if the action alert confirms the position is still underbuilt.",
      evidence: [`Sector momentum: ${ctx.sectorMomentum}`, `Sector top-quartile participation: ${ctx.sectorBullishPct}%`, `Stock rank percentile: ${ctx.rankPercentile}/100`],
      priority: 90,
      expiresWhen: "This alert disappears when sector breadth or stock rank weakens.",
    }));
  }

  if (heldPastGrace && ctx.pnlPercent <= -12) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "price_event",
      severity: "info",
      action: "review",
      title: `${ctx.ticker} is down ${Math.abs(ctx.pnlPercent).toFixed(1)}% from entry`,
      message: "The price move is large enough to review, but price alone is not treated as a sell signal.",
      recommendation: "Check whether the AI score and rank still support the position.",
      evidence: [`Entry price: ${money(ctx.entryPrice)}`, `Current price: ${money(ctx.currentPrice)}`, `P&L: ${ctx.pnlPercent.toFixed(1)}%`],
      priority: 65,
      expiresWhen: "This alert disappears when the drawdown is no longer material.",
    }));
  }

  if (heldPastGrace && ctx.pnlPercent >= 30) {
    alerts.push(makeAlert({
      ticker: ctx.ticker,
      category: "event",
      type: "price_event",
      severity: "success",
      action: "none",
      title: `${ctx.ticker} is up ${ctx.pnlPercent.toFixed(1)}% from entry`,
      message: "The position has become a meaningful winner.",
      recommendation: "Do not automatically sell winners. Trim only if the action alert flags concentration or weakening conviction.",
      evidence: [`Entry price: ${money(ctx.entryPrice)}`, `Current price: ${money(ctx.currentPrice)}`, `P&L: +${ctx.pnlPercent.toFixed(1)}%`],
      priority: 88,
      expiresWhen: "This alert disappears when the gain is no longer material.",
    }));
  }

  return alerts.sort((a, b) => a.priority - b.priority);
}

function buildActionAlert(ctx: AlertContext, eventAlerts: HoldingAlert[]) {
  const heldPastGrace = ctx.daysHeld >= RECENT_HOLDING_GRACE_DAYS;
  const scoreFromEntryPct = pctChange(ctx.score, ctx.scoreAtEntry);
  const latestScorePct = pctChange(latestDiagnosticScore(ctx.factorDiagnostics), previousDiagnosticScore(ctx.factorDiagnostics));
  const rankMove = ctx.rank && ctx.rankAtEntry ? ctx.rank - ctx.rankAtEntry : null;
  const rankImprovement = rankMove !== null ? -rankMove : 0;
  const negativeEvidence = negativeFactorEvidence(ctx.factorDiagnostics);
  const positiveEvidence = positiveFactorEvidence(ctx.factorDiagnostics);
  const maxConcentration = concentrationThreshold(ctx.riskTolerance);
  const driftFromTarget = ctx.targetAllocationPct !== null ? ctx.currentAllocationPct - ctx.targetAllocationPct : null;
  const stopHit = ctx.technical.stopLoss !== null && ctx.currentPrice <= ctx.technical.stopLoss;
  const targetUpsidePct = ctx.technical.takeProfit && ctx.technical.takeProfit > ctx.currentPrice ? ((ctx.technical.takeProfit - ctx.currentPrice) / ctx.currentPrice) * 100 : 0;
  const sectorStrong = ctx.sectorMomentum === "Strong" || ctx.sectorMomentum === "Booming";

  const clearDeterioration =
    (scoreFromEntryPct !== null && scoreFromEntryPct <= -15) ||
    (latestScorePct !== null && latestScorePct <= -8) ||
    ctx.recentNegativeNewsCount >= 3 ||
    negativeEvidence.length >= 2;

  const strongConfirmation =
    (scoreFromEntryPct !== null && scoreFromEntryPct >= 8) ||
    (latestScorePct !== null && latestScorePct >= 5) ||
    rankImprovement >= 30 ||
    ctx.recentPositiveNewsCount >= 4 ||
    positiveEvidence.length >= 2;

  const underbuilt = ctx.targetAllocationPct !== null ? ctx.currentAllocationPct <= Math.max(2, ctx.targetAllocationPct - 3) : ctx.currentAllocationPct < 8;
  const overbuilt = ctx.currentAllocationPct > maxConcentration && (driftFromTarget === null || driftFromTarget > 4);

  if (heldPastGrace && stopHit && (ctx.rankPercentile < 60 || clearDeterioration)) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "sell_action",
      severity: "critical",
      action: "sell",
      title: `Sell signal: ${ctx.ticker} broke its risk level`,
      message: `Current price ${money(ctx.currentPrice)} is at or below the active risk level of ${money(ctx.technical.stopLoss!)}, and conviction is not strong enough to ignore it.`,
      recommendation: "Sell or materially reduce the position. Do not average down into a broken setup.",
      evidence: [`Current price: ${money(ctx.currentPrice)}`, `Risk level: ${money(ctx.technical.stopLoss!)}`, `Rank percentile: ${ctx.rankPercentile}/100`, ...(scoreFromEntryPct !== null ? [`Score from entry: ${scoreFromEntryPct.toFixed(1)}%`] : []), ...negativeEvidence.slice(0, 2)],
      priority: 1,
      expiresWhen: "This action disappears if price recovers above the risk level or AI conviction recovers.",
    });
  }

  if (heldPastGrace && ctx.rankPercentile <= 25 && clearDeterioration) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "sell_action",
      severity: "critical",
      action: "sell",
      title: `Sell signal: ${ctx.ticker} has lost AI conviction`,
      message: `${ctx.ticker} is now bottom-quartile by StockGPT rank and has confirming deterioration.`,
      recommendation: "Sell the position and redeploy into a stronger-ranked stock. This is not just noise.",
      evidence: [`Rank percentile: ${ctx.rankPercentile}/100`, ctx.rank ? `Current rank: #${ctx.rank} of ${ctx.totalStocks}` : "Current rank unavailable", ...(scoreFromEntryPct !== null ? [`Score from entry: ${scoreFromEntryPct.toFixed(1)}%`] : []), ...(latestScorePct !== null ? [`Latest score move: ${latestScorePct.toFixed(1)}%`] : []), ...negativeEvidence.slice(0, 2)],
      priority: 2,
      expiresWhen: "This action disappears if the stock moves out of the bottom quartile or deterioration is no longer confirmed.",
    });
  }

  if (heldPastGrace && scoreFromEntryPct !== null && scoreFromEntryPct <= -25 && ctx.rankPercentile < 55 && (negativeEvidence.length > 0 || ctx.recentNegativeNewsCount >= 2)) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "sell_action",
      severity: "critical",
      action: "sell",
      title: `Sell signal: ${ctx.ticker} thesis has materially deteriorated`,
      message: `The score is down ${Math.abs(scoreFromEntryPct).toFixed(1)}% since entry and the current rank is no longer strong enough to defend it.`,
      recommendation: "Exit or cut heavily. Reassess only if the score and rank recover.",
      evidence: [`Score from entry: ${scoreFromEntryPct.toFixed(1)}%`, `Rank percentile: ${ctx.rankPercentile}/100`, ...negativeEvidence.slice(0, 3)],
      priority: 3,
      expiresWhen: "This action disappears if the score/rank recovery invalidates the sell condition.",
    });
  }

  if (overbuilt) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "trim_action",
      severity: "warning",
      action: "trim",
      title: `Trim signal: ${ctx.ticker} is too large in the portfolio`,
      message: `${ctx.ticker} is ${ctx.currentAllocationPct.toFixed(1)}% of the portfolio, above the ${maxConcentration}% risk threshold for this profile.`,
      recommendation: `Trim the position back toward ${Math.max(5, maxConcentration - 5)}–${maxConcentration}%.`,
      evidence: [`Current allocation: ${ctx.currentAllocationPct.toFixed(1)}%`, `Risk threshold: ${maxConcentration}%`, ...(ctx.targetAllocationPct !== null ? [`Target allocation: ${ctx.targetAllocationPct.toFixed(1)}%`] : ["No target allocation set"])],
      priority: 10,
      expiresWhen: "This action disappears once the position is no longer materially oversized.",
    });
  }

  if (heldPastGrace && scoreFromEntryPct !== null && scoreFromEntryPct <= -15 && ctx.rankPercentile < 65) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "trim_action",
      severity: "warning",
      action: "trim",
      title: `Trim signal: ${ctx.ticker} conviction is weakening`,
      message: `The score has fallen ${Math.abs(scoreFromEntryPct).toFixed(1)}% since entry and rank is no longer high-conviction.`,
      recommendation: "Trim rather than fully exit. Keep a smaller position only if the thesis still makes sense.",
      evidence: [`Score from entry: ${scoreFromEntryPct.toFixed(1)}%`, `Rank percentile: ${ctx.rankPercentile}/100`, ...negativeEvidence.slice(0, 2)],
      priority: 12,
      expiresWhen: "This action disappears if the score or rank recovers.",
    });
  }

  if (heldPastGrace && ctx.pnlPercent >= 35 && ctx.rankPercentile < 75) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "trim_action",
      severity: "warning",
      action: "trim",
      title: `Trim signal: protect gains in ${ctx.ticker}`,
      message: `${ctx.ticker} is up ${ctx.pnlPercent.toFixed(1)}%, but the AI rank is no longer top-tier.`,
      recommendation: "Trim part of the winner and keep a core position only if rank stabilises.",
      evidence: [`P&L: +${ctx.pnlPercent.toFixed(1)}%`, `Rank percentile: ${ctx.rankPercentile}/100`, ctx.technical.takeProfit ? `Nearest target area: ${money(ctx.technical.takeProfit)}` : "Technical target unavailable"],
      priority: 14,
      expiresWhen: "This action disappears if the rank improves or the position is no longer an extended winner.",
    });
  }

  if (heldPastGrace && ctx.rankPercentile >= 85 && sectorStrong && underbuilt && ctx.recentNegativeNewsCount === 0 && targetUpsidePct >= 7 && ctx.pnlPercent <= 22 && strongConfirmation) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "buy_more_action",
      severity: "success",
      action: "buy_more",
      title: `Buy-more signal: ${ctx.ticker} remains high-conviction`,
      message: `${ctx.ticker} is top-ranked, supported by sector strength, and is still underbuilt in the portfolio.`,
      recommendation: "Consider adding gradually. Do not chase with one large order.",
      evidence: [`Rank percentile: ${ctx.rankPercentile}/100`, `Sector momentum: ${ctx.sectorMomentum}`, `Current allocation: ${ctx.currentAllocationPct.toFixed(1)}%`, `Estimated upside to target zone: ${targetUpsidePct.toFixed(1)}%`, ...positiveEvidence.slice(0, 2)],
      priority: 20,
      expiresWhen: "This action disappears if rank, sector strength, allocation gap, upside, or news confirmation no longer supports adding.",
    });
  }

  const warningEventCount = eventAlerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical").length;

  if (ctx.daysSinceReview >= 90 || warningEventCount >= 2) {
    return makeAlert({
      ticker: ctx.ticker,
      category: "action",
      type: "review_action",
      severity: "info",
      action: "review",
      title: `Review required: ${ctx.ticker}`,
      message: ctx.daysSinceReview >= 90 ? `${ctx.ticker} has not been reviewed for ${ctx.daysSinceReview} days.` : `${ctx.ticker} has multiple active event alerts and needs a manual check.`,
      recommendation: "Review the stock page, recent news, AI score, rank and portfolio sizing. Then mark it reviewed.",
      evidence: [`Days since review: ${ctx.daysSinceReview}`, `Active warning events: ${warningEventCount}`],
      priority: 60,
      expiresWhen: "This action disappears once the position is reviewed and event pressure reduces.",
    });
  }

  return null;
}

function buildTriggers(ctx: AlertContext): HoldingTrigger[] {
  const triggers: HoldingTrigger[] = [];

  if (ctx.technical.stopLoss) {
    triggers.push({
      type: "stop_loss",
      icon: "shield",
      tone: "negative",
      priority: 1,
      condition: `If ${ctx.ticker} trades below ${money(ctx.technical.stopLoss)}`,
      action: ctx.rankPercentile >= 80 ? "Review first because AI conviction is still strong, but do not ignore a clean break." : "Treat this as an invalidation level and consider selling or cutting heavily.",
    });
  }

  if (ctx.technical.takeProfit) {
    triggers.push({
      type: "take_profit",
      icon: "target",
      tone: "positive",
      priority: 2,
      condition: `If ${ctx.ticker} approaches ${money(ctx.technical.takeProfit)}`,
      action: ctx.rankPercentile >= 85 ? "Do not fully sell an elite-ranked stock. Consider trimming only if oversized." : "Consider trimming part of the position and reassessing the remaining stake.",
    });
  }

  if (ctx.scoreAtEntry) {
    const scoreFloor = ctx.rankPercentile >= 85 ? Math.round(ctx.scoreAtEntry * 0.78) : ctx.rankPercentile >= 70 ? Math.round(ctx.scoreAtEntry * 0.74) : Math.round(ctx.scoreAtEntry * 0.7);
    triggers.push({
      type: "score_floor",
      icon: "warning",
      tone: "neutral",
      priority: 3,
      condition: `If AI score drops below ${scoreFloor.toLocaleString()}`,
      action: "Review the thesis. If rank is also weak, reduce or exit.",
    });
  }

  const reviewIn = Math.max(0, 90 - ctx.daysSinceReview);
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + reviewIn);

  triggers.push({
    type: "review",
    icon: "calendar",
    tone: "neutral",
    priority: 4,
    condition: reviewIn === 0 ? "Review is due now" : `Next review around ${reviewDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    action: "Check AI rank, score trend, news flow, technical levels and allocation size.",
  });

  return triggers.sort((a, b) => a.priority - b.priority);
}

function deriveRecommendation(actionAlerts: HoldingAlert[], ctx: AlertContext): EnrichedHolding["recommendation"] {
  const primaryAction = actionAlerts[0];

  if (primaryAction?.action === "sell") return ctx.currentAllocationPct < 5 ? "Sell Whole Position" : "Sell Immediately";
  if (primaryAction?.action === "trim") return "Consider Trimming";
  if (primaryAction?.action === "buy_more") return "Consider Buying More";
  if (primaryAction?.action === "review") return "Review Urgently";

  if (ctx.rankPercentile >= 85 && ctx.recentNegativeNewsCount === 0 && (ctx.sectorMomentum === "Strong" || ctx.sectorMomentum === "Booming")) {
    return "Strong Hold";
  }

  return "Hold";
}

function buildAISummary(ctx: AlertContext, actionAlerts: HoldingAlert[], eventAlerts: HoldingAlert[]) {
  const primaryAction = actionAlerts[0];
  if (primaryAction) return `${primaryAction.title}. ${primaryAction.recommendation}`;

  const warningEvents = eventAlerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical").length;
  const positiveEvents = eventAlerts.filter((alert) => alert.severity === "success").length;

  if (ctx.isRecentlyAdded) {
    return `${ctx.ticker} was added recently, so StockGPT is applying a grace period. It will only show action alerts if the signal is unusually strong or unusually weak.`;
  }

  if (warningEvents > 0) {
    return `${ctx.ticker} has ${warningEvents} event alert${warningEvents === 1 ? "" : "s"}, but no action alert. Something changed, but the evidence is not strong enough to recommend buying, trimming or selling.`;
  }

  if (positiveEvents > 0 && ctx.rankPercentile >= 75) {
    return `${ctx.ticker} has positive confirmation and no action is required. Hold while the rank and score remain healthy.`;
  }

  return `${ctx.ticker} has no active action signal. Current rank percentile is ${ctx.rankPercentile}/100, allocation is ${ctx.currentAllocationPct.toFixed(1)}%, and the position can be left alone for now.`;
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
  riskTolerance: RiskTolerance = null,
): Promise<EnrichedHolding[]> {
  if (holdings.length === 0) return [];

  const supabase = await createClient();
  const tickers = holdings.map((holding) => holding.ticker);

  const { data: currentData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score, price")
    .in("ticker", tickers);

  const fourteenDaysAgo = new Date(Date.now() - NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentNews } = await supabase
    .from("news_articles")
    .select("title, impact, affected_tickers, published_at")
    .gte("published_at", fourteenDaysAgo)
    .limit(300);

  const { data: factorDiagnosticsData } = await supabase
    .from("stock_factor_diagnostics")
    .select("ticker,updated_at,previous_score,current_score,smoothed_score,factor_coverage,quality_change,growth_change,value_change,momentum_change,risk_change,income_change,top_negative_factors,top_positive_factors,diagnosis");

  const { momentum, bullishPct, maxScore, totalStocks } = await getSectorData();

  const currentMap = new Map(((currentData ?? []) as any[]).map((row) => [String(row.ticker), row]));
  const diagnosticsMap = new Map(((factorDiagnosticsData ?? []) as any[]).map((row) => [String(row.ticker), row]));

  const newsByTicker: Record<string, { positive: number; negative: number; latestPositiveHeadline: string | null; latestNegativeHeadline: string | null }> = {};

  ((recentNews ?? []) as any[]).forEach((article) => {
    const affectedTickers: string[] = Array.isArray(article.affected_tickers)
      ? article.affected_tickers.map((ticker: unknown) => String(ticker))
      : [];
    const impact = String(article.impact ?? "").toLowerCase();
    const title = typeof article.title === "string" ? article.title : null;

    affectedTickers.forEach((ticker: string) => {
      if (!newsByTicker[ticker]) newsByTicker[ticker] = { positive: 0, negative: 0, latestPositiveHeadline: null, latestNegativeHeadline: null };
      if (impact === "positive") {
        newsByTicker[ticker].positive += 1;
        if (!newsByTicker[ticker].latestPositiveHeadline && title) newsByTicker[ticker].latestPositiveHeadline = title;
      }
      if (impact === "negative") {
        newsByTicker[ticker].negative += 1;
        if (!newsByTicker[ticker].latestNegativeHeadline && title) newsByTicker[ticker].latestNegativeHeadline = title;
      }
    });
  });

  const totalPortfolioValue = holdings.reduce((sum, holding) => {
    const current = currentMap.get(holding.ticker);
    const price = finiteNumber(current?.price, 0);
    const shares = finiteNumber(holding.shares, 1);
    return sum + price * shares;
  }, 0);

  const now = new Date();

  return await Promise.all(
    holdings.map(async (holding) => {
      const current = currentMap.get(holding.ticker);
      const ticker = holding.ticker;
      const score = finiteNumber(current?.score, 0);
      const currentPrice = finiteNumber(current?.price, 0);
      const entryPrice = finiteNumber(holding.entry_price, currentPrice);
      const sector = typeof current?.sector === "string" ? current.sector : null;
      const company = typeof current?.company === "string" ? current.company : null;
      const rank = nullableNumber(current?.rank);
      const shares = finiteNumber(holding.shares, 1);
      const costBasis = entryPrice * shares;
      const currentValue = currentPrice * shares;
      const totalPnLDollars = currentValue - costBasis;
      const currentAllocationPct = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;
      const scoreAtEntry = nullableNumber(holding.score_at_entry);
      const rankAtEntry = nullableNumber(holding.rank_at_entry);
      const scoreChange = score - (scoreAtEntry ?? score);
      const rankChange = rank && rankAtEntry ? rankAtEntry - rank : 0;
      const pnlDollars = currentPrice - entryPrice;
      const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
      const daysHeld = daysBetween(now, new Date(holding.added_at));
      const daysSinceReview = daysBetween(now, new Date(holding.last_reviewed_at));
      const isRecentlyAdded = daysHeld < RECENT_HOLDING_GRACE_DAYS;
      const sectorMomentum = sector ? momentum[sector] ?? "Unknown" : "Unknown";
      const sectorBullishPct = sector ? bullishPct[sector] ?? 0 : 0;
      const scorePercentile = Math.max(0, Math.min(100, Math.round((score / Math.max(maxScore, 1)) * 100)));
      const rankPercentile = rank ? Math.max(0, Math.min(100, Math.round((1 - (rank - 1) / Math.max(totalStocks - 1, 1)) * 100))) : scorePercentile || 50;
      const news = newsByTicker[ticker] ?? { positive: 0, negative: 0, latestPositiveHeadline: null, latestNegativeHeadline: null };
      const factorDiagnostics = diagnosticsMap.get(ticker) ?? null;
      const technical = await getTechnicalLevels(ticker, currentPrice);

      const ctx: AlertContext = {
        ticker,
        company,
        sector,
        score,
        scoreAtEntry,
        rank,
        rankAtEntry,
        currentPrice,
        entryPrice,
        pnlPercent,
        currentAllocationPct,
        targetAllocationPct: holding.allocation_pct,
        daysHeld,
        daysSinceReview,
        isRecentlyAdded,
        rankPercentile,
        scorePercentile,
        totalStocks,
        sectorMomentum,
        sectorBullishPct,
        recentNegativeNewsCount: news.negative,
        recentPositiveNewsCount: news.positive,
        latestNegativeHeadline: news.latestNegativeHeadline,
        latestPositiveHeadline: news.latestPositiveHeadline,
        riskTolerance,
        factorDiagnostics,
        technical,
      };

      const eventAlerts = buildEventAlerts(ctx);
      const actionAlert = buildActionAlert(ctx, eventAlerts);
      const actionAlerts = actionAlert ? [actionAlert] : [];
      const alerts = [...actionAlerts, ...eventAlerts].sort((a, b) => a.priority - b.priority);
      const recommendation = deriveRecommendation(actionAlerts, ctx);
      const triggers = buildTriggers(ctx);
      const aiSummary = buildAISummary(ctx, actionAlerts, eventAlerts);

      return {
        ticker,
        company,
        sector,
        rank,
        score,
        maxScore,
        currentPrice,
        entryPrice,
        shares,
        costBasis: round1(costBasis),
        currentValue: round1(currentValue),
        totalPnLDollars: round1(totalPnLDollars),
        currentAllocationPct: round1(currentAllocationPct),
        targetAllocationPct: holding.allocation_pct,
        scoreAtEntry,
        rankAtEntry,
        addedAt: holding.added_at,
        lastReviewedAt: holding.last_reviewed_at,
        daysHeld,
        pnlDollars: round1(pnlDollars),
        pnlPercent: round1(pnlPercent),
        scoreChange,
        rankChange,
        daysSinceReview,
        alerts,
        eventAlerts,
        actionAlerts,
        recommendation,
        sectorMomentum,
        sectorBullishPct,
        scorePercentile,
        rankPercentile,
        triggers,
        aiSummary,
        isRecentlyAdded,
      };
    }),
  );
}
