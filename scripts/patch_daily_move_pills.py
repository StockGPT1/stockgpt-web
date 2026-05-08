from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Could not find block: {label}")
    return text.replace(old, new, 1)


def patch_dashboard() -> None:
    path = Path("app/page.tsx")
    text = path.read_text()

    text = text.replace(
        'import { getSP500Chart, getTopMovers } from "@/lib/yahoo";',
        'import { getOneDayMoveMap, getSP500Chart, getTopMovers } from "@/lib/yahoo";',
    )

    helper = '''
function dailyMoveClassName(changePct: number | null | undefined) {
  if (!Number.isFinite(changePct)) {
    return "border-[#072116]/8 bg-transparent text-[#072116]/35";
  }

  if (Number(changePct) >= 0) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  return "border-red-500/25 bg-red-500/10 text-red-700";
}

function DailyMovePill({
  changePct,
  className = "h-5 min-w-[42px] px-1 text-[8px]",
}: {
  changePct: number | null | undefined;
  className?: string;
}) {
  const valid = Number.isFinite(changePct);
  const value = valid ? Number(changePct) : null;

  return (
    <span
      title="1D price move"
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full border font-black tabular-nums",
        className,
        dailyMoveClassName(value),
      ].join(" ")}
    >
      {value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}
'''
    if "function DailyMovePill" not in text:
        text = replace_once(text, "\nfunction getFirstNameFromUserMetadata", helper + "\nfunction getFirstNameFromUserMetadata", "dashboard helper insertion")

    text = replace_once(
        text,
        '''  const moverTickerList = Array.from(
    new Set(
      ((moverUniverseData ?? []) as Array<{ ticker: string | null }>)
        .map((r) => r.ticker)
        .filter((t): t is string => !!t),
    ),
  );

  const [sp500Data, movers, snapshotMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(moverTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
  ]);
''',
        '''  const moverTickerList = Array.from(
    new Set(
      ((moverUniverseData ?? []) as Array<{ ticker: string | null }>)
        .map((r) => r.ticker)
        .filter((t): t is string => !!t),
    ),
  );
  const dashboardTickerList = rankings
    .map((r) => r.ticker)
    .filter((t): t is string => !!t);

  const [sp500Data, movers, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(moverTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
  ]);
''',
        "dashboard Promise.all",
    )

    text = replace_once(
        text,
        '''                              <p className="truncate text-[9px] font-semibold text-[#072116]/45">
                                {stock.company ?? "—"}
                              </p>''',
        '''                              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                <p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">
                                  {stock.company ?? "—"}
                                </p>
                                <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} className="h-4 min-w-[38px] px-1 text-[7.5px]" />
                              </div>''',
        "dashboard mobile company pill",
    )

    text = replace_once(
        text,
        '''                            <div className="min-w-0 truncate px-2 font-semibold tracking-[-0.01em]">
                              {stock.company ?? "—"}
                            </div>''',
        '''                            <div className="flex min-w-0 items-center gap-2 px-2 font-semibold tracking-[-0.01em]">
                              <span className="min-w-0 truncate">{stock.company ?? "—"}</span>
                              <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} />
                            </div>''',
        "dashboard desktop company pill",
    )

    path.write_text(text)


def patch_rankings() -> None:
    path = Path("app/rankings/page.tsx")
    text = path.read_text()

    text = text.replace(
        'import { getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";',
        'import { getOneDayMoveMap, getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";',
    )

    helper = '''
function dailyMoveClassName(changePct: number | null | undefined) {
  if (!Number.isFinite(changePct)) {
    return "border-[#072116]/8 bg-transparent text-[#072116]/35";
  }

  if (Number(changePct) >= 0) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  return "border-red-500/25 bg-red-500/10 text-red-700";
}

function DailyMovePill({
  changePct,
  className = "h-6 min-w-[46px] px-2 text-[10px]",
}: {
  changePct: number | null | undefined;
  className?: string;
}) {
  const valid = Number.isFinite(changePct);
  const value = valid ? Number(changePct) : null;

  return (
    <span
      title="1D price move"
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full border font-black tabular-nums",
        className,
        dailyMoveClassName(value),
      ].join(" ")}
    >
      {value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}
'''
    if "function DailyMovePill" not in text:
        text = replace_once(text, "\nfunction matchesMoveFilter", helper + "\nfunction matchesMoveFilter", "rankings helper insertion")

    text = replace_once(
        text,
        '''  const allRankings = await Promise.all(
    rawRankings.map((stock) => attachLivePriceIfMissing(stock)),
  );

  const sectors = Array.from(''',
        '''  const allRankings = await Promise.all(
    rawRankings.map((stock) => attachLivePriceIfMissing(stock)),
  );
  const dailyMoveMap = await getOneDayMoveMap(
    allRankings.map((stock) => stock.ticker).filter((ticker): ticker is string => !!ticker),
  );

  const sectors = Array.from(''',
        "rankings daily move map",
    )

    text = text.replace(
        '  const gridCols =\n    "grid-cols-[58px_76px_108px_minmax(0,1fr)_150px_100px_108px]";',
        '  const gridCols =\n    "grid-cols-[58px_76px_108px_minmax(0,1fr)_minmax(170px,220px)_92px_96px]";',
    )

    text = replace_once(
        text,
        '''                        <p className="mt-0.5 truncate text-[11px] font-semibold leading-[1.05] text-[#072116]/55">
                          {stock.company ?? "—"}
                        </p>''',
        '''                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <p className="min-w-0 truncate text-[11px] font-semibold leading-[1.05] text-[#072116]/55">
                            {stock.company ?? "—"}
                          </p>
                          <DailyMovePill changePct={dailyMoveMap.get(ticker)?.changePct} className="h-5 min-w-[42px] px-1.5 text-[8px]" />
                        </div>''',
        "rankings mobile company pill",
    )

    text = replace_once(
        text,
        '''                      <div
                        className="truncate px-4 py-2.5 font-semibold"
                        style={{ color: "#072116" }}
                      >
                        {stock.company ?? "—"}
                      </div>''',
        '''                      <div
                        className="flex min-w-0 items-center gap-2 px-4 py-2.5 font-semibold"
                        style={{ color: "#072116" }}
                      >
                        <span className="min-w-0 truncate">{stock.company ?? "—"}</span>
                        <DailyMovePill changePct={dailyMoveMap.get(ticker)?.changePct} />
                      </div>''',
        "rankings desktop company pill",
    )

    text = replace_once(
        text,
        '''                      <div className="px-4 py-2.5">
                        <span
                          className="inline-flex max-w-full truncate rounded-full border border-[#072116]/10 px-2 py-0.5 text-[10px] font-bold"
                          style={{ color: "rgba(7,33,22,0.6)" }}
                        >
                          {stock.sector ?? "—"}
                        </span>
                      </div>''',
        '''                      <div className="min-w-0 px-4 py-2.5">
                        <span
                          title={stock.sector ?? "—"}
                          className="inline-flex max-w-full rounded-full border border-[#072116]/10 px-2 py-0.5 text-[10px] font-bold leading-tight"
                          style={{ color: "rgba(7,33,22,0.6)" }}
                        >
                          <span className="min-w-0 truncate">{stock.sector ?? "—"}</span>
                        </span>
                      </div>''',
        "rankings sector clipping fix",
    )

    path.write_text(text)


patch_dashboard()
patch_rankings()
print("Patched daily 1D price-move pills and rankings sector clipping.")
