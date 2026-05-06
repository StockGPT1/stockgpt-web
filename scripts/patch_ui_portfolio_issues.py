from pathlib import Path
import re
import subprocess

BASE_SAFE_COMMIT = "f0f2a6d228923a35cd534400093b70e1e66d7b2a"


def patch_dashboard():
    path = Path("app/page.tsx")
    text = path.read_text()
    text = text.replace(">\n                  5d\n                </span>", ">\n                  1D\n                </span>")
    text = re.sub(
        r"\n\s*<div\n\s*className=\{`grid \$\{dashboardRankingsGrid\} h-\[27px\] shrink-0 items-center bg-\[#072116\] text-\[#faf6f0\]`\}\n\s*>\n(?:.|\n)*?\n\s*</div>\n\n\s*<div className=\"min-h-0 flex-1 overflow-hidden\">",
        "\n                  <div className=\"min-h-0 flex-1 overflow-hidden\">",
        text,
        count=1,
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


def patch_portfolio_alerts_from_safe_base():
    subprocess.run(["git", "checkout", BASE_SAFE_COMMIT, "--", "lib/portfolio-alerts.ts"], check=True)
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    old_sector = '''async function getSectorData() {
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("stock_rankings").select("score")
    .order("score", { ascending: false }).limit(1).maybeSingle();
  const maxScore = Math.max(Number(maxRow?.score) || 10000, 1);
  const bullishThreshold = maxScore * 0.7;

  const { data: allStocks } = await supabase
    .from("stock_rankings").select("sector, score");

  const totalStocks = (allStocks ?? []).length || 500;

  const bySector: Record<string, { total: number; bullish: number }> = {};
  (allStocks ?? []).forEach((s) => {
    const sector = s.sector ?? "—";
    if (!bySector[sector]) bySector[sector] = { total: 0, bullish: 0 };
    bySector[sector].total++;
    if (Number(s.score) >= bullishThreshold) bySector[sector].bullish++;
  });

  const momentum: Record<string, SectorMomentum> = {};
  const bullishPct: Record<string, number> = {};
  Object.entries(bySector).forEach(([sector, { total, bullish }]) => {
    const pct = total > 0 ? Math.round((bullish / total) * 100) : 0;
    bullishPct[sector] = pct;
    if (pct >= 50) momentum[sector] = "Booming";
    else if (pct >= 35) momentum[sector] = "Strong";
    else if (pct >= 20) momentum[sector] = "Mixed";
    else if (pct >= 10) momentum[sector] = "Weak";
    else momentum[sector] = "Struggling";
  });
  return { momentum, bullishPct, maxScore, totalStocks };
}
'''
    new_sector = '''async function getSectorData() {
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
'''
    if old_sector not in text:
        raise SystemExit("Could not find original getSectorData block")
    text = text.replace(old_sector, new_sector)

    text = re.sub(
        r"const scorePercentile = Math\.round\(\(score / maxScore\) \* 100\);\n\s*const rankPercentile =([^;]+);",
        r"const rankPercentile =\1;\n    const scorePercentile = rankPercentile;",
        text,
        count=1,
    )
    text = re.sub(
        r"const scorePercentile = Math\.round\(\(current\.score / sectorData\.maxScore\) \* 100\);\n\s*const rankPercentile =([^;]+);",
        r"const rankPercentile =\1;\n    const scorePercentile = rankPercentile;",
        text,
        count=1,
    )
    path.write_text(text)


patch_dashboard()
patch_saved_portfolio_logos()
patch_portfolio_alerts_from_safe_base()
print("Applied deployment-safe portfolio/dashboard hotfix.")
