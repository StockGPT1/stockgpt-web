import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { getStockChart } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
  moveClassName,
} from "@/lib/rank-history";

export const metadata: Metadata = {
  title: "Top Movers | StockGPT",
  description:
    "Track the best and worst performing S&P 500 stocks across selected periods with AI rank and score context.",
  robots: { index: false, follow: false },
};

type TopMoversSearchParams = {
  period?: string;
  side?: string;
  sector?: string;
};

type Ranking = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

type Profile = {
  subscription_status: string | null;
};

type MoverPeriod = "1D" | "1W" | "1M";

type Mover = {
  ticker: string;
  currentPrice: number;
  changePct: number;
};

type MoverRow = Ranking & {
  ticker: string;
  currentPrice: number;
  changePct: number;
};

const PERIOD_OPTIONS: Array<{ value: MoverPeriod; label: string }> = [
  { value: "1D", label: "1 day" },
  { value: "1W", label: "1 week" },
  { value: "1M", label: "1 month" },
];

const SIDE_OPTIONS = [
  { value: "gainers", label: "Top gainers" },
  { value: "losers", label: "Top losers" },
];

function normalizePeriod(value: string | undefined): MoverPeriod {
  if (value === "1W" || value === "1M") return value;
  return "1D";
}

function normalizeSide(value: string | undefined) {
  return value === "losers" ? "losers" : "gainers";
}

function periodToRange(period: MoverPeriod) {
  if (period === "1W") return "5D" as const;
  if (period === "1M") return "1M" as const;
  return "1D" as const;
}

function fallbackRange(period: MoverPeriod) {
  return period === "1D" ? ("5D" as const) : null;
}

function firstValidClose(points: Array<{ close: number }>) {
  for (const point of points) {
    if (Number.isFinite(point.close) && point.close > 0) return point.close;
  }

  return null;
}

