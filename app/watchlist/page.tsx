import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

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

  // Fetch user's watchlist tickers
  // TODO: Adjust table/column names to match your schema.
  // Expected: a `watchlist` or `user_watchlist` table with
  // at least `user_id` and `ticker` columns.
  const { data: watchlistData } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const tickers = (watchlistData ?? []).map((w) => w.ticker as string);

  // Fetch stock data for those tickers
  let stocks: WatchlistStock[] = [];
  if (tickers.length > 0) {
    const { data: stocksData } = await supabase
      .from("stock_rankings")
      .select("ticker,company,sector,rank,score,price")
      .in("ticker", tickers);

    // Preserve watchlist order
    const stockMap = new Map(
      (stocksData ?? []).map((s) => [s.ticker, s as WatchlistStock])
    );
    stocks = tickers
      .map((t) => stockMap.get(t))
      .filter((s): s is WatchlistStock => !!s);
  }

  return (
    <AppShell activePath="/watchlist">
      <main className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        {/* Header */}
        <div className="shrink-0">
          <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
            Watchlist
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[#faf6f0]/50">
            {stocks.length > 0
              ? `${stocks.length} stock${stocks.length !== 1 ? "s" : ""} you're tracking`
              : "Stocks you want to keep an eye on"}
          </p>
        </div>

        {stocks.length > 0 ? (
          /* Watchlist table */
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
            <div className="h-full overflow-y-auto">
              <table className="w-full text-left text-[12px] text-[#072116]">
                <thead className="sticky top-0 z-10 bg-[#072116] text-[#faf6f0]">
                  <tr>
                    <th className="w-[80px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Ticker
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Company
                    </th>
                    <th className="w-[150px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Sector
                    </th>
                    <th className="w-[70px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="w-[100px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      Price
                    </th>
                    <th className="w-[100px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                      AI Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => (
                    <tr
                      key={stock.ticker}
                      className="border-b border-[#072116]/8 transition hover:bg-[#ddb159]/8"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/stock/${stock.ticker}`}
                          className="font-black text-[#072116] underline decoration-[#ddb159]/40 underline-offset-2 transition hover:decoration-[#ddb159]"
                        >
                          {stock.ticker}
                        </Link>
                      </td>
                      <td className="truncate px-4 py-2.5 font-semibold">
                        {stock.company ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-full border border-[#072116]/10 px-2 py-0.5 text-[10px] font-bold text-[#072116]/60">
                          {stock.sector ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-[#072116]/70">
                        #{stock.rank ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums">
                        {formatPrice(stock.price)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex min-w-[60px] justify-center rounded-full bg-[#ddb159] px-2.5 py-0.5 text-[10px] font-black text-[#072116]">
                          {formatScore(stock.score)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[#ddb159]/25 bg-[#061b12]/50">
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
                Search for a stock and add it to your watchlist to track its AI
                score and ranking over time.
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
