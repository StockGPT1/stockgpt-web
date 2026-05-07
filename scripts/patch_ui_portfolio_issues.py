from pathlib import Path
import re


def patch_dashboard_sp500_daily_change():
    path = Path("app/page.tsx")
    text = path.read_text()

    helper = '''
function getChartChangePct(
  data: Partial<Record<string, Array<{ close: number }>>>,
  range = "1D",
) {
  const points = data[range];
  if (!points || points.length < 2) return null;

  const first = points.find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  const last = [...points].reverse().find((p) => Number.isFinite(p.close) && p.close > 0)?.close;

  if (!first || !last || first <= 0) return null;

  return ((last - first) / first) * 100;
}
'''

    if "function getChartChangePct" not in text:
        text = text.replace("\nfunction moveClassName", helper + "\nfunction moveClassName", 1)

    if "const sp500DailyChangePct = getChartChangePct(sp500Data, \"1D\");" not in text:
        text = text.replace(
            "  const topGainers = movers.gainers.slice(0, 3);\n",
            "  const sp500DailyChangePct = getChartChangePct(sp500Data, \"1D\");\n  const topGainers = movers.gainers.slice(0, 3);\n",
            1,
        )

    old = '''                <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
                  1D
                </p>'''
    new = '''                <div className="flex flex-col items-end gap-1">
                  <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
                    1D
                  </p>
                  {sp500DailyChangePct != null && (
                    <p
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${
                        sp500DailyChangePct >= 0
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border-red-400/30 bg-red-500/10 text-red-300"
                      }`}
                    >
                      {sp500DailyChangePct >= 0 ? "+" : ""}{sp500DailyChangePct.toFixed(2)}%
                    </p>
                  )}
                </div>'''

    if old in text:
        text = text.replace(old, new, 1)
    elif "sp500DailyChangePct" not in text[text.find("Market Overview"): text.find("Top Gainers")]:
        raise SystemExit("Could not patch S&P 500 daily change display")

    path.write_text(text)


def patch_saved_portfolio_logos():
    path = Path("components/SavedPortfolio.tsx")
    text = path.read_text()

    # Remove any previous accidental alert-title logos.
    clean = '<p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p>'
    text = re.sub(
        r'<div className="flex items-center gap-2"><StockLogo ticker=\{holding\.ticker\} company=\{holding\.company\} size=\{18\} />\s*' + re.escape(clean) + r'\s*</div>',
        clean,
        text,
    )
    text = text.replace(
        '<div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div></div>',
        clean,
    )
    text = text.replace(
        '<div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div>',
        clean,
    )

    # Make the holding header show the logo next to the ticker + company name as one unit.
    old_header = '''            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/stock/${holding.ticker}`} className="group">
                <p className="text-[28px] font-black tracking-[-0.04em] transition group-hover:text-[#0b2b1d]" style={{ color: "#072116" }}>
                  {holding.ticker}
                </p>
              </Link>
              {/* ✦ Recommendation badge — inline styled */}'''
    new_header = '''            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/stock/${holding.ticker}`} className="group flex min-w-0 items-center gap-3">
                <StockLogo ticker={holding.ticker} company={holding.company} size={34} />
                <div className="min-w-0">
                  <p className="text-[28px] font-black tracking-[-0.04em] transition group-hover:text-[#0b2b1d]" style={{ color: "#072116" }}>
                    {holding.ticker}
                  </p>
                  <p className="truncate text-[13px] font-bold leading-tight" style={{ color: "rgba(7,33,22,0.72)" }}>
                    {holding.company ?? holding.ticker}
                  </p>
                </div>
              </Link>
              {/* ✦ Recommendation badge — inline styled */}'''
    if old_header in text:
        text = text.replace(old_header, new_header, 1)

    # Remove the separate company-name row if it still includes another logo, to avoid duplicate logos.
    old_company = '''            <Link href={`/stock/${holding.ticker}`} className="mt-1 flex min-w-0 items-center gap-2 hover:underline">
              <StockLogo ticker={holding.ticker} company={holding.company} size={22} />
              <p className="truncate text-[14px] font-bold" style={{ color: "rgba(7,33,22,0.85)" }}>
                {holding.company ?? holding.ticker}
              </p>
            </Link>'''
    text = text.replace(old_company, "")

    if "<StockLogo ticker={holding.ticker} company={holding.company} size={18}" in text:
        raise SystemExit("Alert title still contains duplicate StockLogo")

    path.write_text(text)


