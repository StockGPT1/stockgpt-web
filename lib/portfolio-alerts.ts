import { createClient } from "@/utils/supabase/server";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertType =
  | "score_drop" | "score_rise" | "rank_drop" | "rank_rise"
  | "price_target" | "price_stop" | "review_due"
  | "negative_news" | "positive_news"
  | "sector_weak" | "sector_strong"
  | "position_oversize" | "position_tiny";

export type HoldingAlert = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
};

export type SectorMomentum =
  | "Booming" | "Strong" | "Mixed" | "Weak" | "Struggling" | "Unknown";

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
  // ✦ NEW: Real position math
  costBasis: number;        // shares × entryPrice
  currentValue: number;     // shares × currentPrice
  totalPnLDollars: number;  // currentValue - costBasis
  currentAllocationPct: number; // currentValue / portfolio total × 100
  targetAllocationPct: number | null; // from when added
  // Existing
  scoreAtEntry: number | null;
  rankAtEntry: number | null;
  addedAt: string;
  lastReviewedAt: string;
  daysHeld: number;
  pnlDollars: number;       // per share
  pnlPercent: number;
  scoreChange: number;
  rankChange: number;
  daysSinceReview: number;
  alerts: HoldingAlert[];
  recommendation: "Hold" | "Consider Buying More" | "Consider Trimming" | "Strong Hold" | "Review Urgently" | "Sell Whole Position";
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  scorePercentile: number;
  triggers: HoldingTrigger[];
  aiSummary: string;
};

export type HoldingTrigger = {
  type: "stop_sell" | "take_profit" | "trailing_stop" | "score_alert" | "review" | "rebalance" | "exit_all";
  icon: "shield" | "target" | "warning" | "calendar" | "scales" | "exit";
  condition: string;
  action: string;
  tone: "positive" | "negative" | "neutral";
  priority: number; // 1=most important
};

