from pathlib import Path
import re


def patch_portfolio_alerts():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    new_function = r'''function buildDynamicTriggers(p: {
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
'''

    text = re.sub(
        r"function buildDynamicTriggers\(p: \{(?:.|\n)*?\n\}\n\n// ✦ Much smarter, situation-aware AI summary",
        new_function + "\n\n// ✦ Much smarter, situation-aware AI summary",
        text,
        count=1,
    )

    path.write_text(text)


patch_portfolio_alerts()
print("Upgraded portfolio take-profit and stop-loss logic.")
