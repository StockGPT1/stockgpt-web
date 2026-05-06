import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { createClient } from "@/utils/supabase/server";

type Ranking = {
  id: string | number;
  rank: number | null;
  previous_rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

type RankMove = {
  label: string;
  tone: "up" | "down" | "flat" | "none";
  title: string;
};

type RankingsSearchParams = {
  q?: string;
  sector?: string;
  move?: string;
};

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function getRankMove(
  currentRank: number | null,
  previousRank: number | null,
): RankMove {
  if (currentRank == null || previousRank == null) {
    return {
      label: "—",
      tone: "none",
      title: "Previous rank unavailable",
    };
  }

  const difference = previousRank - currentRank;

  if (difference > 0) {
    return {
      label: `↑ ${difference}`,
      tone: "up",
      title: `Moved up ${difference} place${difference === 1 ? "" : "s"} since the previous model run`,
    };
  }

  if (difference < 0) {
    const abs = Math.abs(difference);

    return {
      label: `↓ ${abs}`,
      tone: "down",
      title: `Moved down ${abs} place${abs === 1 ? "" : "s"} since the previous model run`,
    };
  }

  return {
    label: "—",
    tone: "flat",
    title: "Rank unchanged since the previous model run",
  };
}

function moveClassName(tone: RankMove["tone"]) {
  if (tone === "up") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  if (tone === "down") {
    return "border-red-500/25 bg-red-500/10 text-red-700";
  }

  if (tone === "flat") {
    return "border-[#072116]/10 bg-[#072116]/5 text-[#072116]/45";
  }

  return "border-[#072116]/8 bg-transparent text-[#072116]/35";
}

function matchesMoveFilter(stock: Ranking, moveFilter: string) {
  if (!moveFilter || moveFilter === "all") return true;

  const move = getRankMove(stock.rank, stock.previous_rank);

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

  const hasAccess = !!user;

  const { data: rankingsData } = await supabase
    .from("stock_rankings")
    .select("id,rank,previous_rank,ticker,company,sector,score,price")
    .order("rank", { ascending: true })
    .limit(hasAccess ? 500 : 10);

  const allRankings = (rankingsData ?? []) as Ranking[];

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
    const matchesMove = matchesMoveFilter(stock, moveFilter);

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
              {hasAccess
                ? `${rankings.length} stocks shown · ${allRankings.length} available`
                : "Top 10 preview — sign in for full access"}
            </p>
          </div>

          {!hasAccess && (
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
            <option value="none">No previous data</option>
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

        <div className="grid gap-2 lg:hidden">
          {rankings.length > 0 ? (
            rankings.map((stock) => {
              const move = getRankMove(stock.rank, stock.previous_rank);
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

        <div className="relative hidden min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)] lg:block">
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
                const move = getRankMove(stock.rank, stock.previous_rank);

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
      </main>
    </AppShell>
  );
}
