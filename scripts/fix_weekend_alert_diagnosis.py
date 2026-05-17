from pathlib import Path

path = Path("lib/portfolio-alerts.ts")
text = path.read_text()

# Add non-trading day helper.
if "function isNonTradingDay" not in text:
    marker = "function concentrationThreshold(risk: RiskTolerance): number {"
    if marker not in text:
        raise SystemExit("Could not find concentrationThreshold marker")
    helper = '''function isNonTradingDay(date = new Date()) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function looksLikeWeekendRecalibration(p: {
  daysHeld: number;
  pnlPercent: number;
  factorDiagnostics?: Record<string, any> | null;
}) {
  const hasExactDiagnostics = Boolean(
    p.factorDiagnostics &&
    (Array.isArray(p.factorDiagnostics.top_negative_factors) ||
      Number.isFinite(Number(p.factorDiagnostics.momentum_change)) ||
      Number.isFinite(Number(p.factorDiagnostics.growth_change)) ||
      Number.isFinite(Number(p.factorDiagnostics.quality_change)) ||
      Number.isFinite(Number(p.factorDiagnostics.value_change)))
  );

  return isNonTradingDay() && p.daysHeld <= 3 && Math.abs(p.pnlPercent) < 2 && !hasExactDiagnostics;
}

'''
    text = text.replace(marker, helper + marker, 1)

# Improve explainScoreDrop: add field and an early weekend/data-recalc reason.
text = text.replace(
'''  totalStocks: number;
  factorDiagnostics?: Record<string, any> | null;
}, dropPct: number) {
  const reasons: string[] = [];
''',
'''  totalStocks: number;
  daysHeld?: number;
  factorDiagnostics?: Record<string, any> | null;
}, dropPct: number) {
  const reasons: string[] = [];

  if (looksLikeWeekendRecalibration({
    daysHeld: p.daysHeld ?? 999,
    pnlPercent: p.pnlPercent,
    factorDiagnostics: p.factorDiagnostics,
  })) {
    reasons.push(
      "this happened during a weekend/non-trading recalculation, with no meaningful price move since entry, so it is more likely a model/data refresh than confirmed stock deterioration"
    );
    reasons.push(
      "exact factor diagnostics are not available yet for this move, so the system should wait for the next market session before treating it as a sell signal"
    );
  }
''',
1)

# Add daysHeld to explainRankDrop and improve no-diagnostics wording.
text = text.replace(
'''  sector: string | null;
  factorDiagnostics?: Record<string, any> | null;
}) {
''',
'''  sector: string | null;
  daysHeld?: number;
  factorDiagnostics?: Record<string, any> | null;
}) {
''',
1)

text = text.replace(
'''  const factorDrivers = strongestFactorDrivers(p.factorDiagnostics);

  reasons.push(...factorDrivers);
''',
'''  const factorDrivers = strongestFactorDrivers(p.factorDiagnostics);

  if (looksLikeWeekendRecalibration({
    daysHeld: p.daysHeld ?? 999,
    pnlPercent: p.pnlPercent,
    factorDiagnostics: p.factorDiagnostics,
  })) {
    reasons.push(
      "this occurred during a weekend/non-trading recalculation, with no meaningful price move since entry, so it is more likely a model/data refresh than confirmed stock deterioration"
    );
    reasons.push(
      "exact factor diagnostics are not available yet for this move; wait for the next live market session before treating the rank change as actionable"
    );
  }

  reasons.push(...factorDrivers);
''',
1)

text = text.replace(
'''  return `Likely drivers: ${reasons.length ? reasons.join(". ") : "factor diagnostics are not available yet, so this appears to be mainly peer-relative movement within the ranking model"}.`;
}
''',
'''  return `Likely drivers: ${reasons.length ? reasons.join(". ") : "exact factor diagnostics are not available yet; this appears to be peer-relative movement or a data/model recalculation rather than a clearly identifiable stock-specific breakdown"}.`;
}
''',
1)

# Add daysHeld to explainWeakRank input.
text = text.replace(
'''  sector: string | null;
  factorDiagnostics?: Record<string, any> | null;
}) {
''',
'''  sector: string | null;
  daysHeld?: number;
  factorDiagnostics?: Record<string, any> | null;
}) {
''',
1)

# Make poor signal recommendation safer for weekend recalculations.
old_poor = '''    alerts.push({
      type: "poor_signal", severity: "critical",
      title: `${p.ticker} has a poor AI signal — bottom ${Math.max(1, 100 - p.rankPercentile)}% of stocks`,
      message: `Score of ${p.score.toLocaleString()} is well below the threshold for a healthy hold. ${explainWeakRank(p)}`,
      recommendation: `Sell at the next opportunity. Don't wait for a price target — better-rated stocks exist to redeploy into.`,
    });
'''
new_poor = '''    const weekendRecalibration = looksLikeWeekendRecalibration(p);
    alerts.push({
      type: "poor_signal",
      severity: weekendRecalibration ? "warning" : "critical",
      title: weekendRecalibration
        ? `${p.ticker} signal changed during a non-trading recalculation`
        : `${p.ticker} has a poor AI signal — bottom ${Math.max(1, 100 - p.rankPercentile)}% of stocks`,
      message: weekendRecalibration
        ? `Score of ${p.score.toLocaleString()} is now below the healthy-hold threshold, but this happened on a weekend/non-trading recalculation with no meaningful price move. ${explainWeakRank(p)}`
        : `Score of ${p.score.toLocaleString()} is well below the threshold for a healthy hold. ${explainWeakRank(p)}`,
      recommendation: weekendRecalibration
        ? `Do not sell solely because of this weekend recalculation. Wait for the next trading session or exact factor diagnostics to confirm whether the signal is real.`
        : `Sell at the next opportunity. Don't wait for a price target — better-rated stocks exist to redeploy into.`,
    });
'''
if old_poor in text:
    text = text.replace(old_poor, new_poor, 1)
