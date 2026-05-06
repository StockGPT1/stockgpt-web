from pathlib import Path
import re

# Triggered after workflow creation. Applies portfolio/dashboard fixes safely.


def replace(path: Path, old: str, new: str, required: bool = True):
    text = path.read_text()
    if old not in text:
        if required:
            raise SystemExit(f"Missing expected text in {path}: {old[:160]!r}")
        return False
    path.write_text(text.replace(old, new))
    return True


def patch_dashboard():
    path = Path("app/page.tsx")
    text = path.read_text()

    text = text.replace(">\n                  5d\n                </span>", ">\n                  1D\n                </span>")

    # Remove the desktop table header row from the Top 10 dashboard card. In the fixed-height
    # layout this can visually look like an extra bottom row: TICKER / COMPANY / MOVE / etc.
    text = re.sub(
        r"\n\s*<div\n\s*className=\{`grid \$\{dashboardRankingsGrid\} h-\[27px\] shrink-0 items-center bg-\[#072116\] text-\[#faf6f0\]`\}\n\s*>\n(?:.|\n)*?\n\s*</div>\n\n\s*<div className=\"min-h-0 flex-1 overflow-hidden\">",
        "\n                  <div className=\"min-h-0 flex-1 overflow-hidden\">",
        text,
        count=1,
    )

    path.write_text(text)


def patch_portfolio_alert_logic():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    text = re.sub(
        r"async function getSectorData\(\) \{(?:.|\n)*?\n\}\n\nfunction daysBetween",
        '''async function getSectorData() {
  const supabase = await createClient();

  const { data: allStocks } = await supabase
    .from("stock_rankings").select("sector, rank, score");

  const totalStocks = (allStocks ?? []).length || 500;
  const topQuartileRank = Math.max(1, Math.ceil(totalStocks * 0.25));
  const topHalfRank = Math.max(1, Math.ceil(totalStocks * 0.50));
  const maxScore = Math.max(...(allStocks ?? []).map((s) => Number(s.score) || 0), 1);

  const bySector: Record<string, { total: number; bullish: number; healthy: number }> = {};
  (allStocks ?? []).forEach((s) => {
    const sector = s.sector ?? "—";
    const rank = Number(s.rank);
    if (!bySector[sector]) bySector[sector] = { total: 0, bullish: 0, healthy: 0 };
    bySector[sector].total++;
    if (Number.isFinite(rank) && rank > 0 && rank <= topQuartileRank) bySector[sector].bullish++;
    if (Number.isFinite(rank) && rank > 0 && rank <= topHalfRank) bySector[sector].healthy++;
  });

  const momentum: Record<string, SectorMomentum> = {};
  const bullishPct: Record<string, number> = {};
  Object.entries(bySector).forEach(([sector, { total, bullish, healthy }]) => {
    const pct = total > 0 ? Math.round((bullish / total) * 100) : 0;
    const healthyPct = total > 0 ? Math.round((healthy / total) * 100) : 0;
    bullishPct[sector] = pct;
    if (pct >= 35) momentum[sector] = "Booming";
    else if (pct >= 25) momentum[sector] = "Strong";
    else if (healthyPct >= 45) momentum[sector] = "Mixed";
    else if (healthyPct >= 30) momentum[sector] = "Weak";
    else momentum[sector] = "Struggling";
  });
  return { momentum, bullishPct, maxScore, totalStocks };
}

function rankTopPct(rankPercentile: number) {
  return Math.max(1, 100 - rankPercentile);
}

function rankBottomPct(rankPercentile: number) {
  return Math.max(1, 100 - rankPercentile);
}

function daysBetween''',
        text,
        count=1,
    )

    text = text.replace("if (p.scorePercentile < 25) {", "if (p.rankPercentile < 25) {")
    text = text.replace(
        "title: `${p.ticker} has a poor AI signal — bottom ${p.scorePercentile}% of stocks`,",
        "title: `${p.ticker} has a poor AI signal — bottom ${rankBottomPct(p.rankPercentile)}% of stocks`,",
    )
    text = re.sub(
        r"function deriveRecommendation\(\n  alerts: HoldingAlert\[\],\n  positionPct: number,\n  scorePercentile: number,\n  rank: number \| null,\n  totalStocks: number\n\): EnrichedHolding\[\"recommendation\"\] \{\n  // Bottom-quartile stocks get the most decisive recommendation\n  if \(scorePercentile < 25\) return \"Sell Immediately\";",
        '''function deriveRecommendation(
  alerts: HoldingAlert[],
  positionPct: number,
  scorePercentile: number,
  rank: number | null,
  totalStocks: number
): EnrichedHolding["recommendation"] {
  const rankPercentile = rank && totalStocks
    ? Math.max(0, Math.round(100 - ((rank - 1) / totalStocks) * 100))
    : scorePercentile;
  // Bottom-quartile stocks get the most decisive recommendation
  if (rankPercentile < 25) return "Sell Immediately";''',
        text,
        count=1,
    )
    text = text.replace(
        "scorePercentile: number; rank: number | null; totalStocks: number;",
        "scorePercentile: number; rankPercentile: number; rank: number | null; totalStocks: number;",
        1,
    )
    text = text.replace(
        "if (p.scorePercentile < 25 || (p.rank && p.totalStocks && p.rank > p.totalStocks * 0.85)) {",
        "if (p.rankPercentile < 25 || (p.rank && p.totalStocks && p.rank > p.totalStocks * 0.85)) {",
    )
    text = text.replace(
        "condition: `${p.ticker} is poorly rated (rank #${p.rank ?? \"—\"}, bottom ${p.scorePercentile}%)`,",
        "condition: `${p.ticker} is poorly rated (rank #${p.rank ?? \"—\"}, bottom ${rankBottomPct(p.rankPercentile)}%)`,",
    )
    text = text.replace(
        "scorePercentile: number;\n  pnlPercent: number;",
        "scorePercentile: number;\n  rankPercentile: number;\n  pnlPercent: number;",
    )
    text = text.replace("the AI signal is in the bottom 25%", "the AI signal is in the bottom quartile")
    text = text.replace("p.scorePercentile >= 75", "p.rankPercentile >= 75")
    text = text.replace("p.scorePercentile >= 70", "p.rankPercentile >= 70")
    text = text.replace("top ${100 - p.scorePercentile}%", "top ${rankTopPct(p.rankPercentile)}%")
    text = text.replace("bottom ${100 - p.scorePercentile}%", "bottom ${rankBottomPct(p.rankPercentile)}%")
    text = text.replace("top ${100 - p.scorePercentile}%).", "top ${rankTopPct(p.rankPercentile)}%).")
    text = text.replace("top ${100 - p.scorePercentile}% AI score", "top ${rankTopPct(p.rankPercentile)}% AI rank")
    text = text.replace("top ${100 - p.scorePercentile}%)", "top ${rankTopPct(p.rankPercentile)}%)")
    text = text.replace(
        "scorePercentile,\n      rank: current.rank,",
        "scorePercentile,\n      rankPercentile,\n      rank: current.rank,",
    )
    text = text.replace(
        "scorePercentile,\n      pnlPercent,",
        "scorePercentile,\n      rankPercentile,\n      pnlPercent,",
    )

    path.write_text(text)


