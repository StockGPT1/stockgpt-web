import { getStockChart } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";

export type TradeLevels = {
  recommendation: "Strong Buy" | "Buy" | "Hold / Watch" | "Avoid";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  stopPct: number;
  targetPct: number;
  riskReward: number;
  confidence: number;
  factors: { label: string; value: string; note: string }[];
  plan: TradePlan | null;
};

export type TradePlan = {
  expectedAnnualReturn: number;
  expectedMonthsToTarget: number;
  expectedTargetDate: string;
  reviewDate: string;
  recommendedHoldPeriod: string;
  thesis: string;
  triggers: TradeTrigger[];
};

export type TradeTrigger = {
  type: "take_profit" | "stop_loss" | "score_drop" | "rank_drop" | "review";
  icon: "target" | "shield" | "warning" | "calendar";
  condition: string;
  action: string;
  tone: "positive" | "negative" | "neutral";
};

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

const SECTOR_VOLATILITY: Record<string, number> = {
  Technology: 1.25,
  "Information Technology": 1.25,
  Energy: 1.4,
  Utilities: 0.65,
  "Consumer Staples": 0.75,
  Healthcare: 1.0,
  "Health Care": 1.0,
  Financials: 1.05,
  Industrials: 0.95,
  "Communication Services": 1.1,
  "Consumer Discretionary": 1.2,
  "Real Estate": 0.95,
  Materials: 1.15,
};

function round(n: number, decimals: number) {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
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
    const points = chart["6M"] && chart["6M"]!.length >= 80 ? chart["6M"]! : chart["1Y"] ?? [];
    const closes = points
      .map((point) => Number(point.close))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (closes.length < 40) {
      return {
        support: null,
        resistance: null,
        swingLow: null,
        swingHigh: null,
        ma50: null,
        ma200: null,
        atrPct: null,
        source: "fallback",
      };
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
    return {
      support: null,
      resistance: null,
      swingLow: null,
      swingHigh: null,
      ma50: null,
      ma200: null,
      atrPct: null,
      source: "fallback",
    };
  }
}

