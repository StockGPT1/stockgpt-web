import { createClient } from "@/utils/supabase/server";

export type TradeLevels = {
  recommendation: "Strong Buy" | "Buy" | "Hold / Watch" | "Avoid";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  stopPct: number; // e.g. 6.5 for 6.5%
  targetPct: number;
  riskReward: number; // e.g. 2.3
  confidence: number; // 0–1
  factors: {
    label: string;
    value: string;
    note: string;
  }[];
};

// Sector → volatility multiplier (1.0 = baseline)
// Higher = wider stops/targets needed
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

/**
 * Compute entry / stop / target levels for a stock, factoring in:
 *   - Current price (anchor)
 *   - AI score (model confidence)
 *   - Rank (relative strength among 500)
 *   - Sector (volatility profile)
 *   - Recent news sentiment for this ticker (current narrative)
 */
export async function calculateTradeLevels({
  ticker,
  price,
  score,
  rank,
  sector,
}: {
  ticker: string;
  price: number;
  score: number;
  rank: number | null;
  sector: string | null;
}): Promise<TradeLevels | null> {
  if (!Number.isFinite(price) || price <= 0) return null;

  const supabase = await createClient();

  // ── Pull recent news for this ticker (last 14 days, max 30 articles)
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: recentNews } = await supabase
    .from("news_articles")
    .select("impact,affected_tickers")
    .gte("published_at", fourteenDaysAgo)
    .order("published_at", { ascending: false })
    .limit(150);

  const tickerNews = (recentNews ?? []).filter((n) => {
    const tickers = Array.isArray(n.affected_tickers)
      ? n.affected_tickers
      : [];
    return tickers.includes(ticker);
  });

  const newsCount = tickerNews.length;
  const positiveCount = tickerNews.filter(
    (n) => (n.impact ?? "").toLowerCase() === "positive"
  ).length;
  const negativeCount = tickerNews.filter(
    (n) => (n.impact ?? "").toLowerCase() === "negative"
  ).length;
  const neutralCount = newsCount - positiveCount - negativeCount;

  // News sentiment normalised to 0–1 (0.5 = neutral or no news)
  const newsNorm =
    newsCount === 0
      ? 0.5
      : (positiveCount + neutralCount * 0.5) / newsCount;

  // ── Confidence components (each 0–1)
  const scoreNorm = Math.min(Math.max(score / 10000, 0), 1);
  const rankNorm = rank ? Math.max(0, 1 - (rank - 1) / 499) : 0.5;

  // Weighted confidence
  const confidence =
    scoreNorm * 0.6 + rankNorm * 0.25 + newsNorm * 0.15;

  // ── Volatility profile from sector
  const baseVol = SECTOR_VOLATILITY[sector ?? ""] ?? 1.0;
  // Less confident → treat as more volatile (wider stops)
  const adjVol = baseVol * (1 + (1 - confidence) * 0.15);

  // ── Stop loss & take profit percentages
  // stop:    4% (high conf, low vol)  →  ~13% (low conf, high vol)
  // target:  8% (low conf, low vol)   →  ~32% (high conf, high vol)
  const stopPct = (0.04 + (1 - confidence) * 0.06) * adjVol;
  const targetPct = (0.08 + confidence * 0.18) * adjVol;

  // ── Entry: high confidence buys at market, low confidence waits for a dip
  const entryDiscount =
    confidence >= 0.7 ? 0 : confidence >= 0.45 ? 0.015 : 0.03;

  const entry = price * (1 - entryDiscount);
  const stopLoss = entry * (1 - stopPct);
  const takeProfit = entry * (1 + targetPct);
  const riskReward = targetPct / stopPct;

  // ── Recommendation
  let recommendation: TradeLevels["recommendation"];
  if (confidence >= 0.75) recommendation = "Strong Buy";
  else if (confidence >= 0.55) recommendation = "Buy";
  else if (confidence >= 0.35) recommendation = "Hold / Watch";
  else recommendation = "Avoid";

  // ── Build a human-readable factor breakdown
  const factors: TradeLevels["factors"] = [
    {
      label: "AI Score",
      value: score.toLocaleString(),
      note:
        scoreNorm >= 0.85
          ? "Top-tier signal"
          : scoreNorm >= 0.7
            ? "Strong signal"
            : scoreNorm >= 0.5
              ? "Moderate signal"
              : "Weak signal",
    },
    {
      label: "Rank",
      value: rank ? `#${rank} of 500` : "—",
      note:
        rankNorm >= 0.9
          ? "Top 10%"
          : rankNorm >= 0.75
            ? "Top quartile"
            : rankNorm >= 0.5
              ? "Above median"
              : "Below median",
    },
    {
      label: "Sector",
      value: sector ?? "—",
      note: describeVolatility(baseVol),
    },
    {
      label: "Recent news",
      value:
        newsCount === 0
          ? "No recent coverage"
          : `${newsCount} article${newsCount === 1 ? "" : "s"} (14d)`,
      note:
        newsCount === 0
          ? "Treated as neutral"
          : `${positiveCount} positive · ${negativeCount} negative · ${neutralCount} neutral`,
    },
  ];

  return {
    recommendation,
    entry: round(entry, 2),
    stopLoss: round(stopLoss, 2),
    takeProfit: round(takeProfit, 2),
    stopPct: round(stopPct * 100, 1),
    targetPct: round(targetPct * 100, 1),
    riskReward: round(riskReward, 1),
    confidence: round(confidence, 2),
    factors,
  };
}
