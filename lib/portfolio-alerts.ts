import { createClient } from "@/utils/supabase/server";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertType =
  | "score_drop" | "score_rise" | "rank_drop" | "rank_rise"
  | "price_target" | "price_stop" | "review_due"
  | "negative_news" | "positive_news"
  | "sector_weak" | "sector_strong";

export type HoldingAlert = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
};

// ✦ Better sector labels — descriptive, not vague
export type SectorMomentum =
  | "Booming"      // 50%+ bullish — strong tailwind
  | "Strong"       // 35-50% bullish — supportive
  | "Mixed"        // 20-35% — sideways
  | "Weak"         // 10-20% — headwind
  | "Struggling"   // <10% — major headwind
  | "Unknown";

export type EnrichedHolding = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number;
  maxScore: number; // for context
  currentPrice: number;
  entryPrice: number;
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
  recommendation: "Hold" | "Consider Buying More" | "Consider Trimming" | "Strong Hold" | "Review Urgently";
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number; // % of sector stocks bullish
  scorePercentile: number; // 0-100, where this stock ranks vs all
  // ✦ NEW: detailed if-then triggers per holding
  triggers: HoldingTrigger[];
  // ✦ NEW: contextual one-liner about AI's view
  aiSummary: string;
};

export type HoldingTrigger = {
  type: "stop_sell" | "take_profit" | "score_alert" | "review" | "rebalance";
  icon: "shield" | "target" | "warning" | "calendar" | "scales";
  condition: string;
  action: string;
  dateEstimate?: string;
  tone: "positive" | "negative" | "neutral";
};

