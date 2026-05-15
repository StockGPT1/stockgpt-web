from pathlib import Path

path = Path("app/page.tsx")
text = path.read_text()

old_query = '''  const [{ data: rankingsData }, { data: moverUniverseData }] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(10),
    supabase
      .from("stock_rankings")
      .select("ticker")
      .order("rank", { ascending: true })
      .limit(500),
  ]);
'''

new_query = '''  const [
    { data: rankingsData },
    { data: topGainerUniverseData },
    { data: loserUniverseData },
  ] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(10),
    supabase
      .from("stock_rankings")
      .select("ticker")
      .order("rank", { ascending: true })
      .limit(20),
    supabase
      .from("stock_rankings")
      .select("ticker,rank")
      .order("rank", { ascending: true })
      .gte("rank", 252)
      .limit(260),
  ]);
'''

if old_query not in text:
    raise SystemExit("Could not find dashboard rankings/mover query block")
text = text.replace(old_query, new_query, 1)

old_lists = '''  const moverTickerList = Array.from(
    new Set(
      ((moverUniverseData ?? []) as Array<{ ticker: string | null }>)
        .map((r) => r.ticker)
        .filter((t): t is string => !!t),
    ),
  );
  const dashboardTickerList = rankings
'''

new_lists = '''  const topGainerTickerList = Array.from(
    new Set(
      ((topGainerUniverseData ?? []) as Array<{ ticker: string | null }>)
        .map((r) => r.ticker)
        .filter((t): t is string => !!t),
    ),
  );
  const loserTickerList = Array.from(
    new Set(
      ((loserUniverseData ?? []) as Array<{ ticker: string | null; rank: number | null }>)
        .map((r) => r.ticker)
        .filter((t): t is string => !!t),
    ),
  );
  const dashboardTickerList = rankings
'''

if old_lists not in text:
    raise SystemExit("Could not find mover ticker list block")
text = text.replace(old_lists, new_lists, 1)

old_promise = '''  const [sp500Data, movers, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(moverTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
  ]);
'''

new_promise = '''  const [sp500Data, topGainerMovers, topLoserMovers, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(topGainerTickerList, 8),
    getTopMovers(loserTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
  ]);
'''

if old_promise not in text:
    raise SystemExit("Could not find dashboard movers Promise.all block")
text = text.replace(old_promise, new_promise, 1)

old_assignment = '''  const topGainers = movers.gainers.slice(0, 3);
  const topLosers = movers.losers.slice(0, 3);
'''

new_assignment = '''  const topGainers = topGainerMovers.gainers.slice(0, 3);
  const topLosers = topLoserMovers.losers.slice(0, 3);
'''

if old_assignment not in text:
    raise SystemExit("Could not find dashboard top movers assignment block")
text = text.replace(old_assignment, new_assignment, 1)

required = [
    "topGainerUniverseData",
    "loserUniverseData",
    "topGainerTickerList",
    "loserTickerList",
    "topGainerMovers.gainers",
    "topLoserMovers.losers",
    '.gte("rank", 252)',
    ".limit(20)",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected content after patch: {missing}")

path.write_text(text)
print("Dashboard movers now use top-20 gainers universe and bottom-half losers universe.")