def patch_saved_portfolio_logos():
    path = Path("components/SavedPortfolio.tsx")
    text = path.read_text()

    if 'import { StockLogo } from "@/components/StockLogo";' not in text:
        text = text.replace(
            'import Link from "next/link";\n',
            'import Link from "next/link";\nimport { StockLogo } from "@/components/StockLogo";\n',
        )

    text = text.replace(
        '''            <Link href={`/stock/${holding.ticker}`} className="hover:underline">
              <p className="mt-1 truncate text-[14px] font-bold" style={{ color: "rgba(7,33,22,0.85)" }}>
                {holding.company ?? holding.ticker}
              </p>
            </Link>''',
        '''            <Link href={`/stock/${holding.ticker}`} className="mt-1 flex min-w-0 items-center gap-2 hover:underline">
              <StockLogo ticker={holding.ticker} company={holding.company} size={22} />
              <p className="truncate text-[14px] font-bold" style={{ color: "rgba(7,33,22,0.85)" }}>
                {holding.company ?? holding.ticker}
              </p>
            </Link>''',
    )

    text = text.replace(
        '<p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p>',
        '<div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div>',
    )

    path.write_text(text)


patch_dashboard()
patch_portfolio_alert_logic()
patch_saved_portfolio_logos()
print("Patched dashboard, portfolio alert logic, and portfolio logos.")