async function getSectorData() {
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("stock_rankings").select("score")
    .order("score", { ascending: false }).limit(1).maybeSingle();
  const maxScore = Math.max(Number(maxRow?.score) || 10000, 1);
  const bullishThreshold = maxScore * 0.7;

  const { data: allStocks } = await supabase
    .from("stock_rankings").select("sector, score");

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

// ── Alerts (with position-size awareness) ──
function buildAlerts(p: {
  ticker: string; scoreChange: number; pnlPercent: number; daysSinceReview: number;
  scoreAtEntry: number | null; score: number; rank: number | null; rankAtEntry: number | null;
  recentNegativeNewsCount: number; recentPositiveNewsCount: number;
  sectorMomentum: SectorMomentum; sectorBullishPct: number;
  sector: string | null; currentPrice: number; entryPrice: number;
  currentAllocationPct: number;
}): HoldingAlert[] {
  const alerts: HoldingAlert[] = [];
  const isSmallPosition = p.currentAllocationPct < 5;
  const isOversizedPosition = p.currentAllocationPct > 25;

  // ── Position size alerts ──
  if (isOversizedPosition) {
    alerts.push({
      type: "position_oversize", severity: "warning",
      title: `${p.ticker} is ${p.currentAllocationPct.toFixed(1)}% of your portfolio`,
      message: `That's a concentrated bet. One bad earnings miss could swing your whole portfolio.`,
      recommendation: `Trim to 15–20% by selling some shares. Use the proceeds to buy a sector you don't own yet.`,
    });
  }

  // ── Score drop ──
  if (p.scoreAtEntry && p.scoreAtEntry > 0) {
    const dropPct = (p.scoreChange / p.scoreAtEntry) * 100;
    if (dropPct <= -25) {
      alerts.push({
        type: "score_drop", severity: "critical",
        title: `${p.ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `Score dropped from ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()} since you bought.`,
        recommendation: isSmallPosition
          ? `Sell the entire ${p.currentAllocationPct.toFixed(1)}% position. Don't manage a small loser — exit cleanly.`
          : `Sell at least half. The AI's view has fundamentally shifted.`,
      });
    } else if (dropPct <= -12) {
      alerts.push({
        type: "score_drop", severity: "warning",
        title: `${p.ticker} AI score weakened ${Math.abs(Math.round(dropPct))}%`,
        message: `From ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()}. Still positive, but conviction is fading.`,
        recommendation: isSmallPosition
          ? `Consider exiting the whole position. Small holdings aren't worth babysitting.`
          : `Don't add more. If score drops another 10%, sell at least half.`,
      });
    } else if (dropPct >= 12) {
      alerts.push({
        type: "score_rise", severity: "success",
        title: `${p.ticker} AI conviction is rising — up ${Math.round(dropPct)}%`,
        message: `From ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()}. The AI is more confident than when you bought.`,
        recommendation: isSmallPosition
          ? `This is a "build it up" candidate. Add more on any 5%+ dip until it reaches 8–12% of portfolio.`
          : `Hold this position. If price dips 5–8%, that's a buy-more opportunity.`,
      });
    }
  }

  // ── Rank changes ──
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
        message: `From #${p.rankAtEntry} to #${p.rank}. Strong relative outperformance.`,
        recommendation: `Hold the winner. Don't take profits early — this is the kind of position that compounds.`,
      });
    }
  }

  // ── News ──
  if (p.recentNegativeNewsCount >= 3) {
    alerts.push({
      type: "negative_news", severity: "warning",
      title: `${p.recentNegativeNewsCount} negative articles about ${p.ticker} in 14 days`,
      message: `When negative coverage stacks up like this, the market often follows.`,
      recommendation: isSmallPosition
        ? `Sell. Small positions don't justify the risk of being wrong on a story.`
        : `Read the news section. If concerns are about earnings or fundamentals, sell. If just noise, hold.`,
    });
  } else if (p.recentPositiveNewsCount >= 4) {
    alerts.push({
      type: "positive_news", severity: "success",
      title: `${p.ticker} has ${p.recentPositiveNewsCount} positive articles recently`,
      message: `Strong positive narrative — typically supports the share price.`,
      recommendation: `Hold and watch. If the AI score also rises, consider adding.`,
    });
  }

  // ── Sector momentum ──
  if (p.sectorMomentum === "Struggling" && p.scoreChange < 0) {
    alerts.push({
      type: "sector_weak", severity: "warning",
      title: `${p.sector ?? "This"} sector is struggling — only ${p.sectorBullishPct}% of stocks bullish`,
      message: `Most ${p.sector ?? "sector"} stocks are underperforming. ${p.ticker} is fighting headwinds.`,
      recommendation: isSmallPosition
        ? `Cut the position. Re-deploy into a "Booming" sector.`
        : `Sector rotation may be worth considering. Move money toward strong sectors like Tech or Communication Services.`,
    });
  } else if (p.sectorMomentum === "Booming") {
    alerts.push({
      type: "sector_strong", severity: "success",
      title: `${p.sector ?? "This"} sector is booming — ${p.sectorBullishPct}% of stocks bullish`,
      message: `Strong sector tailwind. When most peers are rising, ${p.ticker} is more likely to follow.`,
      recommendation: isSmallPosition
        ? `Build this position up while sector momentum is strong. Add until 8–12% of portfolio.`
        : `Hold or add — sector momentum is real edge.`,
    });
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
  pnlPercent: number
): EnrichedHolding["recommendation"] {
  const isSmallPosition = positionPct < 5;
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning").length;
  const successes = alerts.filter((a) => a.severity === "success").length;

  // Critical + small position = exit cleanly, don't manage it
  if (hasCritical && isSmallPosition) return "Sell Whole Position";
  if (hasCritical) return "Review Urgently";

  // Small position with warnings = exit, don't trim
  if (isSmallPosition && warnings >= 2) return "Sell Whole Position";

  if (warnings >= 2) return "Consider Trimming";
  if (successes >= 2 && warnings === 0) return "Consider Buying More";
  if (successes >= 1 && warnings === 0) return "Strong Hold";
  return "Hold";
}