else:
    print("Poor signal block not found; skipping")

# Patch recent score-drop block to avoid Sell on weekend/no diagnostics.
old_recent = '''      if (dropPct <= -25) {
        const reason = explainScoreDrop(p, dropPct);
        alerts.push({
          type: "score_drop", severity: "critical",
          title: `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. ${reason}`,
          recommendation: `Sell. The thesis broke before you even got going.`,
        });
      }
'''
new_recent = '''      if (dropPct <= -25) {
        const reason = explainScoreDrop(p, dropPct);
        const weekendRecalibration = looksLikeWeekendRecalibration(p);
        alerts.push({
          type: "score_drop",
          severity: weekendRecalibration ? "warning" : "critical",
          title: weekendRecalibration
            ? `${p.ticker} score changed sharply during a non-trading recalculation`
            : `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: weekendRecalibration
            ? `Score moved ${Math.abs(Math.round(dropPct))}% since you added it, but this happened while the market was closed and price has not meaningfully moved. ${reason}`
            : `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. ${reason}`,
          recommendation: weekendRecalibration
            ? `Do not sell purely from this alert. Wait for the next trading session and factor diagnostics confirmation before acting.`
            : `Sell. The thesis broke before you even got going.`,
        });
      }
'''
if old_recent not in text:
    raise SystemExit("Could not find recent score-drop block")
text = text.replace(old_recent, new_recent, 1)

# Patch mature critical score-drop recommendation similarly.
old_mature = '''    if (dropPct <= -25) {
      const reason = explainScoreDrop(p, dropPct);
      alerts.push({
        type: "score_drop", severity: "critical",
        title: `${p.ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `Score dropped from ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()} since you bought. ${reason}`,
        recommendation: isSmallPosition
          ? `Sell the entire ${p.currentAllocationPct.toFixed(1)}% position. Don't manage a small loser.`
          : `Sell at least half. The AI's view has fundamentally shifted.`,
      });
'''
new_mature = '''    if (dropPct <= -25) {
      const reason = explainScoreDrop(p, dropPct);
      const weekendRecalibration = looksLikeWeekendRecalibration(p);
      alerts.push({
        type: "score_drop",
        severity: weekendRecalibration ? "warning" : "critical",
        title: weekendRecalibration
          ? `${p.ticker} AI score changed sharply during a non-trading recalculation`
          : `${p.ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `Score dropped from ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()} since you bought. ${reason}`,
        recommendation: weekendRecalibration
          ? `Do not sell purely from this alert. Wait for the next trading session and factor diagnostics confirmation before acting.`
          : isSmallPosition
            ? `Sell the entire ${p.currentAllocationPct.toFixed(1)}% position. Don't manage a small loser.`
            : `Sell at least half. The AI's view has fundamentally shifted.`,
      });
'''
if old_mature not in text:
    raise SystemExit("Could not find mature critical score-drop block")
text = text.replace(old_mature, new_mature, 1)

# Patch rank-drop recommendation to avoid action on weekend recalibration.
old_rank = '''      alerts.push({
        type: "rank_drop", severity: "warning",
        title: `${p.ticker} fell ${move.placeLabel} in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. ${explainRankDrop(p)}`,
        recommendation: isSmallPosition
          ? `Sell and rotate the cash into a top-50 ranked stock instead.`
          : `Compare with sector peers. If alternatives are stronger, rotate.`,
      });
'''
new_rank = '''      const weekendRecalibration = looksLikeWeekendRecalibration(p);
      alerts.push({
        type: "rank_drop",
        severity: "warning",
        title: weekendRecalibration
          ? `${p.ticker} ranking changed during a non-trading recalculation`
          : `${p.ticker} fell ${move.placeLabel} in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. ${explainRankDrop(p)}`,
        recommendation: weekendRecalibration
          ? `Do not rotate purely because of a weekend rank move. Wait for the next trading session and exact factor diagnostics confirmation.`
          : isSmallPosition
            ? `Sell and rotate the cash into a top-50 ranked stock instead.`
            : `Compare with sector peers. If alternatives are stronger, rotate.`,
      });
'''
if old_rank not in text:
    raise SystemExit("Could not find rank-drop alert block")
text = text.replace(old_rank, new_rank, 1)

required = [
    "function isNonTradingDay",
    "function looksLikeWeekendRecalibration",
    "non-trading recalculation",
    "Do not sell purely from this alert",
    "exact factor diagnostics are not available yet",
    "Do not rotate purely because of a weekend rank move",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected content after patch: {missing}")

path.write_text(text)
print("Weekend/non-trading score and rank moves now produce cautious diagnostic alerts instead of aggressive sell alerts.")
