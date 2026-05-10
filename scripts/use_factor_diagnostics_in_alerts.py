from pathlib import Path

path = Path("lib/portfolio-alerts.ts")
text = path.read_text()

if "factorDiagnostics" not in text:
    text = text.replace(
'''function explainScoreDrop(p: {
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
}, dropPct: number) {''',
'''function formatFactorName(factor: string) {
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
}, dropPct: number) {''')

    marker = '''  if (dropPct <= -35) {
    reasons.push("the size of the score move is unusually large, which often means one or more inputs changed materially or came back differently from the data provider");
  }

  return `Reason: ${reasons.join(". ")}.`;
}
'''
    replacement = '''  const diagnostics = p.factorDiagnostics;
  if (diagnostics) {
    const sleeveReasons = [
      formatSleeveChange("Momentum", diagnostics.momentum_change),
      formatSleeveChange("Growth", diagnostics.growth_change),
      formatSleeveChange("Quality", diagnostics.quality_change),
      formatSleeveChange("Value", diagnostics.value_change),
      formatSleeveChange("Risk", diagnostics.risk_change),
      formatSleeveChange("Income", diagnostics.income_change),
    ].filter(Boolean) as string[];

    if (sleeveReasons.length > 0) {
      reasons.push(`exact sleeve drivers: ${sleeveReasons.slice(0, 3).join(", ")}`);
    }

    const negativeFactors = Array.isArray(diagnostics.top_negative_factors)
      ? diagnostics.top_negative_factors.slice(0, 4)
      : [];

    if (negativeFactors.length > 0) {
      const factorText = negativeFactors
        .map((item: any) => {
          const factor = formatFactorName(String(item.factor ?? "Unknown factor"));
          const change = Number(item.change);
          return Number.isFinite(change)
            ? `${factor} (${change.toFixed(3)})`
            : factor;
        })
        .join(", ");
      reasons.push(`largest negative factor-level changes: ${factorText}`);
    }

    const previousScore = Number(diagnostics.previous_score);
    const currentScore = Number(diagnostics.current_score ?? diagnostics.smoothed_score);
    if (Number.isFinite(previousScore) && Number.isFinite(currentScore) && previousScore > 0) {
      reasons.push(`diagnostic run score moved from ${Math.round(previousScore).toLocaleString()} to ${Math.round(currentScore).toLocaleString()}`);
    }
  }

  if (dropPct <= -35) {
    reasons.push("the size of the score move is unusually large, which often means one or more inputs changed materially or came back differently from the data provider");
  }

  return `Reason: ${reasons.join(". ")}.`;
}
'''
    if marker not in text:
        raise SystemExit("Could not find score drop return marker")
    text = text.replace(marker, replacement, 1)

# Add factorDiagnostics to buildAlerts input type.
text = text.replace(
'''  daysHeld: number; riskTolerance: RiskTolerance; totalStocks: number;
}): HoldingAlert[] {''',
'''  daysHeld: number; riskTolerance: RiskTolerance; totalStocks: number;
  factorDiagnostics?: Record<string, any> | null;
}): HoldingAlert[] {''')

# Fetch diagnostics in enrichHoldings if not already added.
if "stock_factor_diagnostics" not in text:
    marker = '''  const { momentum, bullishPct, maxScore, totalStocks } = await getSectorData();
'''
    replacement = '''  const { momentum, bullishPct, maxScore, totalStocks } = await getSectorData();

  const { data: factorDiagnosticsData } = await supabase
    .from("stock_factor_diagnostics")
    .select("ticker,previous_score,current_score,smoothed_score,factor_coverage,quality_change,growth_change,value_change,momentum_change,risk_change,income_change,top_negative_factors,top_positive_factors");

  const factorDiagnosticsByTicker = new Map(
    (factorDiagnosticsData ?? []).map((row: any) => [row.ticker as string, row])
  );
'''
    if marker not in text:
        raise SystemExit("Could not find enrichHoldings sector marker")
    text = text.replace(marker, replacement, 1)

# Pass diagnostics into buildAlerts.
text = text.replace(
'''      riskTolerance,
      totalStocks,
    });''',
'''      riskTolerance,
      totalStocks,
      factorDiagnostics: factorDiagnosticsByTicker.get(ticker) ?? null,
    });''')

path.write_text(text)
print("Website score-drop alerts now use exact factor diagnostics when available.")