// ✦ DYNAMIC TRIGGERS — based on current state and position size
function buildDynamicTriggers(p: {
  ticker: string; currentPrice: number; entryPrice: number;
  pnlPercent: number; currentAllocationPct: number;
  score: number; scoreAtEntry: number | null;
  sector: string | null; sectorMomentum: SectorMomentum;
  daysSinceReview: number;
}): HoldingTrigger[] {
  const triggers: HoldingTrigger[] = [];
  const now = new Date();
  const isSmall = p.currentAllocationPct < 5;
  const isMedium = p.currentAllocationPct >= 5 && p.currentAllocationPct <= 15;
  const isLarge = p.currentAllocationPct > 15;

  // ── 1. STOP / DOWNSIDE PROTECTION ──
  if (p.pnlPercent >= 50) {
    // Big winner → trailing stop, protect gains
    const trailingStop = p.currentPrice * 0.88;
    triggers.push({
      type: "trailing_stop", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops 12% from here ($${trailingStop.toFixed(2)})`,
      action: isSmall
        ? `Sell the entire position. You're up ${p.pnlPercent.toFixed(0)}% — take the money.`
        : `Sell at least half. Lock in your massive gain — winners can give back fast.`,
    });
  } else if (p.pnlPercent >= 20) {
    // Decent winner → trailing stop at modest level
    const trailingStop = p.currentPrice * 0.90;
    triggers.push({
      type: "trailing_stop", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops 10% from here ($${trailingStop.toFixed(2)})`,
      action: isSmall
        ? `Sell the whole position to lock in your ${p.pnlPercent.toFixed(0)}% gain.`
        : `Trim 33% to lock in profits, hold the rest.`,
    });
  } else if (p.pnlPercent < -10) {
    // Already significantly underwater → tight stop
    const stopPrice = p.currentPrice * 0.93;
    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops to $${stopPrice.toFixed(2)}`,
      action: isSmall
        ? `Sell all. Don't let small losers compound into bigger ones.`
        : `Sell — your thesis is wrong. Cut the loss before it grows.`,
    });
  } else {
    // Normal range → entry-based stop
    const stopPrice = p.entryPrice * 0.92;
    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops to $${stopPrice.toFixed(2)} (8% below entry)`,
      action: isSmall
        ? `Sell the entire position — small losses become large losses if ignored.`
        : `Sell — your downside protection from entry.`,
    });
  }

  // ── 2. TAKE PROFIT (only if relevant) ──
  if (p.pnlPercent >= 100) {
    // Massive winner — no specific take profit, just trail and let it run
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `You're already up ${p.pnlPercent.toFixed(0)}%`,
      action: isSmall
        ? `Sell — you've made your money. Even a 5% position up 100% is a 5% portfolio gain. Realize it.`
        : `Don't set a hard target — let it run with the trailing stop above. Take 25% off if you need to rebalance.`,
    });
  } else if (p.pnlPercent >= 25) {
    // Already profitable — set realistic next target
    const next = p.currentPrice * 1.20;
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `If ${p.ticker} reaches $${next.toFixed(2)} (+20% from here)`,
      action: isSmall
        ? `Sell the whole position. You're up ${p.pnlPercent.toFixed(0)}% — don't get greedy on a small bet.`
        : isLarge
          ? `Sell 25–33%. Take incremental profits and reduce concentration.`
          : `Sell 33%. Lock in a portion, hold the rest as a runner.`,
    });
  } else if (p.pnlPercent <= -10) {
    // Underwater — focus on getting back to entry, no upside target yet
    triggers.push({
      type: "take_profit", icon: "target", tone: "neutral", priority: 2,
      condition: `If ${p.ticker} recovers to $${p.entryPrice.toFixed(2)} (back to entry)`,
      action: isSmall
        ? `Sell at break-even. The AI's confidence has weakened — exit cleanly.`
        : `Reassess your thesis. If it still holds, hold for further upside. If not, sell on the relief.`,
    });
  } else {
    // Normal range — set first profit target
    const profit1 = p.entryPrice * 1.20;
    if (p.currentPrice < profit1) {
      triggers.push({
        type: "take_profit", icon: "target", tone: "positive", priority: 2,
        condition: `If ${p.ticker} reaches $${profit1.toFixed(2)} (+20% from entry)`,
        action: isSmall
          ? `Consider selling the whole position. At ${p.currentAllocationPct.toFixed(1)}% of your portfolio, partial trims aren't worth tracking.`
          : isLarge
            ? `Sell 25–33% to lock in the first chunk. Concentration is high — reduce exposure.`
            : `Sell 25–33% to lock in gains. Hold the rest for further upside.`,
      });
    }
  }

  // ── 3. SCORE-BASED TRIGGER ──
  if (p.scoreAtEntry) {
    const threshold = Math.round(p.scoreAtEntry * 0.75);
    triggers.push({
      type: "score_alert", icon: "warning", tone: "neutral", priority: 3,
      condition: `If AI score drops below ${threshold.toLocaleString()} (currently ${p.score.toLocaleString()})`,
      action: isSmall
        ? `Sell whole position. Don't manage a small holding through a thesis change.`
        : `Sell 50%+. The reason you bought no longer holds.`,
    });
  }

  // ── 4. REVIEW DATE ──
  const reviewIn = Math.max(0, 90 - p.daysSinceReview);
  const reviewDate = new Date(now);
  reviewDate.setDate(now.getDate() + reviewIn);
  triggers.push({
    type: "review", icon: "calendar", tone: "neutral", priority: 4,
    condition: reviewIn <= 0 ? "Review overdue" : `Review on ${reviewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    action: reviewIn <= 0 ? "Open the stock page now and reassess." : "Quarterly check: AI score, news, sector momentum.",
  });

  // ── 5. POSITION-SIZE REBALANCE ──
  if (isLarge && p.currentAllocationPct > 25) {
    triggers.push({
      type: "rebalance", icon: "scales", tone: "neutral", priority: 5,
      condition: `Concentration risk: ${p.currentAllocationPct.toFixed(1)}% of portfolio`,
      action: `Trim to 15–20%. One stock shouldn't be a quarter of your bets.`,
    });
  } else if (isSmall && p.pnlPercent > 0 && p.score >= p.scoreAtEntry!) {
    triggers.push({
      type: "rebalance", icon: "scales", tone: "neutral", priority: 5,
      condition: `Tiny position: ${p.currentAllocationPct.toFixed(1)}% of portfolio`,
      action: `Either build to 5%+ or sell. Positions this small don't move the needle.`,
    });
  }

  return triggers.sort((a, b) => a.priority - b.priority);
}

