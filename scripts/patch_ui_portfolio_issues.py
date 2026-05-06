from pathlib import Path
import re


def patch_saved_portfolio():
    path = Path("components/SavedPortfolio.tsx")
    text = path.read_text()

    # Remove duplicate company logos inside AI alert titles. The holding card already shows
    # the company logo, and a previous patch accidentally nested two more inside alerts.
    duplicate = '<div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div></div>'
    clean = '<p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p>'
    text = text.replace(duplicate, clean)

    # Also handle the single-logo variant so alert rows never duplicate the holding logo.
    single = '<div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div>'
    text = text.replace(single, clean)

    path.write_text(text)


def patch_portfolio_alerts():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    # Poor-signal alerts must be rank-based. Rank #100 of ~500 is top ~20%, not bottom 25%.
    text = text.replace("if (p.scorePercentile < 25) {", "if (p.rankPercentile < 25) {")
    text = text.replace(
        "title: `${p.ticker} has a poor AI signal — bottom ${p.scorePercentile}% of stocks`,",
        "title: `${p.ticker} has a poor AI signal — bottom ${Math.max(1, 100 - p.rankPercentile)}% of stocks`,",
    )

    # Recommendations must also use rank position rather than raw score scaling.
    text = re.sub(
        r"function deriveRecommendation\(\n  alerts: HoldingAlert\[\],\n  positionPct: number,\n  scorePercentile: number,\n  rank: number \| null,\n  totalStocks: number\n\): EnrichedHolding\[\"recommendation\"\] \{\n  // Bottom-quartile stocks get the most decisive recommendation\n  if \(scorePercentile < 25\) return \"Sell Immediately\";",
        """function deriveRecommendation(
  alerts: HoldingAlert[],
  positionPct: number,
  scorePercentile: number,
  rank: number | null,
  totalStocks: number
): EnrichedHolding[\"recommendation\"] {
  const rankPercentile = rank && totalStocks
    ? Math.max(0, Math.round(100 - ((rank - 1) / totalStocks) * 100))
    : scorePercentile;
  // Bottom-quartile stocks get the most decisive recommendation
  if (rankPercentile < 25) return \"Sell Immediately\";""",
        text,
        count=1,
    )

    # Defensive cleanup for any existing AI summaries that still contain impossible wording.
    text = text.replace(
        "the AI signal is in the bottom 25%",
        "the AI signal is in the bottom quartile",
    )

    if "if (p.scorePercentile < 25)" in text:
        raise SystemExit("Failed to replace scorePercentile poor-signal alert")
    if "<StockLogo ticker={holding.ticker} company={holding.company} size={18}" in Path("components/SavedPortfolio.tsx").read_text():
        raise SystemExit("Failed to remove alert-row duplicate StockLogo")

    path.write_text(text)


patch_saved_portfolio()
patch_portfolio_alerts()
print("Patched duplicate AI alert logos and rank-based portfolio alert percentiles.")
