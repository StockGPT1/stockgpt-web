import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WatchlistRemoveButton } from "@/components/WatchlistRemoveButton";
import { StockLogo } from "@/components/StockLogo";
import { createClient } from "@/utils/supabase/server";
import { calculateTradeLevels, type TradeLevels } from "@/lib/trading-levels";


export const metadata: Metadata = {
  title: "Watchlist | StockGPT Stock Monitoring",
  description:
    "Monitor stocks on your StockGPT watchlist with AI rankings, score changes and market intelligence.",
};

type WatchlistStock = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | string | null;
  price: number | string | null;
};

function formatPrice(value: WatchlistStock["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: WatchlistStock["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

export default async function WatchlistPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: watchlistData } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const tickers = (watchlistData ?? []).map((w) => w.ticker as string);

  let stocks: WatchlistStock[] = [];
  if (tickers.length > 0) {
    const { data: stocksData } = await supabase
      .from("stock_rankings")
      .select("ticker,company,sector,rank,score,price")
      .in("ticker", tickers);

    const stockMap = new Map(
      (stocksData ?? []).map((s) => [s.ticker, s as WatchlistStock])
    );
    stocks = tickers
      .map((t) => stockMap.get(t))
      .filter((s): s is WatchlistStock => !!s);
  }

  // Compute trade levels for each watchlist stock in parallel
  const levelsByTicker: Record<string, TradeLevels | null> = {};
  await Promise.all(
    stocks.map(async (stock) => {
      const numPrice = Number(stock.price);
      const numScore = Number(stock.score);
      if (!Number.isFinite(numPrice) || !Number.isFinite(numScore)) {
        levelsByTicker[stock.ticker] = null;
        return;
      }
      levelsByTicker[stock.ticker] = await calculateTradeLevels({
        ticker: stock.ticker,
        price: numPrice,
        score: numScore,
        rank: stock.rank,
        sector: stock.sector,
      });
    })
  );

  // Watchlist summary stats
  const avgScore =
    stocks.length > 0
      ? Math.round(
          stocks.reduce((sum, s) => sum + (Number(s.score) || 0), 0) /
            stocks.length
        )
      : 0;
  const bestRank = stocks.reduce<number | null>(
    (best, s) =>
      s.rank != null && (best === null || s.rank < best) ? s.rank : best,
    null
  );

  return (
    <AppShell activePath="/watchlist">
      <main className="grid min-h-full gap-3 pb-5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
        <section className="sg-watchlist-hero rounded-[22px] border border-white/[0.055] bg-[radial-gradient(circle_at_88%_0%,rgba(242,195,95,0.10),transparent_34%),linear-gradient(145deg,#0a281c,#071d15_60%,#061711)] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.18)] lg:flex lg:shrink-0 lg:items-end lg:justify-between lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159] lg:hidden">
              Watchlist intelligence
            </p>
            <h1 className="hidden text-[28px] font-black tracking-[-0.03em] text-[#faf6f0] lg:block">
              Watchlist
            </h1>
            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#faf6f0]/50 lg:mt-0.5 lg:text-[13px] lg:font-medium">
              {stocks.length > 0
                ? `${stocks.length} stock${stocks.length !== 1 ? "s" : ""} you're tracking · AI trade levels ready`
                : "Stocks you want to keep an eye on"}
            </p>
          </div>

          {stocks.length > 0 && (
            <div className="mt-3 flex items-center gap-2 lg:mt-0 lg:gap-4">
              <div className="rounded-full border border-[#ddb159]/14 bg-black/10 px-3 py-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-right">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]/70 lg:text-[9px] lg:text-[#ddb159]">
                  Avg score
                </p>
                <p className="mt-0.5 text-[16px] font-black leading-none text-[#faf6f0] lg:text-[18px]">
                  {avgScore.toLocaleString()}
                </p>
              </div>
              {bestRank != null && (
                <div className="rounded-full border border-[#ddb159]/14 bg-black/10 px-3 py-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-right">
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]/70 lg:text-[9px] lg:text-[#ddb159]">
                    Best rank
                  </p>
                  <p className="mt-0.5 text-[16px] font-black leading-none text-[#faf6f0] lg:text-[18px]">
                    #{bestRank}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {stocks.length > 0 ? (
          <>
            <section className="grid gap-2.5 lg:hidden">
              {stocks.map((stock) => {
                const levels = levelsByTicker[stock.ticker];
                return (
                  <article
                    key={stock.ticker}
                    className="relative overflow-hidden rounded-[22px] border border-white/[0.055] bg-[#071d15]/76 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
                  >
                    <Link
                      href={`/stock/${stock.ticker}`}
                      prefetch={false}
                      className="block p-4 pr-13"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StockLogo ticker={stock.ticker} company={stock.company} size={42} />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-[16px] font-black tracking-[-0.02em] text-[#faf6f0]">
                              {stock.ticker}
                            </p>
                            {stock.rank != null && (
                              <span className="shrink-0 rounded-full border border-[#ddb159]/18 bg-[#ddb159]/9 px-2 py-0.5 text-[9px] font-black text-[#ddb159]">
                                #{stock.rank}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#faf6f0]/42">
                            {stock.company ?? stock.sector ?? "Watchlist stock"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-black tabular-nums text-[#faf6f0]">
                            {formatPrice(stock.price)}
                          </p>
                          <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#ddb159]/60">
                            Score {formatScore(stock.score)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-3">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/30">Entry</p>
                          <p className="mt-1 text-[12px] font-black tabular-nums text-[#faf6f0]/78">
                            {levels ? `${levels.entry.toFixed(2)}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-red-200/45">Stop</p>
                          <p className="mt-1 text-[12px] font-black tabular-nums text-red-300">
                            {levels ? `${levels.stopLoss.toFixed(2)}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-200/45">Target</p>
                          <p className="mt-1 text-[12px] font-black tabular-nums text-emerald-300">
                            {levels ? `${levels.takeProfit.toFixed(2)}` : "—"}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <div className="absolute right-3 top-3">
                      <WatchlistRemoveButton ticker={stock.ticker} variant="dark" />
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="hidden min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)] lg:block">
            <div className="h-full overflow-y-auto">
              <table className="w-full text-left text-[12px] text-[#072116]">
                <thead className="sticky top-0 z-10 bg-[#072116] text-[#faf6f0]">
                  <tr>
                    <th className="w-[80px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Ticker
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Company
                    </th>
                    <th className="w-[70px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="w-[80px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Price
                    </th>
                    <th className="w-[80px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Entry
                    </th>
                    <th className="w-[80px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Stop
                    </th>
                    <th className="w-[80px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Target
                    </th>
                    <th className="w-[88px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      AI Score
                    </th>
                    <th className="w-[50px] px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => {
                    const levels = levelsByTicker[stock.ticker];
                    return (
                      <tr
                        key={stock.ticker}
                        className="border-b border-[#072116]/8 transition hover:bg-[#ddb159]/8"
                      >
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/stock/${stock.ticker}`}
                            prefetch={false}
                            className="font-black text-[#072116] underline decoration-[#ddb159]/40 underline-offset-2 transition hover:decoration-[#ddb159]"
                          >
                            {stock.ticker}
                          </Link>
                        </td>
                        <td className="truncate px-3 py-2.5 font-semibold">
                          {stock.company ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#072116]/70">
                          #{stock.rank ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">
                          {formatPrice(stock.price)}
                        </td>
                        <td className="px-3 py-2.5 font-bold tabular-nums">
                          {levels ? `$${levels.entry.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-bold tabular-nums text-red-600">
                          {levels ? `$${levels.stopLoss.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-bold tabular-nums text-emerald-600">
                          {levels ? `$${levels.takeProfit.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex min-w-[60px] justify-center rounded-full bg-[#ddb159] px-2.5 py-0.5 text-[10px] font-black text-[#072116]">
                            {formatScore(stock.score)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <WatchlistRemoveButton ticker={stock.ticker} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[#ddb159]/18 bg-[#061b12]/42 lg:flex-1">
            <div className="text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full border border-[#ddb159]/25 bg-[#072116]">
                <svg
                  viewBox="0 0 24 24"
                  className="size-7 text-[#ddb159]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 2l2.9 6.3L22 9.2l-5 4.6L18.2 21 12 17.3 5.8 21 7 13.8 2 9.2l7.1-.9L12 2Z" />
                </svg>
              </div>
              <h2 className="mt-4 text-[18px] font-black tracking-[-0.02em] text-[#faf6f0]">
                Your watchlist is empty
              </h2>
              <p className="mt-1.5 max-w-xs text-[13px] font-medium text-[#faf6f0]/45">
                Find a stock and tap the star button on its detail page to add
                it here.
              </p>
              <Link
                href="/rankings"
                className="mt-5 inline-flex h-10 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-5 text-[12px] font-black text-[#072116] transition hover:bg-[#c9a04f]"
              >
                Browse rankings
              </Link>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
