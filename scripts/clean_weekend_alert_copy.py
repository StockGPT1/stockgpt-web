from pathlib import Path

path = Path("lib/portfolio-alerts.ts")
text = path.read_text()

old_recent = '''          message: weekendRecalibration
            ? `Score moved ${Math.abs(Math.round(dropPct))}% since you added it, but this happened while the market was closed and price has not meaningfully moved. ${reason}`
            : `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. ${reason}`,
          recommendation: weekendRecalibration
            ? `Do not sell purely from this alert. Wait for the next trading session and factor diagnostics confirmation before acting.`
            : `Sell. The thesis broke before you even got going.`,
'''
new_recent = '''          message: weekendRecalibration
            ? `${reason}`
            : `Score has crashed ${Math.abs(Math.round(dropPct))}% since you added it. ${reason}`,
          recommendation: weekendRecalibration
            ? `Do not act from this alert alone. Wait for the next market session and look for confirmation from price action or factor diagnostics.`
            : `The signal needs urgent review. Confirm the factor drivers and compare against stronger-ranked alternatives before making a portfolio decision.`,
'''
if old_recent not in text:
    raise SystemExit("Could not find recent weekend score alert wording")
text = text.replace(old_recent, new_recent, 1)

text = text.replace(
    "Do not sell purely from this alert. Wait for the next trading session and factor diagnostics confirmation before acting.",
    "Do not act from this alert alone. Wait for the next market session and look for confirmation from price action or factor diagnostics.",
)
text = text.replace(
    "Do not rotate purely because of a weekend rank move. Wait for the next trading session and exact factor diagnostics confirmation.",
    "Do not act from this alert alone. Wait for the next market session and look for confirmation from price action or factor diagnostics.",
)

text = text.replace(
    "Reason: this happened during a weekend/non-trading recalculation, with no meaningful price move since entry, so it is more likely a model/data refresh than confirmed stock deterioration. exact factor diagnostics are not available yet for this move, so the system should wait for the next market session before treating it as a sell signal.",
    "This happened during a weekend/non-trading recalculation. No normal market session has passed since entry and the price has not meaningfully moved, so this looks like a data/model refresh rather than confirmed deterioration in the company. Exact factor diagnostics are not available yet for this move, so treat it as unconfirmed until the next ranking run stores factor-level changes.",
)

text = text.replace(
    "the size of the score move is unusually large, which often means one or more inputs changed materially or came back differently from the data provider",
    "the size of the score move is unusually large, which usually points to a material input/factor change rather than ordinary price action",
)

required = [
    "Do not act from this alert alone",
    "No normal market session has passed since entry",
    "material input/factor change rather than ordinary price action",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected cleaned copy: {missing}")

path.write_text(text)
print("Cleaned weekend alert copy to avoid repetitive and overconfident wording.")