async function getSectorData(): Promise<{
  momentum: Record<string, SectorMomentum>;
  bullishPct: Record<string, number>;
  maxScore: number;
}> {
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("stock_rankings")
    .select("score")
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxScore = Math.max(Number(maxRow?.score) || 10000, 1);
  const bullishThreshold = maxScore * 0.7;

  const { data: allStocks } = await supabase
    .from("stock_rankings")
    .select("sector, score");

  const bySector: Record<string, { total: number; bullish: number }> = {};
  (allStocks ?? []).forEach((s) => {
    const sector = s.sector ?? "—";
    if (!bySector[sector]) bySector[sector] = { total: 0, bullish: 0 };
    bySector[sector].total++;
    if (Number(s.score) >= bullishThreshold) bySector[sector].bullish++;
  });

  const momentum: Record<string, SectorMomentum> = {};
  const bullishPct: Record<string, number> = {};
  Object.entries(bySector).forEach(([sector, { total, bullish }]) => {
    const pct = total > 0 ? Math.round((bullish / total) * 100) : 0;
    bullishPct[sector] = pct;
    if (pct >= 50) momentum[sector] = "Booming";
    else if (pct >= 35) momentum[sector] = "Strong";
    else if (pct >= 20) momentum[sector] = "Mixed";
    else if (pct >= 10) momentum[sector] = "Weak";
    else momentum[sector] = "Struggling";
  });
  return { momentum, bullishPct, maxScore };
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ✦ Build specific, actionable alerts with dollar amounts where possible
function buildAlerts({
  ticker, scoreChange, pnlPercent, daysSinceReview, scoreAtEntry, score,
  rank, rankAtEntry, recentNegativeNewsCount, recentPositiveNewsCount,
  sectorMomentum, sectorBullishPct, sector, currentPrice, entryPrice,
}: {
  ticker: string; scoreChange: number; pnlPercent: number;
  daysSinceReview: number; scoreAtEntry: number | null; score: number;
  rank: number | null; rankAtEntry: number | null;
  recentNegativeNewsCount: number; recentPositiveNewsCount: number;
  sectorMomentum: SectorMomentum; sectorBullishPct: number;
  sector: string | null; currentPrice: number; entryPrice: number;
}): HoldingAlert[] {
  const alerts: HoldingAlert[] = [];

  if (scoreAtEntry && scoreAtEntry > 0) {
    const dropPct = (scoreChange / scoreAtEntry) * 100;
    if (dropPct <= -25) {
      alerts.push({
        type: "score_drop", severity: "critical",
        title: `${ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `When you bought, the AI scored ${ticker} at ${scoreAtEntry.toLocaleString()}. It's now ${score.toLocaleString()} — a major shift in the model's view.`,
        recommendation: `Strongly consider selling. The reason you bought no longer applies. If you hold, set a tight stop-loss.`,
      });
    } else if (dropPct <= -12) {
      alerts.push({
        type: "score_drop", severity: "warning",
        title: `${ticker} AI score weakened ${Math.abs(Math.round(dropPct))}%`,
        message: `Score moved from ${scoreAtEntry.toLocaleString()} to ${score.toLocaleString()}. Still positive, but the AI is less confident.`,
        recommendation: `Don't add more. If score drops another 10%, sell at least half your position.`,
      });
    } else if (dropPct >= 12) {
      alerts.push({
        type: "score_rise", severity: "success",
        title: `${ticker} AI conviction is rising — up ${Math.round(dropPct)}%`,
        message: `Score moved from ${scoreAtEntry.toLocaleString()} to ${score.toLocaleString()}. The AI is more confident than when you bought.`,
        recommendation: `Hold this position. If price dips 5–8%, that's a buy-more opportunity.`,
      });
    }
  }

  if (rank && rankAtEntry) {
    const rankShift = rankAtEntry - rank;
    if (rankShift <= -50) {
      alerts.push({
        type: "rank_drop", severity: "warning",
        title: `${ticker} fell ${Math.abs(rankShift)} places in the rankings`,
        message: `You bought at rank #${rankAtEntry}. It's now #${rank}. Other stocks are now scoring better than ${ticker}.`,
        recommendation: `Compare against ${ticker}'s sector peers. If alternatives look stronger, consider rotating.`,
      });
    } else if (rankShift >= 30) {
      alerts.push({
        type: "rank_rise", severity: "success",
        title: `${ticker} climbed ${rankShift} places in the rankings`,
        message: `From #${rankAtEntry} to #${rank}. Strong relative outperformance.`,
        recommendation: `Hold the winner. Don't take profits early — this is the kind of position that compounds.`,
      });
    }
  }

  if (recentNegativeNewsCount >= 3) {
    alerts.push({
      type: "negative_news", severity: "warning",
      title: `${recentNegativeNewsCount} negative articles about ${ticker} in the last 14 days`,
      message: "When this many negative pieces stack up, the market often follows.",
      recommendation: `Read the news section. If concerns are about earnings or fundamentals, sell. If it's just noise, hold.`,
    });
  } else if (recentPositiveNewsCount >= 4) {
    alerts.push({
      type: "positive_news", severity: "success",
      title: `${ticker} has ${recentPositiveNewsCount} positive articles recently`,
      message: "Strong positive narrative building — typically supports the share price.",
      recommendation: `This is a hold-and-watch position. If the AI score also rises, consider adding.`,
    });
  }

  if (pnlPercent >= 25) {
    const targetSellPrice = currentPrice * 1.05;
    alerts.push({
      type: "price_target", severity: "info",
      title: `${ticker} is up ${Math.round(pnlPercent)}% — strong gain`,
      message: `You're up ${pnlPercent.toFixed(1)}% from your entry of $${entryPrice.toFixed(2)}.`,
      recommendation: `Consider selling 25–33% of your position to lock in profits. If it hits $${targetSellPrice.toFixed(2)}, sell another quarter.`,
    });
  } else if (pnlPercent <= -15) {
    const stopPrice = currentPrice * 0.95;
    alerts.push({
      type: "price_stop", severity: "warning",
      title: `${ticker} is down ${Math.abs(Math.round(pnlPercent))}% from your entry`,
      message: `You're down ${Math.abs(pnlPercent).toFixed(1)}% from $${entryPrice.toFixed(2)}.`,
      recommendation: `If AI score is still strong, this is a buy-more opportunity. If it drops below $${stopPrice.toFixed(2)}, sell — your thesis is wrong.`,
    });
  }

  if (sectorMomentum === "Struggling" && scoreChange < 0) {
    alerts.push({
      type: "sector_weak", severity: "warning",
      title: `${sector ?? "This"} sector is struggling — only ${sectorBullishPct}% of stocks bullish`,
      message: `Most stocks in ${sector ?? "this sector"} are underperforming right now. ${ticker} is fighting headwinds.`,
      recommendation: `Sector rotation may be worth considering. Move money toward "Booming" sectors like Tech or Communication Services.`,
    });
  } else if (sectorMomentum === "Weak" && scoreChange < 0) {
    alerts.push({
      type: "sector_weak", severity: "warning",
      title: `${sector ?? "This"} sector is weak right now`,
      message: `Only ${sectorBullishPct}% of ${sector ?? "sector"} stocks have strong AI scores. Headwind for ${ticker}.`,
      recommendation: `Wait it out if score is still good. If sector AND your stock weaken, rotate to a stronger sector.`,
    });
  } else if (sectorMomentum === "Booming") {
    alerts.push({
      type: "sector_strong", severity: "success",
      title: `${sector ?? "This"} sector is booming — ${sectorBullishPct}% of stocks bullish`,
      message: `Strong sector tailwind. When most peers are rising, ${ticker} is more likely to follow.`,
      recommendation: `Strong "buy more" candidate if you have cash. Sector momentum is a real edge.`,
    });
  }

  if (daysSinceReview >= 90) {
    alerts.push({
      type: "review_due", severity: "info",
      title: `${ticker} hasn't been reviewed in ${daysSinceReview} days`,
      message: "Quarterly review is best practice. Check the AI Trade Plan and decide: hold, trim, or add.",
      recommendation: `Open the stock page, look at the latest score and news, then mark as reviewed.`,
    });
  }

  return alerts;
}

function deriveRecommendation(alerts: HoldingAlert[]): EnrichedHolding["recommendation"] {
  if (alerts.some((a) => a.severity === "critical")) return "Review Urgently";
  const warnings = alerts.filter((a) => a.severity === "warning").length;
  const successes = alerts.filter((a) => a.severity === "success").length;
  if (warnings >= 2) return "Consider Trimming";
  if (successes >= 2 && warnings === 0) return "Consider Buying More";
  if (successes >= 1 && warnings === 0) return "Strong Hold";
  return "Hold";
}

// ✦ Build concrete if-then triggers with dollar amounts and dates
function buildTriggers({
  ticker, currentPrice, entryPrice, score, scoreAtEntry, sector, sectorMomentum,
  daysSinceReview,
}: {
  ticker: string; currentPrice: number; entryPrice: number;
  score: number; scoreAtEntry: number | null; sector: string | null;
  sectorMomentum: SectorMomentum; daysSinceReview: number;
}): HoldingTrigger[] {
  const triggers: HoldingTrigger[] = [];
  const now = new Date();

  // Stop loss based on entry, not current
  const stopPrice = entryPrice * 0.92; // 8% below entry
  triggers.push({
    type: "stop_sell", icon: "shield", tone: "negative",
    condition: `If ${ticker} drops to $${stopPrice.toFixed(2)}`,
    action: `Sell — your downside protection. ${currentPrice <= stopPrice ? "⚠️ TRIGGERED" : `Currently $${(currentPrice - stopPrice).toFixed(2)} above this level`}`,
  });

  // Take profit at +20%
  const takeProfit1 = entryPrice * 1.20;
  triggers.push({
    type: "take_profit", icon: "target", tone: "positive",
    condition: `If ${ticker} reaches $${takeProfit1.toFixed(2)}`,
    action: `Sell 25–33% to lock in profits. ${currentPrice >= takeProfit1 ? "🎯 HIT — consider taking profits" : `Need ${((takeProfit1 / currentPrice - 1) * 100).toFixed(1)}% more`}`,
  });

  // Take profit at +35%
  const takeProfit2 = entryPrice * 1.35;
  triggers.push({
    type: "take_profit", icon: "target", tone: "positive",
    condition: `If ${ticker} reaches $${takeProfit2.toFixed(2)}`,
    action: `Sell another 25%. Let the rest run as a winner.`,
  });

  // Score-based trigger
  if (scoreAtEntry) {
    const scoreThreshold = Math.round(scoreAtEntry * 0.75);
    triggers.push({
      type: "score_alert", icon: "warning", tone: "neutral",
      condition: `If AI score drops below ${scoreThreshold.toLocaleString()}`,
      action: `Reassess. The AI's view has changed materially. Currently ${score.toLocaleString()}.`,
    });
  }

  // Quarterly review date
  const reviewIn = Math.max(0, 90 - daysSinceReview);
  const reviewDate = new Date(now);
  reviewDate.setDate(now.getDate() + reviewIn);
  triggers.push({
    type: "review", icon: "calendar", tone: "neutral",
    condition: reviewIn <= 0 ? "Review overdue" : `Review on ${reviewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    action: reviewIn <= 0 ? "Open the stock page now and reassess." : `Calendar block: check AI score, news, and trade plan.`,
    dateEstimate: formatMonth(reviewDate),
  });

  // Sector rotation trigger
  if (sectorMomentum === "Struggling" || sectorMomentum === "Weak") {
    triggers.push({
      type: "rebalance", icon: "scales", tone: "neutral",
      condition: `If ${sector ?? "sector"} stays weak for 30+ days`,
      action: `Consider rotating profits into a "Booming" sector instead.`,
    });
  }

  return triggers;
}

// ✦ One-line AI summary that frames the position
function buildAISummary({
  recommendation, scorePercentile, pnlPercent, sectorMomentum, alerts,
}: {
  recommendation: EnrichedHolding["recommendation"];
  scorePercentile: number;
  pnlPercent: number;
  sectorMomentum: SectorMomentum;
  alerts: HoldingAlert[];
}): string {
  if (recommendation === "Review Urgently") {
    return "⚠ Critical alerts on this position. The AI's confidence has dropped significantly — review and decide whether to exit before the situation worsens.";
  }
  if (recommendation === "Consider Trimming") {
    const warningCount = alerts.filter((a) => a.severity === "warning").length;
    return `Multiple yellow flags (${warningCount} warning${warningCount === 1 ? "" : "s"}). Consider selling 25–50% to reduce risk while you watch how it develops.`;
  }
  if (recommendation === "Consider Buying More") {
    return `Strong setup: top ${100 - scorePercentile}% AI score, ${sectorMomentum.toLowerCase()} sector backdrop, and positive momentum. If you have cash and conviction, this is the kind of position you add to.`;
  }
  if (recommendation === "Strong Hold") {
    return `Position is doing what it should. Top ${100 - scorePercentile}% AI score in a ${sectorMomentum.toLowerCase()} sector. ${pnlPercent >= 0 ? "Don't take profits early." : "Stay patient through the dip."}`;
  }
  return `Top ${100 - scorePercentile}% AI score. Sector is ${sectorMomentum.toLowerCase()}. No urgent action needed — let the thesis play out.`;
}

export async function enrichHoldings(
  holdings: Array<{
    ticker: string;
    entry_price: number | null;
    score_at_entry: number | null;
    rank_at_entry: number | null;
    added_at: string;
    last_reviewed_at: string;
  }>
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
    .from("news_articles")
    .select("impact, affected_tickers")
    .gte("published_at", fourteenDaysAgo)
    .limit(200);

  const { momentum, bullishPct, maxScore } = await getSectorData();

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

  return holdings.map((h) => {
    const current = currentMap.get(h.ticker);
    const score = Number(current?.score) || 0;
    const currentPrice = Number(current?.price) || 0;
    const entryPrice = Number(h.entry_price) || currentPrice;
    const sector = (current?.sector as string) ?? null;
    const rank = Number(current?.rank) || null;

    const scoreChange = score - (h.score_at_entry ?? score);
    const rankChange = h.rank_at_entry ? h.rank_at_entry - (rank ?? h.rank_at_entry) : 0;
    const pnlDollars = currentPrice - entryPrice;
    const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
    const daysSinceReview = daysBetween(now, new Date(h.last_reviewed_at));
    const daysHeld = daysBetween(now, new Date(h.added_at));

    const news = newsImpactByTicker[h.ticker] ?? { positive: 0, negative: 0 };
    const sectorMomentumValue = sector ? (momentum[sector] ?? "Unknown") : "Unknown";
    const sectorBullishPctValue = sector ? (bullishPct[sector] ?? 0) : 0;
    const scorePercentile = Math.round((score / maxScore) * 100);

    const alerts = buildAlerts({
      ticker: h.ticker, scoreChange, pnlPercent, daysSinceReview,
      scoreAtEntry: h.score_at_entry, score, rank, rankAtEntry: h.rank_at_entry,
      recentNegativeNewsCount: news.negative, recentPositiveNewsCount: news.positive,
      sectorMomentum: sectorMomentumValue, sectorBullishPct: sectorBullishPctValue,
      sector, currentPrice, entryPrice,
    });

    const recommendation = deriveRecommendation(alerts);

    const triggers = buildTriggers({
      ticker: h.ticker, currentPrice, entryPrice, score,
      scoreAtEntry: h.score_at_entry, sector,
      sectorMomentum: sectorMomentumValue, daysSinceReview,
    });

    const aiSummary = buildAISummary({
      recommendation, scorePercentile, pnlPercent,
      sectorMomentum: sectorMomentumValue, alerts,
    });

    return {
      ticker: h.ticker, company: (current?.company as string) ?? null, sector, rank, score, maxScore,
      currentPrice, entryPrice, scoreAtEntry: h.score_at_entry, rankAtEntry: h.rank_at_entry,
      addedAt: h.added_at, lastReviewedAt: h.last_reviewed_at, daysHeld,
      pnlDollars: Math.round(pnlDollars * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 10) / 10,
      scoreChange, rankChange, daysSinceReview, alerts, recommendation,
      sectorMomentum: sectorMomentumValue, sectorBullishPct: sectorBullishPctValue,
      scorePercentile, triggers, aiSummary,
    };
  });
}
