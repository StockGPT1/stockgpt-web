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

function describeVolatility(vol: number) {
  if (vol >= 1.2) return "high volatility";
  if (vol >= 1.05) return "moderate volatility";
  if (vol >= 0.85) return "average volatility";
  return "low volatility";
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Cache the max score once per server invocation ──
let cachedMaxScore: number | null = null;
let cachedAt = 0;
async function getMaxScore(): Promise<number> {
  // Refresh cache every 5 minutes
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
  ticker, confidence, entry, stopLoss, takeProfit, stopPct, targetPct, score, rank, sector,
}: {
  ticker: string; confidence: number; entry: number; stopLoss: number; takeProfit: number;
  stopPct: number; targetPct: number; score: number; rank: number | null; sector: string | null;
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

  const thesis = `Based on ${ticker}'s ${confidenceDesc} AI signal (rank #${rank ?? "—"}, score ${score.toLocaleString()}) and ${sectorDesc}, the model projects roughly ${expectedAnnualReturn}% annual return with target reached in ${expectedMonthsToTarget} months. Hold for ${recommendedHoldPeriod}, reviewing progress halfway through.`;

  const triggers: TradeTrigger[] = [
    {
      type: "take_profit", icon: "target", tone: "positive",
      condition: `If ${ticker} reaches $${takeProfit.toFixed(2)}`,
      action: `Take profit (+${targetPct}%) — likely by ${formatMonth(targetDate)}`,
    },
    {
      type: "stop_loss", icon: "shield", tone: "negative",
      condition: `If ${ticker} falls to $${stopLoss.toFixed(2)}`,
      action: `Cut loss (−${stopPct}%) to protect capital`,
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
    expectedAnnualReturn, expectedMonthsToTarget,
    expectedTargetDate: formatMonth(targetDate),
    reviewDate: formatMonth(reviewDate),
    recommendedHoldPeriod, thesis, triggers,
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

  // ✦ Dynamic score normalization (no 10k cap)
  const scoreNorm = Math.min(Math.max(score / maxScore, 0), 1);
  const rankNorm = rank ? Math.max(0, 1 - (rank - 1) / 499) : 0.5;

  const confidence = scoreNorm * 0.6 + rankNorm * 0.25 + newsNorm * 0.15;

  const baseVol = SECTOR_VOLATILITY[sector ?? ""] ?? 1.0;
  const adjVol = baseVol * (1 + (1 - confidence) * 0.15);

  const stopPct = (0.04 + (1 - confidence) * 0.06) * adjVol;
  const targetPct = (0.08 + confidence * 0.18) * adjVol;

  const entryDiscount = confidence >= 0.7 ? 0 : confidence >= 0.45 ? 0.015 : 0.03;
  const entry = price * (1 - entryDiscount);
  const stopLoss = entry * (1 - stopPct);
  const takeProfit = entry * (1 + targetPct);
  const riskReward = targetPct / stopPct;

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
    { label: "Sector", value: sector ?? "—", note: describeVolatility(baseVol) },
    {
      label: "Recent news",
      value: newsCount === 0 ? "No recent coverage" : `${newsCount} article${newsCount === 1 ? "" : "s"} (14d)`,
      note: newsCount === 0 ? "Treated as neutral"
        : `${positiveCount} positive · ${negativeCount} negative · ${neutralCount} neutral`,
    },
  ];

  const plan = recommendation !== "Avoid" ? buildTradePlan({
    ticker, confidence,
    entry: round(entry, 2), stopLoss: round(stopLoss, 2), takeProfit: round(takeProfit, 2),
    stopPct: round(stopPct * 100, 1), targetPct: round(targetPct * 100, 1),
    score, rank, sector,
  }) : null;

  return {
    recommendation,
    entry: round(entry, 2), stopLoss: round(stopLoss, 2), takeProfit: round(takeProfit, 2),
    stopPct: round(stopPct * 100, 1), targetPct: round(targetPct * 100, 1),
    riskReward: round(riskReward, 1), confidence: round(confidence, 2),
    factors, plan,
  };
}
