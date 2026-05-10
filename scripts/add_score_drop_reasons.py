from pathlib import Path

path = Path("lib/portfolio-alerts.ts")
text = path.read_text()

helper = '''
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
}, dropPct: number) {
  const reasons: string[] = [];

  if (p.rank && p.rankAtEntry) {
    const move = describeRankMove(p.rankAtEntry, p.rank, p.totalStocks);

    if (move.places >= 50) {
      reasons.push(
        `rank also weakened from #${p.rankAtEntry} to #${p.rank}, so the score drop is being confirmed by relative ranking deterioration`
      );
    } else if (move.places > 0) {
      reasons.push(
        `rank slipped only ${move.placeLabel} from #${p.rankAtEntry} to #${p.rank}, so this looks more like score compression than a full thesis collapse`
      );
    } else if (move.places <= -10) {
      reasons.push(
        `rank actually improved from #${p.rankAtEntry} to #${p.rank}, so the absolute score fell while relative position improved`
      );
    } else {
      reasons.push(
        `rank stayed broadly stable near #${p.rank}, so the move is likely caused by absolute score recalibration rather than a major ranking collapse`
      );
    }
  } else {
    reasons.push("there is no reliable entry-rank comparison yet, so this is based mainly on score change");
  }

  if (p.pnlPercent <= -8) {
    reasons.push(`price performance is also weak, with the position down ${Math.abs(p.pnlPercent).toFixed(1)}%`);
  } else if (p.pnlPercent >= 8) {
    reasons.push(`price action is still positive, with the position up ${p.pnlPercent.toFixed(1)}%, so this is not simply a price-loss alert`);
  }

  if (p.recentNegativeNewsCount >= 3) {
    reasons.push(`${p.recentNegativeNewsCount} recent negative news items are adding headline risk`);
  } else if (p.recentPositiveNewsCount >= 4) {
    reasons.push(`recent news flow is still positive, so the score drop is more likely model/factor driven than news driven`);
  }

  if ((p.sectorMomentum === "Weak" || p.sectorMomentum === "Struggling") && p.sectorBullishPct <= 25) {
    reasons.push(`${p.sector ?? "the sector"} is weak, with only ${p.sectorBullishPct}% of the sector in the top quartile`);
  } else if (p.sectorMomentum === "Booming" || p.sectorMomentum === "Strong") {
    reasons.push(`${p.sector ?? "the sector"} backdrop remains ${p.sectorMomentum.toLowerCase()}, so the issue is more stock-specific/model-specific`);
  }

  if (dropPct <= -35) {
    reasons.push("the size of the score move is unusually large, which often means one or more inputs changed materially or came back differently from the data provider");
  }

  return `Reason: ${reasons.join(". ")}.`;
}

'''

if "function explainScoreDrop" not in text:
    marker = "function buildAlerts(p: {"
    if marker not in text:
        raise SystemExit("Could not find buildAlerts marker")
    text = text.replace(marker, helper + marker, 1)

old_recent = '''      if (dropPct <= -25) {
        alerts.push({
          type: "score_drop", severity: "critical",
          title: `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. Major model shift.`,
          recommendation: `Sell. The thesis broke before you even got going.`,
        });
      }
'''
new_recent = '''      if (dropPct <= -25) {
        const reason = explainScoreDrop(p, dropPct);
        alerts.push({
          type: "score_drop", severity: "critical",
          title: `${p.ticker} score collapsed within ${p.daysHeld} days`,
          message: `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. ${reason}`,
          recommendation: `Sell. The thesis broke before you even got going.`,
        });
      }
'''
if old_recent in text:
    text = text.replace(old_recent, new_recent, 1)
elif "const reason = explainScoreDrop(p, dropPct);" not in text:
    raise SystemExit("Could not patch recent score collapse block")

old_critical = '''    if (dropPct <= -25) {
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
'''
new_critical = '''    if (dropPct <= -25) {
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
'''
if old_critical in text:
    text = text.replace(old_critical, new_critical, 1)
elif "AI conviction has crashed" in text and "Reason:" not in text:
    raise SystemExit("Could not patch normal score drop block")

required = [
    "function explainScoreDrop",
    "Reason:",
    "score compression",
    "data provider",
    "const reason = explainScoreDrop(p, dropPct);",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected patch content: {missing}")

path.write_text(text)
print("Added reasoned explanations to score-drop alerts.")