def patch_portfolio_alert_rank_wording():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    # Add a helper that describes rank moves in places and optional percentage-points of universe.
    helper = '''
function describeRankMove(rankAtEntry: number, currentRank: number, totalStocks: number) {
  const places = currentRank - rankAtEntry;
  const universe = Math.max(totalStocks || 500, 1);
  const pctPoints = Math.round((Math.abs(places) / universe) * 100);
  const placeLabel = `${Math.abs(places)} place${Math.abs(places) === 1 ? "" : "s"}`;
  return { places, pctPoints, placeLabel };
}
'''
    if "function describeRankMove" not in text:
        text = text.replace("\nfunction daysBetween", helper + "\nfunction daysBetween", 1)

    # Ensure poor-signal remains rank-based.
    text = text.replace("if (p.scorePercentile < 25) {", "if (p.rankPercentile < 25) {")
    text = text.replace(
        "title: `${p.ticker} has a poor AI signal — bottom ${p.scorePercentile}% of stocks`,",
        "title: `${p.ticker} has a poor AI signal — bottom ${Math.max(1, 100 - p.rankPercentile)}% of stocks`,",
    )

    old_rank_block = '''  // Rank changes
  if (p.rank && p.rankAtEntry) {
    const rankShift = p.rankAtEntry - p.rank;
    if (rankShift <= -50) {
      alerts.push({
        type: "rank_drop", severity: "warning",
        title: `${p.ticker} fell ${Math.abs(rankShift)} places in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. Other stocks are now scoring better.`,
        recommendation: isSmallPosition
          ? `Sell and rotate the cash into a top-50 ranked stock instead.`
          : `Compare with sector peers. If alternatives are stronger, rotate.`,
      });
    } else if (rankShift >= 30) {
      alerts.push({
        type: "rank_rise", severity: "success",
        title: `${p.ticker} climbed ${rankShift} places in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. Strong outperformance.`,
        recommendation: `Hold the winner. Don't take profits early — this is what compounds wealth.`,
      });
    }
  }
'''
    new_rank_block = '''  // Rank changes — use rank places, not misleading percentage drops.
  if (p.rank && p.rankAtEntry) {
    const move = describeRankMove(p.rankAtEntry, p.rank, p.totalStocks);
    if (move.places >= 50) {
      alerts.push({
        type: "rank_drop", severity: "warning",
        title: `${p.ticker} fell ${move.placeLabel} in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. That is a ${move.placeLabel} drop, or about ${move.pctPoints} percentage points of the ranked universe — not a ${move.pctPoints}% loss in value.`,
        recommendation: isSmallPosition
          ? `Sell and rotate the cash into a top-50 ranked stock instead.`
          : `Compare with sector peers. If alternatives are stronger, rotate.`,
      });
    } else if (move.places <= -30) {
      alerts.push({
        type: "rank_rise", severity: "success",
        title: `${p.ticker} climbed ${move.placeLabel} in the rankings`,
        message: `From #${p.rankAtEntry} to #${p.rank}. Strong outperformance.`,
        recommendation: `Hold the winner. Don't take profits early — this is what compounds wealth.`,
      });
    }
  }
'''
    if old_rank_block in text:
        text = text.replace(old_rank_block, new_rank_block, 1)
    else:
        # Defensive replacements in case whitespace drifted.
        text = text.replace("const rankShift = p.rankAtEntry - p.rank;", "const move = describeRankMove(p.rankAtEntry, p.rank, p.totalStocks);")
        text = text.replace("if (rankShift <= -50)", "if (move.places >= 50)")
        text = text.replace("else if (rankShift >= 30)", "else if (move.places <= -30)")
        text = text.replace("fell ${Math.abs(rankShift)} places", "fell ${move.placeLabel}")
        text = text.replace("climbed ${rankShift} places", "climbed ${move.placeLabel}")

    # Remove any wording that says a rank move is a raw percent drop.
    text = re.sub(r'dropped? \$\{[^}`]+\}% in the rankings', 'dropped in the rankings', text)

    if "dropped ${" in text and "% in the rankings" in text:
        raise SystemExit("Misleading percentage rank-drop wording still present")

    path.write_text(text)


patch_dashboard_sp500_daily_change()
patch_saved_portfolio_logos()
patch_portfolio_alert_rank_wording()
print("Patched S&P 500 daily move, alerts logos, and rank-drop wording.")
