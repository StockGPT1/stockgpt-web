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

  // Rank is the source of truth. A #1 stock must always receive more room than a #100 stock,
  // unless the user has an extreme concentration problem.
  const rankConviction = p.rank && p.totalStocks
    ? Math.max(0, Math.round(100 - ((p.rank - 1) / p.totalStocks) * 100))
    : p.scorePercentile;
  const conviction = rankConviction; // 100 = best, 0 = worst

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
    p.sectorMomentum === "Booming" ? 2 :
    p.sectorMomentum === "Strong" ? 1 :
    p.sectorMomentum === "Struggling" ? -1.5 :
    p.sectorMomentum === "Weak" ? -0.75 :
    0;

  const concentrationAdjustment = isVeryLarge ? -2 : isLarge ? -1 : isSmall ? 0.5 : 0;

  const baseStopRoomPct = isElite ? 15 : isStrong ? 12 : isHealthy ? 9 : 6;
  const minimumStopRoomPct = isElite ? 11 : isStrong ? 9 : isHealthy ? 7 : 4.5;
  const maximumStopRoomPct = isElite ? 18 : isStrong ? 15 : isHealthy ? 12 : 8;

  const stopRoomPct = clampPct(
    baseStopRoomPct + sectorAdjustment + concentrationAdjustment + (isRecentlyAdded ? 1 : 0),
    minimumStopRoomPct,
    maximumStopRoomPct,
  );

  const trailingRoomPct = clampPct(
    (isElite ? 16 : isStrong ? 13 : isHealthy ? 10 : 6)
      + sectorAdjustment
      + concentrationAdjustment
      + (p.pnlPercent >= 100 ? -2 : p.pnlPercent >= 60 ? -1 : 0),
    isElite ? 12 : isStrong ? 9 : 5,
    isElite ? 18 : isStrong ? 15 : 11,
  );

  const upsideTargetPct = clampPct(
    (isElite ? 40 : isStrong ? 30 : isHealthy ? 20 : 10)
      + (p.sectorMomentum === "Booming" ? 6 : 0)
      + (scoreChangePct > 0.12 ? 5 : 0)
      - (isVeryLarge ? 6 : isLarge ? 3 : 0),
    8,
    55,
  );

  // ══════════════════════════════════════════════════════
  // OVERRIDE: weak AI signal means preservation beats target-setting.
  // ══════════════════════════════════════════════════════
  if (isWeak || (p.rank && p.totalStocks && p.rank > p.totalStocks * 0.85)) {
    const exitStopPct = conviction < 20 ? 4 : 5.5;
    const exitStop = priceAt(p.currentPrice, -exitStopPct);
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
      condition: `If ${p.ticker} falls to ${money(exitStop)} (-${exitStopPct.toFixed(1)}% from current)`,
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
  // Stop width now follows rank hierarchy first. P&L changes whether it is described as
  // a stop or trailing stop, but it cannot make an elite stock tighter than a healthy stock.
  // ══════════════════════════════════════════════════════
  if (p.pnlPercent >= 20) {
    const trailingStop = priceAt(p.currentPrice, -trailingRoomPct);
    triggers.push({
      type: "trailing_stop", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} drops to ${money(trailingStop)} (-${trailingRoomPct.toFixed(0)}% from current)`,
      action: isElite
        ? `Elite rank: give it room and let it compound. Only trim if this trailing stop breaks or the AI rank deteriorates.`
        : isStrong
          ? `Strong rank: hold unless the trailing stop breaks. Do not sell purely because it is up.`
          : `Protect the profit. Trim 25–33% if this breaks.`,
    });
  } else if (p.pnlPercent <= -12) {
    const lossStopPct = stopRoomPct;
    const stopPrice = priceAt(p.currentPrice, -lossStopPct);
    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} falls to ${money(stopPrice)} (-${lossStopPct.toFixed(0)}% from current)`,
      action: isElite || isStrong
        ? `AI rank is still strong, so avoid panic-selling. Break below this level suggests the drawdown is no longer normal noise.`
        : `Sell. A losing position without high conviction should not be allowed to become a portfolio problem.`,
    });
  } else {
    const entryStop = priceAt(p.entryPrice, -stopRoomPct);
    const currentStop = priceAt(p.currentPrice, -stopRoomPct);
    const stopPrice = p.currentPrice > p.entryPrice
      ? Math.max(entryStop, currentStop)
      : Math.min(entryStop, currentStop);

    triggers.push({
      type: "stop_sell", icon: "shield", tone: "negative", priority: 1,
      condition: `If ${p.ticker} falls to ${money(stopPrice)} (-${stopRoomPct.toFixed(0)}% risk room)`,
      action: isElite
        ? `Elite rank gets wider room. This is a thesis-break level, not a tight trading stop.`
        : isStrong
          ? `Strong rank gets reasonable room. Break below this means reassess and cut if the rank also weakens.`
          : `Average-ranked positions should not be given unlimited downside.`,
    });
  }

  // ══════════════════════════════════════════════════════
  // 2. UPSIDE / TAKE-PROFIT LOGIC
  // ══════════════════════════════════════════════════════
  if (isElite && p.pnlPercent < 100) {
    const target = priceAt(p.currentPrice, upsideTargetPct);
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `If ${p.ticker} reaches ${money(target)} (+${upsideTargetPct.toFixed(0)}% from current)`,
      action: isVeryLarge
        ? `Trim 15–25% only because the position is oversized. Otherwise keep a core position while it remains elite-ranked.`
        : `Do not fully sell. Elite-ranked stocks should compound; use the trailing stop rather than a hard upside cap.`,
    });
  } else if (isStrong && p.pnlPercent < 75) {
    const target = priceAt(p.currentPrice, upsideTargetPct);
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `If ${p.ticker} reaches ${money(target)} (+${upsideTargetPct.toFixed(0)}% from current)`,
      action: isLarge
        ? `Trim 20–30% and keep the rest. Strong AI rank means avoid selling the whole winner.`
        : `Take only a partial profit. Hold the core while rank remains top quartile.`,
    });
  } else if (p.pnlPercent >= 100) {
    triggers.push({
      type: "take_profit", icon: "target", tone: "positive", priority: 2,
      condition: `${p.ticker} is already up ${p.pnlPercent.toFixed(0)}%`,
      action: isElite || isStrong
        ? `No hard upside cap. Keep a core position and let it run; only trim if it becomes oversized or rank weakens.`
        : `Bank 33–50%. Very large gains with only average conviction should be harvested.`,
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
print("Fixed rank-first portfolio stop-loss hierarchy.")
