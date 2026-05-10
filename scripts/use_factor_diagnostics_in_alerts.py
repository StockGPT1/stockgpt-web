from pathlib import Path

path = Path("lib/portfolio-alerts.ts")
text = path.read_text()

helper = r'''
function formatFactorName(factor: string) {
  return factor
    .replace(/_/g, " ")
    .replace(/\brel\b/gi, "relative")
    .replace(/\bz\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSleeveChange(label: string, value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.00001) return null;
  return `${label} ${n < 0 ? "fell" : "rose"} by ${Math.abs(n).toFixed(3)} contribution points`;
}

function explainScoreDrop(p: {
  ticker: string;
  scoreChange: number;
  scoreAtEntry: number | null;
  score: number;
  rank: number | null;
  rankAtEntry: number | null;
  pnlPercent: number;
  recentNegativeNewsCount: number;
  recentPositiveNewsCount: number;
  sectorMomentum: SectorMomentum;
  sectorBullishPct: number;
  sector: string | null;
  rankPercentile: number;
  scorePercentile: number;
  totalStocks: number;
  factorDiagnostics?: Record<string, any> | null;
}, dropPct: number) {
  const reasons: string[] = [];

  if (p.rank && p.rankAtEntry) {
    const move = describeRankMove(p.rankAtEntry, p.rank, p.totalStocks);
    if (move.places >= 50) {
      reasons.push(`rank also weakened from #${p.rankAtEntry} to #${p.rank}`);
    } else if (move.places > 0) {
      reasons.push(`rank slipped only ${move.placeLabel} from #${p.rankAtEntry} to #${p.rank}, so this looks more like score compression than a full thesis collapse`);
    } else if (move.places <= -10) {
      reasons.push(`rank improved from #${p.rankAtEntry} to #${p.rank}, so the absolute score fell while relative position improved`);
    } else {
      reasons.push(`rank stayed broadly stable near #${p.rank}, so the move is likely absolute score recalibration rather than a major ranking collapse`);
    }
  }

  if (p.pnlPercent <= -8) reasons.push(`price performance is also weak, with the position down ${Math.abs(p.pnlPercent).toFixed(1)}%`);
  else if (p.pnlPercent >= 8) reasons.push(`price action is still positive, with the position up ${p.pnlPercent.toFixed(1)}%, so this is not simply a price-loss alert`);

  if (p.recentNegativeNewsCount >= 3) reasons.push(`${p.recentNegativeNewsCount} recent negative news items are adding headline risk`);
  else if (p.recentPositiveNewsCount >= 4) reasons.push(`recent news flow is still positive, so the score drop is more likely model/factor driven than news driven`);

  if ((p.sectorMomentum === "Weak" || p.sectorMomentum === "Struggling") && p.sectorBullishPct <= 25) {
    reasons.push(`${p.sector ?? "the sector"} is weak, with only ${p.sectorBullishPct}% of the sector in the top quartile`);
  } else if (p.sectorMomentum === "Booming" || p.sectorMomentum === "Strong") {
    reasons.push(`${p.sector ?? "the sector"} backdrop remains ${p.sectorMomentum.toLowerCase()}, so the issue is more stock-specific/model-specific`);
  }

  const diagnostics = p.factorDiagnostics;
  if (diagnostics) {
    const sleeveReasons = [
      formatSleeveChange("Momentum", diagnostics.momentum_change),
      formatSleeveChange("Growth", diagnostics.growth_change),
      formatSleeveChange("Quality", diagnostics.quality_change),
      formatSleeveChange("Value", diagnostics.value_change),
      formatSleeveChange("Risk", diagnostics.risk_change),
      formatSleeveChange("Income", diagnostics.income_change),
    ].filter(Boolean) as string[];

    if (sleeveReasons.length > 0) reasons.push(`exact sleeve drivers: ${sleeveReasons.slice(0, 3).join(", ")}`);

    const negativeFactors = Array.isArray(diagnostics.top_negative_factors) ? diagnostics.top_negative_factors.slice(0, 4) : [];
    if (negativeFactors.length > 0) {
      const factorText = negativeFactors.map((item: any) => {
        const factor = formatFactorName(String(item.factor ?? "Unknown factor"));
        const change = Number(item.change);
        return Number.isFinite(change) ? `${factor} (${change.toFixed(3)})` : factor;
      }).join(", ");
      reasons.push(`largest negative factor-level changes: ${factorText}`);
    }

    const previousScore = Number(diagnostics.previous_score);
    const currentScore = Number(diagnostics.current_score ?? diagnostics.smoothed_score);
    if (Number.isFinite(previousScore) && Number.isFinite(currentScore) && previousScore > 0) {
      reasons.push(`diagnostic run score moved from ${Math.round(previousScore).toLocaleString()} to ${Math.round(currentScore).toLocaleString()}`);
    }
  }

  if (dropPct <= -35) reasons.push("the size of the score move is unusually large, which often means one or more inputs changed materially or came back differently from the data provider");

  return `Reason: ${reasons.length ? reasons.join(". ") : "the score fell materially versus the entry score"}.`;
}

'''

