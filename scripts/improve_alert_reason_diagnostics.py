from pathlib import Path

path = Path("lib/portfolio-alerts.ts")
text = path.read_text()

helper = r'''
function strongestFactorDrivers(diagnostics?: Record<string, any> | null) {
  if (!diagnostics) return [];

  const drivers: string[] = [];
  const sleeveChanges = [
    ["Momentum", Number(diagnostics.momentum_change)],
    ["Growth", Number(diagnostics.growth_change)],
    ["Quality", Number(diagnostics.quality_change)],
    ["Value", Number(diagnostics.value_change)],
    ["Risk", Number(diagnostics.risk_change)],
    ["Income", Number(diagnostics.income_change)],
  ]
    .filter(([, value]) => Number.isFinite(value) && Math.abs(value as number) >= 0.01)
    .sort((a, b) => Number(a[1]) - Number(b[1]));

  const negativeSleeves = sleeveChanges.filter(([, value]) => Number(value) < 0).slice(0, 3);
  if (negativeSleeves.length > 0) {
    drivers.push(
      `the biggest sleeve pressure came from ${negativeSleeves
        .map(([label, value]) => `${label} (${Number(value).toFixed(3)})`)
        .join(", ")}`
    );
  }

  const negativeFactors = Array.isArray(diagnostics.top_negative_factors)
    ? diagnostics.top_negative_factors.slice(0, 4)
    : [];
  if (negativeFactors.length > 0) {
    drivers.push(
      `factor-level deterioration was led by ${negativeFactors
        .map((item: any) => {
          const factor = formatFactorName(String(item.factor ?? "Unknown factor"));
          const change = Number(item.change);
          return Number.isFinite(change) ? `${factor} (${change.toFixed(3)})` : factor;
        })
        .join(", ")}`
    );
  }

  const previousScore = Number(diagnostics.previous_score);
  const currentScore = Number(diagnostics.current_score ?? diagnostics.smoothed_score);
  if (Number.isFinite(previousScore) && Number.isFinite(currentScore) && previousScore > 0) {
    const scoreMovePct = ((currentScore - previousScore) / previousScore) * 100;
    if (Number.isFinite(scoreMovePct) && Math.abs(scoreMovePct) >= 5) {
      drivers.push(
        `the diagnostic score moved from ${Math.round(previousScore).toLocaleString()} to ${Math.round(currentScore).toLocaleString()} (${scoreMovePct >= 0 ? "+" : ""}${scoreMovePct.toFixed(1)}%)`
      );
    }
  }

  return drivers;
}

function explainRankDrop(p: {
  ticker: string;
  rank: number | null;
  rankAtEntry: number | null;
  scoreChange: number;
  scoreAtEntry: number | null;
  score: number;
  pnlPercent: number;
  recentNegativeNewsCount: number;
  recentPositiveNewsCount: number;
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  sector: string | null;
  factorDiagnostics?: Record<string, any> | null;
}) {
  const reasons: string[] = [];
  const factorDrivers = strongestFactorDrivers(p.factorDiagnostics);

  reasons.push(...factorDrivers);

  if (p.scoreAtEntry && p.scoreAtEntry > 0) {
    const scoreMovePct = (p.scoreChange / p.scoreAtEntry) * 100;
    if (scoreMovePct <= -12) {
      reasons.push(`AI score also fell ${Math.abs(scoreMovePct).toFixed(1)}% from the entry score, so the rank move is backed by weaker model conviction`);
    } else if (scoreMovePct >= 5) {
      reasons.push(`AI score is not falling materially, so this looks more like other stocks improving faster than ${p.ticker}`);
    } else {
      reasons.push(`AI score is broadly flat, so the rank drop may be mostly relative movement versus stronger peers`);
    }
  }

  if (p.pnlPercent <= -5) {
    reasons.push(`price action is weak, with the position down ${Math.abs(p.pnlPercent).toFixed(1)}%`);
  } else if (p.pnlPercent >= 5) {
    reasons.push(`price action is still positive, so this is more likely factor/peer-relative deterioration than a simple sell-off`);
  }

  if (p.recentNegativeNewsCount >= 3) {
    reasons.push(`${p.recentNegativeNewsCount} recent negative news items are adding headline risk`);
  } else if (p.recentPositiveNewsCount >= 4) {
    reasons.push(`recent news flow remains positive, so the rank move is more likely model/factor driven than news driven`);
  }

  if ((p.sectorMomentum === "Weak" || p.sectorMomentum === "Struggling") && p.sectorBullishPct <= 30) {
    reasons.push(`${p.sector ?? "the sector"} backdrop is weak, with only ${p.sectorBullishPct}% of the sector in the top quartile`);
  } else if (p.sectorMomentum === "Booming" || p.sectorMomentum === "Strong") {
    reasons.push(`${p.sector ?? "the sector"} backdrop remains ${p.sectorMomentum.toLowerCase()}, so the issue is more stock-specific or peer-relative`);
  }

  return `Likely drivers: ${reasons.length ? reasons.join(". ") : "factor diagnostics are not available yet, so this appears to be mainly peer-relative movement within the ranking model"}.`;
}

function explainWeakRank(p: {
  ticker: string;
  rank: number | null;
  totalStocks: number;
  score: number;
  scoreAtEntry: number | null;
  scoreChange: number;
  pnlPercent: number;
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  sector: string | null;
  factorDiagnostics?: Record<string, any> | null;
}) {
  const reasons = strongestFactorDrivers(p.factorDiagnostics);

  if (p.scoreAtEntry && p.scoreAtEntry > 0) {
    const scoreMovePct = (p.scoreChange / p.scoreAtEntry) * 100;
    if (scoreMovePct <= -10) reasons.push(`score has fallen ${Math.abs(scoreMovePct).toFixed(1)}% versus the entry score`);
  }

  if (p.pnlPercent <= -5) reasons.push(`price action is also negative, with the position down ${Math.abs(p.pnlPercent).toFixed(1)}%`);
  if ((p.sectorMomentum === "Weak" || p.sectorMomentum === "Struggling") && p.sectorBullishPct <= 30) {
    reasons.push(`${p.sector ?? "the sector"} is weak, with only ${p.sectorBullishPct}% top-quartile participation`);
  }

  return `Likely drivers: ${reasons.length ? reasons.join(". ") : "the stock is being outscored by stronger peers across the current factor mix"}.`;
}

'''

