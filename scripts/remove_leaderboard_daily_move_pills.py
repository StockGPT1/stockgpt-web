from pathlib import Path


def remove_block(text: str, start_marker: str, end_marker: str, label: str) -> str:
    start = text.find(start_marker)
    if start == -1:
        return text
    end = text.find(end_marker, start)
    if end == -1:
        raise SystemExit(f"Could not find end marker for {label}")
    return text[:start] + text[end:]


def patch_dashboard() -> None:
    path = Path("app/page.tsx")
    text = path.read_text()

    text = text.replace("import { getOneDayMoveMap, getSP500Chart, getTopMovers } from \"@/lib/yahoo\";", "import { getSP500Chart, getTopMovers } from \"@/lib/yahoo\";")

    # Remove helper functions if no longer needed.
    text = remove_block(text, "function dailyMoveClassName", "function getFirstNameFromUserMetadata", "dashboard daily move helpers")

    text = text.replace('''  const dashboardTickerList = rankings
    .map((r) => r.ticker)
    .filter((t): t is string => !!t);

''', "")

    text = text.replace(
'''  const [sp500Data, topGainerMovers, topLoserMovers, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(topGainerTickerList, 8),
    getTopMovers(loserTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
  ]);
''',
'''  const [sp500Data, topGainerMovers, topLoserMovers, snapshotMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(topGainerTickerList, 8),
    getTopMovers(loserTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
  ]);
''')

    text = text.replace(
'''                              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                <p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">
                                  {stock.company ?? "—"}
                                </p>
                                <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} className="h-4 min-w-[38px] px-1 text-[7.5px]" />
                              </div>''',
'''                              <p className="mt-0.5 truncate text-[9px] font-semibold text-[#072116]/45">
                                {stock.company ?? "—"}
                              </p>''')

    text = text.replace(
'''                            <div className="flex min-w-0 items-center gap-2 px-2 font-semibold tracking-[-0.01em]">
                              <span className="min-w-0 truncate">{stock.company ?? "—"}</span>
                              <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} />
                            </div>''',
'''                            <div className="min-w-0 truncate px-2 font-semibold tracking-[-0.01em]">
                              {stock.company ?? "—"}
                            </div>''')

    if "DailyMovePill" in text or "dailyMoveMap" in text or "getOneDayMoveMap" in text:
        raise SystemExit("Dashboard still contains daily move pill remnants")

    path.write_text(text)


def patch_rankings() -> None:
    path = Path("app/rankings/page.tsx")
    text = path.read_text()

    text = text.replace("import { getOneDayMoveMap, getStockChart, getLatestPriceFromChart } from \"@/lib/yahoo\";", "import { getStockChart, getLatestPriceFromChart } from \"@/lib/yahoo\";")

    text = remove_block(text, "function dailyMoveClassName", "function matchesMoveFilter", "rankings daily move helpers")

    text = text.replace('''
  const dailyMoveMap = await getOneDayMoveMap(
    allRankings.map((stock) => stock.ticker).filter((ticker): ticker is string => !!ticker),
  );
''', "")

    text = text.replace(
'''                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <p className="min-w-0 truncate text-[11px] font-semibold leading-[1.05] text-[#072116]/55">
                            {stock.company ?? "—"}
                          </p>
                          <DailyMovePill changePct={dailyMoveMap.get(ticker)?.changePct} className="h-5 min-w-[42px] px-1.5 text-[8px]" />
                        </div>''',
'''                        <p className="mt-0.5 truncate text-[11px] font-semibold leading-[1.05] text-[#072116]/55">
                          {stock.company ?? "—"}
                        </p>''')

    text = text.replace(
'''                      <div
                        className="flex min-w-0 items-center gap-2 px-4 py-2.5 font-semibold"
                        style={{ color: "#072116" }}
                      >
                        <span className="min-w-0 truncate">{stock.company ?? "—"}</span>
                        <DailyMovePill changePct={dailyMoveMap.get(ticker)?.changePct} />
                      </div>''',
'''                      <div
                        className="truncate px-4 py-2.5 font-semibold"
                        style={{ color: "#072116" }}
                      >
                        {stock.company ?? "—"}
                      </div>''')

    if "DailyMovePill" in text or "dailyMoveMap" in text or "getOneDayMoveMap" in text:
        raise SystemExit("Rankings still contains daily move pill remnants")

    path.write_text(text)


patch_dashboard()
patch_rankings()
print("Removed daily percent movement pills from dashboard and rankings leaderboards.")
