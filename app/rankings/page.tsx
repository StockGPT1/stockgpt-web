import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { getOneDayMoveMap, getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
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

type Profile = {
  subscription_status: string | null;
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

function hasActiveSubscription(status: string | null | undefined) {
  return status === "basic" || status === "core" || status === "premium";
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
    const { data: profileData } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    const profile = profileData as Profile | null;
    hasSubscription = hasActiveSubscription(profile?.subscription_status);
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
  const dailyMoveMap = await getOneDayMoveMap(
    allRankings.map((stock) => stock.ticker).filter((ticker): ticker is string => !!ticker),
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
    "grid-cols-[58px_76px_108px_minmax(0,1fr)_minmax(170px,220px)_92px_96px]";

  return (
    <AppShell activePath="/rankings">
      <main className="flex min-h-full flex-col gap-3 overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden">
        <section className="relative shrink-0 overflow-hidden rounded-[28px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,0.075),rgba(250,246,240,0.025)_46%,rgba(221,177,89,0.07))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.20)] backdrop-blur-xl sm:p-5">
          <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 size-44 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ddb159]/24 bg-[#072116]/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span className="size-1.5 rounded-full bg-[#ddb159] shadow-[0_0_12px_rgba(221,177,89,0.8)]" />
                AI Ranking Engine
              </div>

              <h1 className="text-[30px] font-black leading-none tracking-[-0.055em] text-[#faf6f0] sm:text-[38px]">
                Stock Rankings
              </h1>

              <p className="mt-2 max-w-[560px] text-[13px] font-medium leading-relaxed text-[#faf6f0]/58">
                {hasSubscription
                  ? `${rankings.length} stocks shown from ${allRankings.length} ranked names. Filter by ticker, sector, or 24-hour rank movement.`
                  : "Rankings are locked. Subscribe to Core to unlock the AI ranking table."}
              </p>
            </div>

            {rankingsLocked && (
              <Link
                href="/pricing"
                className="group relative w-fit overflow-hidden rounded-full bg-[#ddb159] px-5 py-3 text-[12px] font-black text-[#072116] shadow-[0_14px_30px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(221,177,89,0.32)]"
              >
                <span className="relative">Unlock full rankings →</span>
              </Link>
            )}
          </div>

          <form className="relative mt-4 grid grid-cols-1 gap-2 rounded-[22px] border border-[#ddb159]/16 bg-[#02150d]/62 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl md:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_190px_170px_auto]">
            <label className="group flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ddb159]/12 text-[13px] text-[#ddb159] transition group-focus-within:bg-[#ddb159] group-focus-within:text-[#072116]">
                ⌕
              </span>
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search ticker or company"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/34"
              />
            </label>

            <label className="relative flex h-12 min-w-0 items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-3 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
              <span className="pointer-events-none absolute left-4 top-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70">
                Sector
              </span>
              <select
                name="sector"
                defaultValue={sectorFilter}
                className="h-full w-full appearance-none bg-transparent pt-3 text-[13px] font-black text-[#faf6f0] outline-none"
              >
                <option value="all">All sectors</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 text-[10px] text-[#ddb159]/70">
                ▾
              </span>
            </label>

            <label className="relative flex h-12 min-w-0 items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-3 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
              <span className="pointer-events-none absolute left-4 top-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70">
                24h move
              </span>
              <select
                name="move"
                defaultValue={moveFilter}
                className="h-full w-full appearance-none bg-transparent pt-3 text-[13px] font-black text-[#faf6f0] outline-none"
              >
                <option value="all">All moves</option>
                <option value="up">Moved up</option>
                <option value="down">Moved down</option>
                <option value="flat">No change</option>
                <option value="none">No 24h snapshot</option>
              </select>
              <span className="pointer-events-none absolute right-4 text-[10px] text-[#ddb159]/70">
                ▾
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2 md:col-span-2 lg:col-span-1 lg:flex">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-[#ddb159] px-5 text-[13px] font-black text-[#072116] shadow-[0_10px_22px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(221,177,89,0.30)] hover:brightness-105"
              >
                Apply
              </button>

              <Link
                href="/rankings"
                className="grid h-12 place-items-center rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.035] px-5 text-[13px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/40 hover:bg-[#ddb159]/10 hover:text-[#ddb159]"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <RankingsLock isLocked={rankingsLocked} className="grid gap-2 lg:hidden">
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
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <p className="min-w-0 truncate text-[11px] font-semibold leading-[1.05] text-[#072116]/55">
                            {stock.company ?? "—"}
                          </p>
                          <DailyMovePill changePct={dailyMoveMap.get(ticker)?.changePct} className="h-5 min-w-[42px] px-1.5 text-[8px]" />
                        </div>
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
                        className="flex min-w-0 items-center gap-2 px-4 py-2.5 font-semibold"
                        style={{ color: "#072116" }}
                      >
                        <span className="min-w-0 truncate">{stock.company ?? "—"}</span>
                        <DailyMovePill changePct={dailyMoveMap.get(ticker)?.changePct} />
                      </div>

                      <div className="min-w-0 px-4 py-2.5">
                        <span
                          title={stock.sector ?? "—"}
                          className="inline-flex max-w-full rounded-full border border-[#072116]/10 px-2 py-0.5 text-[10px] font-bold leading-tight"
                          style={{ color: "rgba(7,33,22,0.6)" }}
                        >
                          <span className="min-w-0 truncate">{stock.sector ?? "—"}</span>
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
