import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
  moveClassName,
} from "@/lib/rank-history";

type Ranking = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

type RankingsSearchParams = {
  q?: string;
  sector?: string;
  move?: string;
};

const MIN_DISPLAY_SCORE = 100;

function normalizeDisplayScore(value: Ranking["score"]) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  return Math.round(Math.max(n, MIN_DISPLAY_SCORE));
}

function hasValidPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"]) {
  const score = normalizeDisplayScore(value);
  return score == null ? "—" : score.toLocaleString();
}

async function attachLivePriceIfMissing(stock: Ranking): Promise<Ranking> {
  if (hasValidPrice(stock.price)) {
    return stock;
  }

  if (!stock.ticker) {
    return stock;
  }

  const chartData = await getStockChart(stock.ticker, [
    "1D",
    "5D",
    "1M",
    "6M",
    "1Y",
  ]);

  const livePrice = getLatestPriceFromChart(chartData);

  if (!livePrice || !Number.isFinite(livePrice) || livePrice <= 0) {
    return stock;
  }

  return {
    ...stock,
    price: livePrice,
  };
}

function matchesMoveFilter(
  stock: Ranking,
  moveFilter: string,
  snapshotMap: Map<string, number>,
) {
  if (!moveFilter || moveFilter === "all") return true;

  const ticker = stock.ticker ?? "";
  const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));

  return move.tone === moveFilter;
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams?: Promise<RankingsSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};

  const q = (params.q ?? "").trim().toLowerCase();
  const sectorFilter = params.sector ?? "all";
  const moveFilter = params.move ?? "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasSubscription = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    hasSubscription = profile?.subscription_status === "basic";
  }

  const rankingsLocked = !hasSubscription;

  const [{ data: rankingsData }, snapshotMap] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price")
      .order("rank", { ascending: true })
      .limit(hasSubscription ? 500 : 10),
    getRankSnapshotMapAround24hAgo(supabase),
  ]);

  const rawRankings = (rankingsData ?? []) as Ranking[];

  const allRankings = await Promise.all(
    rawRankings.map((stock) => attachLivePriceIfMissing(stock)),
  );

  const sectors = Array.from(
    new Set(
      allRankings
        .map((stock) => stock.sector)
        .filter((sector): sector is string => Boolean(sector)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const rankings = allRankings.filter((stock) => {
    const searchable = `${stock.ticker ?? ""} ${stock.company ?? ""}`.toLowerCase();
    const matchesSearch = !q || searchable.includes(q);
    const matchesSector =
      sectorFilter === "all" || stock.sector === sectorFilter;
    const matchesMove = matchesMoveFilter(stock, moveFilter, snapshotMap);

    return matchesSearch && matchesSector && matchesMove;
  });

  const gridCols =
    "grid-cols-[58px_76px_108px_minmax(0,1fr)_150px_100px_108px]";

  return (
    <AppShell activePath="/rankings">
      <main className="flex min-h-full flex-col gap-3 overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] font-black tracking-[-0.03em] text-[#faf6f0] sm:text-[28px]">
              Stock Rankings
            </h1>

            <p className="mt-0.5 text-[12px] font-medium text-[#faf6f0]/50 sm:text-[13px]">
              {hasSubscription
                ? `${rankings.length} stocks shown · ${allRankings.length} available`
                : "Rankings locked — subscribe for full access"}
            </p>
          </div>

          {rankingsLocked && (
            <Link
              href="/pricing"
              style={{ backgroundColor: "#ddb159", color: "#072116" }}
              className="w-fit rounded-full px-4 py-2 text-[12px] font-black transition hover:opacity-90"
            >
              Unlock full rankings
            </Link>
          )}
        </div>

        <form className="grid shrink-0 grid-cols-1 gap-2 rounded-2xl border border-[#ddb159]/18 bg-[#04180f] p-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_140px_auto]">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Filter by ticker or company..."
            className="h-10 min-w-0 rounded-xl border border-[#ddb159]/18 bg-[#072116] px-3 text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/60"
          />

          <select
            name="sector"
            defaultValue={sectorFilter}
            className="h-10 min-w-0 rounded-xl border border-[#ddb159]/18 bg-[#072116] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/60"
          >
            <option value="all">All sectors</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          <select
            name="move"
            defaultValue={moveFilter}
            className="h-10 min-w-0 rounded-xl border border-[#ddb159]/18 bg-[#072116] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/60"
          >
            <option value="all">All moves</option>
            <option value="up">Moved up</option>
            <option value="down">Moved down</option>
            <option value="flat">No change</option>
            <option value="none">No 24h snapshot</option>
          </select>

          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:flex">
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#ddb159] px-4 text-[12px] font-black text-[#072116] transition hover:brightness-105"
            >
              Filter
            </button>

            <Link
              href="/rankings"
              className="grid h-10 place-items-center rounded-xl border border-[#ddb159]/20 px-4 text-[12px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/10"
            >
              Clear
            </Link>
          </div>
        </form>

        <RankingsLock isLocked={rankingsLocked} className="lg:hidden">
          <div className="grid gap-2">
            {rankings.length > 0 ? (
              rankings.map((stock) => {
                const ticker = stock.ticker ?? "";
                const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));
                const priceText = formatPrice(stock.price);

                return (
                  <Link
                    key={stock.id}
                    href={`/stock/${stock.ticker}`}
                    className="rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_24px_rgba(0,0,0,0.16)] ring-1 ring-white/20 transition hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#072116] text-[12px] font-black text-[#ddb159]">
                          {stock.rank ?? "—"}
                        </div>

                        <StockLogo
                          ticker={stock.ticker}
                          company={stock.company}
                          size={28}
                        />

                        <div className="flex min-h-[36px] min-w-0 flex-col justify-center">
                          <p className="truncate text-[15px] font-black leading-[1.05]">
                            {stock.ticker ?? "—"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold leading-[1.05] text-[#072116]/55">
                            {stock.company ?? "—"}
                          </p>
                        </div>
                      </div>

                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{
                          backgroundColor: "#ddb159",
                          color: "#072116",
                        }}
                      >
                        {formatScore(stock.score)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-[#072116]/10 px-2 py-2">
                        <p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">
                          Move
                        </p>
                        <span
                          title={move.title}
                          className={[
                            "mt-1 inline-flex h-6 min-w-[44px] items-center justify-center rounded-full border px-2 text-[10px] font-black tabular-nums",
                            moveClassName(move.tone),
                          ].join(" ")}
                        >
                          {move.label}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#072116]/10 px-2 py-2">
                        <p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">
                          Price
                        </p>
                        <p className="mt-1 min-h-[16px] truncate text-[11px] font-black leading-none tabular-nums text-[#072116]">
                          {priceText}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#072116]/10 px-2 py-2">
                        <p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">
                          Sector
                        </p>
                        <p className="mt-1 min-h-[16px] truncate text-[10px] font-bold leading-none text-[#072116]/60">
                          {stock.sector ?? "—"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl bg-[#faf6f0] px-4 py-10 text-center text-[13px] font-bold text-[#072116]/55">
                No stocks match those filters.
              </div>
            )}
          </div>
        </RankingsLock>

        <RankingsLock
          isLocked={rankingsLocked}
          className="relative hidden min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)] lg:block"
        >
          <div className="h-full">
            <div
              className={`grid ${gridCols} sticky top-0 z-10 bg-[#072116] text-[#faf6f0]`}
            >
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                Rank
              </div>
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                Move
              </div>
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                Ticker
              </div>
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                Company
              </div>
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                Sector
              </div>
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                Price
              </div>
              <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                AI Score
              </div>
            </div>

            <div className="overflow-y-auto" style={{ height: "calc(100% - 38px)" }}>
              {rankings.length > 0 ? (
                rankings.map((stock) => {
                  const ticker = stock.ticker ?? "";
                  const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));

                  return (
                    <Link
                      key={stock.id}
                      href={`/stock/${stock.ticker}`}
                      style={{ color: "#072116" }}
                      className={`grid ${gridCols} items-center border-b border-[#072116]/8 text-[12px] transition hover:bg-[#ddb159]/8`}
                    >
                      <div
                        className="px-4 py-2.5 font-bold"
                        style={{ color: "rgba(7,33,22,0.7)" }}
                      >
                        {stock.rank ?? "—"}
                      </div>

                      <div className="px-4 py-2.5">
                        <span
                          title={move.title}
                          className={[
                            "inline-flex h-6 min-w-[46px] items-center justify-center rounded-full border px-2 text-[10px] font-black tabular-nums",
                            moveClassName(move.tone),
                          ].join(" ")}
                        >
                          {move.label}
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2 px-4 py-2.5 font-black"
                        style={{ color: "#072116" }}
                      >
                        <StockLogo
                          ticker={stock.ticker}
                          company={stock.company}
                          size={22}
                        />
                        <span>{stock.ticker ?? "—"}</span>
                      </div>

                      <div
                        className="truncate px-4 py-2.5 font-semibold"
                        style={{ color: "#072116" }}
                      >
                        {stock.company ?? "—"}
                      </div>

                      <div className="px-4 py-2.5">
                        <span
                          className="inline-flex max-w-full truncate rounded-full border border-[#072116]/10 px-2 py-0.5 text-[10px] font-bold"
                          style={{ color: "rgba(7,33,22,0.6)" }}
                        >
                          {stock.sector ?? "—"}
                        </span>
                      </div>

                      <div
                        className="px-4 py-2.5 font-semibold tabular-nums"
                        style={{ color: "#072116" }}
                      >
                        {formatPrice(stock.price)}
                      </div>

                      <div className="px-4 py-2.5">
                        <span
                          className="inline-flex min-w-[68px] justify-center rounded-full px-2.5 py-0.5 text-[10px] font-black"
                          style={{ backgroundColor: "#ddb159", color: "#072116" }}
                        >
                          {formatScore(stock.score)}
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div
                  className="px-4 py-10 text-center text-[13px] font-bold"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  No stocks match those filters.
                </div>
              )}
            </div>
          </div>
        </RankingsLock>
      </main>
    </AppShell>
  );
}