if "function explainRankDrop" not in text:
    marker = "function buildAlerts(p:"
    if marker not in text:
        raise SystemExit("Could not find buildAlerts marker")
    text = text.replace(marker, helper + marker, 1)

# Improve bottom-quartile poor signal message.
old_poor = '''      message: `Score of ${p.score.toLocaleString()} is well below the threshold for a healthy hold. Hundreds of stocks are scoring better right now.`,
'''
new_poor = '''      message: `Score of ${p.score.toLocaleString()} is well below the threshold for a healthy hold. ${explainWeakRank(p)}`,
'''
if old_poor in text:
    text = text.replace(old_poor, new_poor, 1)

# Improve weak-rank message.
old_weak = '''      message: `Most stocks are scoring better than ${p.ticker} right now.`,
'''
new_weak = '''      message: `Most stocks are scoring better than ${p.ticker} right now. ${explainWeakRank(p)}`,
'''
if old_weak in text:
    text = text.replace(old_weak, new_weak, 1)

# Improve rank-drop message.
old_rank = '''        message: `From #${p.rankAtEntry} to #${p.rank}. That is a ${move.placeLabel} drop, or about ${move.pctPoints} percentage points of the ranked universe — not a ${move.pctPoints}% loss in value.`,
'''
new_rank = '''        message: `From #${p.rankAtEntry} to #${p.rank}. ${explainRankDrop(p)}`,
'''
if old_rank not in text:
    raise SystemExit("Could not find rank-drop message block")
text = text.replace(old_rank, new_rank, 1)

required = [
    "function explainRankDrop",
    "function explainWeakRank",
    "strongestFactorDrivers",
    "Likely drivers:",
    "factor-level deterioration was led by",
    "message: `From #${p.rankAtEntry} to #${p.rank}. ${explainRankDrop(p)}`",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected content after patch: {missing}")

path.write_text(text)
print("Improved alert reasons so rank/weak-signal alerts explain drivers instead of repeating the event.")