function lastValidClose(points: Array<{ close: number }>) {
  for (let i = points.length - 1; i >= 0; i--) {
    const close = points[i]?.close;
    if (Number.isFinite(close) && close > 0) return close;
  }

  return null;
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
) {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

async function getMover(ticker: string, period: MoverPeriod): Promise<Mover | null> {
  const range = periodToRange(period);
  const fallback = fallbackRange(period);
  const ranges = fallback ? [range, fallback] : [range];
  const data = await getStockChart(ticker, ranges);
  const primaryPoints = data[range] ?? [];
  const fallbackPoints = fallback ? data[fallback] ?? [] : [];
  const points = primaryPoints.length >= 2 ? primaryPoints : fallbackPoints;

  if (points.length < 2) return null;

  const first = firstValidClose(points);
  const last = lastValidClose(points);

  if (first == null || last == null || first <= 0) return null;

  return {
    ticker,
    currentPrice: last,
    changePct: ((last - first) / first) * 100,
  };
}

async function getMoveMap(tickers: string[], period: MoverPeriod) {
  const cleanedTickers = Array.from(
    new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 500);
  const results = await runInBatches(cleanedTickers, 35, (ticker) => getMover(ticker, period));
  const valid = results.filter((item): item is Mover => item !== null);

  return new Map(valid.map((item) => [item.ticker, item]));
}

function formatPrice(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatPct(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(2)}%`;
}

function moveClass(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-[#faf6f0]/50";
}

function chipClass(active: boolean) {
  return [
    "inline-flex h-10 items-center justify-center rounded-full px-4 text-[12px] font-black transition",
    active
      ? "bg-[#ddb159] text-[#072116]"
      : "border border-[#faf6f0]/10 bg-[#faf6f0]/5 text-[#faf6f0]/62 hover:border-[#ddb159]/40 hover:bg-[#ddb159]/10 hover:text-[#faf6f0]",
  ].join(" ");
}

function buildHref({
  period,
  side,
  sector,
}: {
  period: MoverPeriod;
  side: string;
  sector: string;
}) {
  const params = new URLSearchParams();

  params.set("period", period);
  params.set("side", side);

  if (sector && sector !== "all") {
    params.set("sector", sector);
  }

  return `/top-movers?${params.toString()}`;
}

export default async function TopMoversPage({
  searchParams,
}: {
  searchParams?: Promise<TopMoversSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const period = normalizePeriod(params.period);
  const side = normalizeSide(params.side);
  const sectorFilter = params.sector ?? "all";

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

  const [{ data: rankingsData }, snapshotMap] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price")
      .order("rank", { ascending: true })
      .limit(hasSubscription ? 500 : 40),
    getRankSnapshotMapAround24hAgo(supabase),
  ]);

  const rankings = (rankingsData ?? []) as Ranking[];
  const tickerList = rankings
    .map((stock) => stock.ticker)
    .filter((ticker): ticker is string => Boolean(ticker));

  const moveMap = await getMoveMap(tickerList, period);

  const sectors = Array.from(
    new Set(rankings.map((stock) => stock.sector).filter((sector): sector is string => Boolean(sector))),
  ).sort((a, b) => a.localeCompare(b));

  const movers: MoverRow[] = rankings
    .map((stock) => {
      const ticker = stock.ticker?.toUpperCase();
      if (!ticker) return null;

      const move = moveMap.get(ticker);
      if (!move) return null;

      return {
        ...stock,
        ticker,
        currentPrice: move.currentPrice,
        changePct: move.changePct,
      };
    })
    .filter((stock): stock is MoverRow => stock !== null)
    .filter((stock) => sectorFilter === "all" || stock.sector === sectorFilter)
    .sort((a, b) =>
      side === "gainers" ? b.changePct - a.changePct : a.changePct - b.changePct,
    );

  const visibleMovers = movers.slice(0, 80);
  const strongestMove = visibleMovers[0];

  return (
    <AppShell activePath="/dashboard">
      <main className="flex min-h-full flex-col gap-4 overflow-y-auto overflow-x-hidden pb-8 pr-1 text-[#faf6f0]">
        <section className="relative overflow-hidden rounded-[28px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,0.07),rgba(250,246,240,0.025)_48%,rgba(221,177,89,0.06))] p-4 sm:p-5">
          <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 size-52 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="mb-4 grid size-11 place-items-center rounded-full border border-[#faf6f0]/10 bg-[#faf6f0]/6 text-[24px] font-black text-[#faf6f0]/75 transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10"
                aria-label="Back to dashboard"
              >
                ←
              </Link>

              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                Market movement
              </p>
              <h1 className="mt-2 text-[38px] font-black leading-none tracking-[-0.06em] sm:text-[52px]">
                Top Movers
              </h1>
              <p className="mt-3 max-w-3xl text-[13px] font-semibold leading-6 text-[#faf6f0]/58 sm:text-[15px]">
                Discover the best and worst performing ranked stocks over the selected period. Price movement is shown alongside AI rank and score context.
              </p>
            </div>

            <div className="grid gap-2 rounded-3xl border border-[#ddb159]/16 bg-[#020806]/35 p-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/45">
                Current leader
              </p>
              <p className="text-[24px] font-black leading-none tracking-[-0.04em] text-[#ddb159]">
                {strongestMove?.ticker ?? "—"}
              </p>
              <p className={`text-[13px] font-black ${moveClass(strongestMove?.changePct ?? 0)}`}>
                {strongestMove ? formatPct(strongestMove.changePct) : "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#ddb159]/18 bg-[#04180f]/72 p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={buildHref({ period: option.value, side, sector: sectorFilter })}
                  className={chipClass(period === option.value)}
                >
                  {option.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {SIDE_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={buildHref({ period, side: option.value, sector: sectorFilter })}
                  className={chipClass(side === option.value)}
                >
                  {option.label}
                </Link>
              ))}
            </div>

            <form className="flex min-w-0 gap-2" action="/top-movers">
              <input type="hidden" name="period" value={period} />
              <input type="hidden" name="side" value={side} />
              <label className="relative flex h-10 min-w-[190px] flex-1 items-center rounded-full border border-[#faf6f0]/10 bg-[#faf6f0]/5 px-4">
                <span className="sr-only">Sector</span>
                <select
                  name="sector"
                  defaultValue={sectorFilter}
                  className="h-full w-full appearance-none bg-transparent text-[12px] font-black text-[#faf6f0] outline-none"
                >
                  <option className="text-black" value="all">
                    All sectors
                  </option>
                  {sectors.map((sector) => (
                    <option className="text-black" key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 text-[10px] text-[#ddb159]/70">▾</span>
              </label>
              <button className="rounded-full bg-[#ddb159] px-4 text-[12px] font-black text-[#072116]">
                Apply
              </button>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]">
              Price movers
            </span>
            <Link
              href="/rankings?move=up"
              className="rounded-full border border-[#faf6f0]/10 bg-[#faf6f0]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/55 transition hover:border-[#ddb159]/35 hover:text-[#faf6f0]"
            >
              AI rank movers
            </Link>
            <Link
              href="/watchlist"
              className="rounded-full border border-[#faf6f0]/10 bg-[#faf6f0]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/55 transition hover:border-[#ddb159]/35 hover:text-[#faf6f0]"
            >
              Watchlist movers
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-[#faf6f0]/8 bg-[#151516]">
          <div className="hidden grid-cols-[64px_minmax(0,1fr)_100px_110px_94px_92px] border-b border-[#faf6f0]/8 px-4 py-3 text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/42 lg:grid">
            <div>Logo</div>
            <div>Stock</div>
            <div className="text-right">Price</div>
            <div className="text-right">Move</div>
            <div className="text-right">AI rank</div>
            <div className="text-right">Score</div>
          </div>

          <div className="divide-y divide-[#faf6f0]/7">
            {visibleMovers.length > 0 ? (
              visibleMovers.map((stock) => {
                const rankMove = getRankMove24h(stock.rank, snapshotMap.get(stock.ticker));

                return (
                  <Link
                    key={stock.id}
                    href={`/stock/${stock.ticker}`}
                    className="grid gap-3 px-4 py-4 transition hover:bg-[#ddb159]/8 lg:grid-cols-[64px_minmax(0,1fr)_100px_110px_94px_92px] lg:items-center"
                  >
                    <div className="hidden lg:block">
                      <StockLogo ticker={stock.ticker} company={stock.company} size={42} />
                    </div>

                    <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 lg:block">
                      <div className="lg:hidden">
                        <StockLogo ticker={stock.ticker} company={stock.company} size={48} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-black leading-tight tracking-[-0.03em] text-[#faf6f0] lg:text-[18px]">
                          {stock.company ?? stock.ticker}
                        </p>
                        <p className="mt-1 truncate text-[12px] font-bold text-[#faf6f0]/42">
                          {stock.ticker} · {stock.sector ?? "Unknown sector"}
                        </p>
                      </div>

                      <div className="text-right lg:hidden">
                        <p className="text-[17px] font-bold tabular-nums">{formatPrice(stock.currentPrice)}</p>
                        <p className={`mt-1 text-[14px] font-black tabular-nums ${moveClass(stock.changePct)}`}>
                          {stock.changePct >= 0 ? "▲" : "▼"} {formatPct(stock.changePct)}
                        </p>
                      </div>
                    </div>

                    <div className="hidden text-right text-[17px] font-bold tabular-nums lg:block">
                      {formatPrice(stock.currentPrice)}
                    </div>

                    <div className={`hidden text-right text-[17px] font-black tabular-nums lg:block ${moveClass(stock.changePct)}`}>
                      {stock.changePct >= 0 ? "▲" : "▼"} {formatPct(stock.changePct)}
                    </div>

                    <div className="hidden justify-end lg:flex">
                      <span
                        title={rankMove.title}
                        className={[
                          "inline-flex h-8 min-w-[62px] items-center justify-center rounded-full border px-2 text-[11px] font-black",
                          moveClassName(rankMove.tone),
                        ].join(" ")}
                      >
                        {rankMove.label}
                      </span>
                    </div>

                    <div className="hidden justify-end lg:flex">
                      <span className="inline-flex h-8 min-w-[70px] items-center justify-center rounded-full bg-[#ddb159] px-3 text-[11px] font-black text-[#072116]">
                        {formatScore(stock.score)}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center text-[13px] font-bold text-[#faf6f0]/50">
                No movers available for this filter yet.
              </div>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