# Insert helper before buildAlerts, replacing any old helper if present.
start = text.find("function formatFactorName(")
if start != -1:
    end = text.find("function buildAlerts(p:", start)
    if end == -1:
        raise SystemExit("Could not find buildAlerts after existing helper")
    text = text[:start] + helper + text[end:]
else:
    marker = "function buildAlerts(p:"
    if marker not in text:
        raise SystemExit("Could not find buildAlerts marker")
    text = text.replace(marker, helper + marker, 1)

# Add diagnostics field to buildAlerts input type.
text = text.replace(
    "  daysHeld: number; riskTolerance: RiskTolerance; totalStocks: number;\n}): HoldingAlert[] {",
    "  daysHeld: number; riskTolerance: RiskTolerance; totalStocks: number;\n  factorDiagnostics?: Record<string, any> | null;\n}): HoldingAlert[] {",
)

# Replace score-drop messages with reasoned versions.
text = text.replace(
'''      if (dropPct <= -25) {
        alerts.push({
          type: "score_drop", severity: "critical",
          title: `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. Major model shift.`,
          recommendation: `Sell. The thesis broke before you even got going.`,
        });
      }
''',
'''      if (dropPct <= -25) {
        const reason = explainScoreDrop(p, dropPct);
        alerts.push({
          type: "score_drop", severity: "critical",
          title: `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. ${reason}`,
          recommendation: `Sell. The thesis broke before you even got going.`,
        });
      }
''')

text = text.replace(
'''    if (dropPct <= -25) {
      alerts.push({
        type: "score_drop", severity: "critical",
        title: `${p.ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `Score dropped from ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()} since you bought.`,
        recommendation: isSmallPosition
          ? `Sell the entire ${p.currentAllocationPct.toFixed(1)}% position. Don't manage a small loser.`
          : `Sell at least half. The AI's view has fundamentally shifted.`,
      });
    } else if (dropPct <= -12) {
      alerts.push({
        type: "score_drop", severity: "warning",
        title: `${p.ticker} AI score weakened ${Math.abs(Math.round(dropPct))}%`,
        message: `From ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()}. Conviction is fading.`,
        recommendation: isSmallPosition
          ? `Consider exiting the whole position. Small holdings aren't worth the babysitting.`
          : `Don't add more. If score drops another 10%, sell at least half.`,
      });
    } else if (dropPct >= 12) {
''',
'''    if (dropPct <= -25) {
      const reason = explainScoreDrop(p, dropPct);
      alerts.push({
        type: "score_drop", severity: "critical",
        title: `${p.ticker} AI conviction has crashed ${Math.abs(Math.round(dropPct))}%`,
        message: `Score dropped from ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()} since you bought. ${reason}`,
        recommendation: isSmallPosition
          ? `Sell the entire ${p.currentAllocationPct.toFixed(1)}% position. Don't manage a small loser.`
          : `Sell at least half. The AI's view has fundamentally shifted.`,
      });
    } else if (dropPct <= -12) {
      const reason = explainScoreDrop(p, dropPct);
      alerts.push({
        type: "score_drop", severity: "warning",
        title: `${p.ticker} AI score weakened ${Math.abs(Math.round(dropPct))}%`,
        message: `From ${p.scoreAtEntry.toLocaleString()} to ${p.score.toLocaleString()}. ${reason}`,
        recommendation: isSmallPosition
          ? `Consider exiting the whole position. Small holdings aren't worth the babysitting.`
          : `Don't add more. If score drops another 10%, sell at least half.`,
      });
    } else if (dropPct >= 12) {
''')

# Add diagnostics fetch in enrichHoldings.
if "stock_factor_diagnostics" not in text:
    marker = "  const { momentum, bullishPct, maxScore, totalStocks } = await getSectorData();\n"
    if marker not in text:
        raise SystemExit("Could not find sector data marker")
    text = text.replace(marker, marker + '''
  const { data: factorDiagnosticsData } = await supabase
    .from("stock_factor_diagnostics")
    .select("ticker,previous_score,current_score,smoothed_score,factor_coverage,quality_change,growth_change,value_change,momentum_change,risk_change,income_change,top_negative_factors,top_positive_factors");

  const factorDiagnosticsByTicker = new Map(
    (factorDiagnosticsData ?? []).map((row: any) => [row.ticker as string, row])
  );
''', 1)

# Pass diagnostics into buildAlerts call.
if "factorDiagnostics:" not in text:
    text = text.replace(
'''      riskTolerance,
      totalStocks,
    });''',
'''      riskTolerance,
      totalStocks,
      factorDiagnostics: factorDiagnosticsByTicker.get(ticker) ?? null,
    });''')

required = [
    "function explainScoreDrop",
    "stock_factor_diagnostics",
    "factorDiagnosticsByTicker",
    "largest negative factor-level changes",
    "exact sleeve drivers",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected content: {missing}")

path.write_text(text)
print("Website score-drop alerts now use exact factor diagnostics when available.")