function buildAISummary(p: {
  recommendation: EnrichedHolding["recommendation"];
  scorePercentile: number;
  pnlPercent: number;
  sectorMomentum: SectorMomentum;
  alerts: HoldingAlert[];
  currentAllocationPct: number;
  ticker: string;
}): string {
  const sizeContext = p.currentAllocationPct < 5
    ? `At just ${p.currentAllocationPct.toFixed(1)}% of your portfolio, this is a small position — keep it simple: hold or sell, no partial moves.`
    : p.currentAllocationPct > 25
      ? `At ${p.currentAllocationPct.toFixed(1)}% of your portfolio, this is your biggest single bet. Concentration risk is real.`
      : `At ${p.currentAllocationPct.toFixed(1)}% of your portfolio, this is a meaningful position.`;

  if (p.recommendation === "Sell Whole Position") {
    return `⚠ Sell ${p.ticker}. ${sizeContext} The signal has weakened and a small position isn't worth managing through uncertainty.`;
  }
  if (p.recommendation === "Review Urgently") {
    return `⚠ ${p.ticker} has critical alerts. ${sizeContext} Decide now: cut the loss, or hold with conviction. Don't drift.`;
  }
  if (p.recommendation === "Consider Trimming") {
    return `Multiple yellow flags on ${p.ticker}. ${sizeContext} Consider selling some to reduce risk.`;
  }
  if (p.recommendation === "Consider Buying More") {
    return `${p.ticker} is set up well: top ${100 - p.scorePercentile}% AI score, ${p.sectorMomentum.toLowerCase()} sector. ${sizeContext} If you have cash, this is the kind of position you add to.`;
  }
  if (p.recommendation === "Strong Hold") {
    return `${p.ticker} is doing what it should — top ${100 - p.scorePercentile}% AI score, ${p.sectorMomentum.toLowerCase()} sector backdrop. ${sizeContext} ${p.pnlPercent >= 0 ? "Don't take profits early — let winners run." : "Stay patient through the dip."}`;
  }
  return `${p.ticker}: top ${100 - p.scorePercentile}% AI score, sector is ${p.sectorMomentum.toLowerCase()}. ${sizeContext} No urgent action.`;
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
    .from("news_articles").select("impact, affected_tickers")
    .gte("published_at", fourteenDaysAgo).limit(200);

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

  // Pre-compute total portfolio value to derive currentAllocationPct
  const totalPortfolioValue = holdings.reduce((sum, h) => {
    const current = currentMap.get(h.ticker);
    const price = Number(current?.price) || 0;
    const shares = Number(h.shares) || 1;
    return sum + price * shares;
  }, 0);

  return holdings.map((h) => {
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
      ? (currentValue / totalPortfolioValue) * 100
      : 0;

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
      sector, currentPrice, entryPrice, currentAllocationPct,
    });

    const recommendation = deriveRecommendation(alerts, currentAllocationPct, pnlPercent);

    const triggers = buildDynamicTriggers({
      ticker: h.ticker, currentPrice, entryPrice, pnlPercent,
      currentAllocationPct, score, scoreAtEntry: h.score_at_entry,
      sector, sectorMomentum: sectorMomentumValue, daysSinceReview,
    });

    const aiSummary = buildAISummary({
      recommendation, scorePercentile, pnlPercent,
      sectorMomentum: sectorMomentumValue, alerts,
      currentAllocationPct, ticker: h.ticker,
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
      scorePercentile, triggers, aiSummary,
    };
  });
}