function describeVolatility(vol: number) {
  if (vol >= 1.2) return "high volatility";
  if (vol >= 1.05) return "moderate volatility";
  if (vol >= 0.85) return "average volatility";
  return "low volatility";
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

let cachedMaxScore: number | null = null;
let cachedAt = 0;
async function getMaxScore(): Promise<number> {
  if (cachedMaxScore && Date.now() - cachedAt < 5 * 60 * 1000) {
    return cachedMaxScore;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_rankings")
    .select("score")
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  cachedMaxScore = Math.max(Number(data?.score) || 10000, 1);
  cachedAt = Date.now();
  return cachedMaxScore;
}

function buildTradePlan({
  ticker,
  confidence,
  entry,
  stopLoss,
  takeProfit,
  stopPct,
  targetPct,
  score,
  rank,
  sector,
  technical,
}: {
  ticker: string;
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  stopPct: number;
  targetPct: number;
  score: number;
  rank: number | null;
  sector: string | null;
  technical: TechnicalLevels;
}): TradePlan {
  const expectedAnnualReturn = round(4 + confidence * 12, 1);
  const expectedMonthsToTarget = Math.max(3, Math.round((targetPct / expectedAnnualReturn) * 12));

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setMonth(now.getMonth() + expectedMonthsToTarget);

  const reviewDate = new Date(now);
  reviewDate.setMonth(now.getMonth() + Math.max(3, Math.round(expectedMonthsToTarget / 2)));

  const holdMin = Math.round(expectedMonthsToTarget * 0.7);
  const holdMax = Math.round(expectedMonthsToTarget * 1.3);
  const recommendedHoldPeriod = `${holdMin}–${holdMax} months`;

  const sectorDesc = sector
    ? `${sector} ${describeVolatility(SECTOR_VOLATILITY[sector] ?? 1.0)}`
    : "current dynamics";
  const confidenceDesc =
    confidence >= 0.75 ? "exceptionally strong"
    : confidence >= 0.55 ? "strong"
    : confidence >= 0.35 ? "moderate"
    : "weak";

  const levelDesc = technical.source === "technical"
    ? technical.support
      ? `with the stop set below support near $${technical.support.toFixed(2)}`
      : technical.ma50
        ? `with the stop set around the 50-day area near $${technical.ma50.toFixed(2)}`
        : "with technical levels checked but no clean nearby support found"
    : "using fallback percentage levels because chart structure was unavailable";

  const thesis = `Based on ${ticker}'s ${confidenceDesc} AI signal (rank #${rank ?? "—"}, score ${score.toLocaleString()}), ${sectorDesc}, and chart structure, the model targets $${takeProfit.toFixed(2)} and uses $${stopLoss.toFixed(2)} as the invalidation level, ${levelDesc}.`;

  const targetReason = technical.resistance
    ? `near prior resistance around $${technical.resistance.toFixed(2)}`
    : "using a breakout-extension target because price is already above nearby resistance";

  const stopReason = technical.support
    ? `below support around $${technical.support.toFixed(2)}`
    : technical.ma50
      ? `below the 50-day area around $${technical.ma50.toFixed(2)}`
      : "using volatility fallback because no clean support was detected";

  const triggers: TradeTrigger[] = [
    {
      type: "take_profit", icon: "target", tone: "positive",
      condition: `If ${ticker} approaches $${takeProfit.toFixed(2)}`,
      action: `Take partial profit (${targetReason}; +${targetPct}%) — likely by ${formatMonth(targetDate)}`,
    },
    {
      type: "stop_loss", icon: "shield", tone: "negative",
      condition: `If ${ticker} breaks $${stopLoss.toFixed(2)}`,
      action: `Cut or trim (${stopReason}; −${stopPct}%) to protect capital`,
    },
    {
      type: "score_drop", icon: "warning", tone: "neutral",
      condition: `If AI score drops by 25% from current`,
      action: `Reassess thesis — model conviction has weakened`,
    },
    {
      type: "review", icon: "calendar", tone: "neutral",
      condition: `On ${formatMonth(reviewDate)}`,
      action: `Mid-position review regardless of price action`,
    },
  ];

  return {
    expectedAnnualReturn,
    expectedMonthsToTarget,
    expectedTargetDate: formatMonth(targetDate),
    reviewDate: formatMonth(reviewDate),
    recommendedHoldPeriod,
    thesis,
    triggers,
  };
}

export async function calculateTradeLevels({
  ticker, price, score, rank, sector,
}: {
  ticker: string; price: number; score: number; rank: number | null; sector: string | null;
}): Promise<TradeLevels | null> {
  if (!Number.isFinite(price) || price <= 0) return null;

  const supabase = await createClient();
  const maxScore = await getMaxScore();
  const technical = await getTechnicalLevels(ticker, price);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNews } = await supabase
    .from("news_articles")
    .select("impact,affected_tickers")
    .gte("published_at", fourteenDaysAgo)
    .order("published_at", { ascending: false })
    .limit(150);

  const tickerNews = (recentNews ?? []).filter((n) => {
    const tickers = Array.isArray(n.affected_tickers) ? n.affected_tickers : [];
    return tickers.includes(ticker);
  });

  const newsCount = tickerNews.length;
  const positiveCount = tickerNews.filter((n) => (n.impact ?? "").toLowerCase() === "positive").length;
  const negativeCount = tickerNews.filter((n) => (n.impact ?? "").toLowerCase() === "negative").length;
  const neutralCount = newsCount - positiveCount - negativeCount;

  const newsNorm = newsCount === 0 ? 0.5 : (positiveCount + neutralCount * 0.5) / newsCount;
  const scoreNorm = Math.min(Math.max(score / maxScore, 0), 1);
  const rankNorm = rank ? Math.max(0, 1 - (rank - 1) / 499) : 0.5;
  const confidence = scoreNorm * 0.6 + rankNorm * 0.25 + newsNorm * 0.15;

  const baseVol = SECTOR_VOLATILITY[sector ?? ""] ?? 1.0;
  const normalNoisePct = Math.min(12, Math.max(4, (technical.atrPct ?? 2.0) * 2.2));

  const rankBufferPct = confidence >= 0.75 ? 2.2 : confidence >= 0.55 ? 1.7 : confidence >= 0.35 ? 1.2 : 0.8;
  const fallbackStopPct = Math.min(
    confidence >= 0.75 ? 17 : confidence >= 0.55 ? 14 : confidence >= 0.35 ? 11 : 7,
    Math.max(
      confidence >= 0.75 ? 10 : confidence >= 0.55 ? 8 : confidence >= 0.35 ? 6 : 4.5,
      normalNoisePct + (confidence >= 0.75 ? 4 : confidence >= 0.55 ? 2.5 : 0),
    ),
  );

  const supportStop = technical.support && technical.support < price
    ? technical.support * (1 - rankBufferPct / 100)
    : null;
  const maStop = technical.ma50 && technical.ma50 < price
    ? technical.ma50 * (1 - Math.max(1.1, rankBufferPct - 0.5) / 100)
    : null;
  const fallbackStop = price * (1 - fallbackStopPct / 100);

  const candidateStops = [supportStop, maStop, fallbackStop]
    .filter((value): value is number => Boolean(value && Number.isFinite(value) && value > 0 && value < price));

  let stopLoss = candidateStops.length ? Math.max(...candidateStops) : fallbackStop;
  const stopDistancePct = ((price - stopLoss) / price) * 100;
  if (stopDistancePct < Math.max(3.5, normalNoisePct * 0.75)) {
    stopLoss = fallbackStop;
  }

  const resistanceTarget = technical.resistance && technical.resistance > price
    ? technical.resistance * 0.995
    : null;
  const recentRange = technical.support && technical.resistance
    ? Math.max(technical.resistance - technical.support, price * 0.08)
    : price * (confidence >= 0.75 ? 0.28 : confidence >= 0.55 ? 0.20 : 0.14);
  const breakoutTarget = price + recentRange * (confidence >= 0.75 ? 1.0 : confidence >= 0.55 ? 0.75 : 0.55);
  const takeProfit = resistanceTarget && resistanceTarget > price * 1.03 ? resistanceTarget : breakoutTarget;

  const entryDiscount = confidence >= 0.7 ? 0 : confidence >= 0.45 ? 0.015 : 0.03;
  const entry = price * (1 - entryDiscount);
  const adjustedStopLoss = Math.min(stopLoss, entry * 0.995);
  const adjustedTakeProfit = Math.max(takeProfit, entry * 1.04);

  const stopPct = ((entry - adjustedStopLoss) / entry) * 100;
  const targetPct = ((adjustedTakeProfit - entry) / entry) * 100;
  const riskReward = targetPct / Math.max(stopPct, 0.1);

  let recommendation: TradeLevels["recommendation"];
  if (confidence >= 0.75) recommendation = "Strong Buy";
  else if (confidence >= 0.55) recommendation = "Buy";
  else if (confidence >= 0.35) recommendation = "Hold / Watch";
  else recommendation = "Avoid";

  const factors: TradeLevels["factors"] = [
    {
      label: "AI Score", value: score.toLocaleString(),
      note: scoreNorm >= 0.85 ? "Top-tier signal"
        : scoreNorm >= 0.7 ? "Strong signal"
        : scoreNorm >= 0.5 ? "Moderate signal"
        : "Weak signal",
    },
    {
      label: "Rank", value: rank ? `#${rank} of 500` : "—",
      note: rankNorm >= 0.9 ? "Top 10%"
        : rankNorm >= 0.75 ? "Top quartile"
        : rankNorm >= 0.5 ? "Above median"
        : "Below median",
    },
    {
      label: "Technical stop",
      value: technical.support ? `$${technical.support.toFixed(2)}` : technical.ma50 ? `$${technical.ma50.toFixed(2)}` : "Fallback",
      note: technical.support ? "Nearest support" : technical.ma50 ? "50-day area" : "No clean support found",
    },
    {
      label: "Technical target",
      value: technical.resistance ? `$${technical.resistance.toFixed(2)}` : "Breakout extension",
      note: technical.resistance ? "Prior resistance" : "Above nearby resistance",
    },
    { label: "Sector", value: sector ?? "—", note: describeVolatility(baseVol) },
    {
      label: "Recent news",
      value: newsCount === 0 ? "No recent coverage" : `${newsCount} article${newsCount === 1 ? "" : "s"} (14d)`,
      note: newsCount === 0 ? "Treated as neutral"
        : `${positiveCount} positive · ${negativeCount} negative · ${neutralCount} neutral`,
    },
  ];

  const roundedEntry = round(entry, 2);
  const roundedStop = round(adjustedStopLoss, 2);
  const roundedTarget = round(adjustedTakeProfit, 2);
  const roundedStopPct = round(stopPct, 1);
  const roundedTargetPct = round(targetPct, 1);

  const plan = recommendation !== "Avoid" ? buildTradePlan({
    ticker,
    confidence,
    entry: roundedEntry,
    stopLoss: roundedStop,
    takeProfit: roundedTarget,
    stopPct: roundedStopPct,
    targetPct: roundedTargetPct,
    score,
    rank,
    sector,
    technical,
  }) : null;

  return {
    recommendation,
    entry: roundedEntry,
    stopLoss: roundedStop,
    takeProfit: roundedTarget,
    stopPct: roundedStopPct,
    targetPct: roundedTargetPct,
    riskReward: round(riskReward, 1),
    confidence: round(confidence, 2),
    factors,
    plan,
  };
}
