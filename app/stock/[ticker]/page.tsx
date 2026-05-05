import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TradeSetupCard } from "@/components/TradeSetupCard";
import { WatchlistToggle } from "@/components/WatchlistToggle";
import { StockChart } from "@/components/StockChart";
import { calculateTradeLevels } from "@/lib/trading-levels";
import { createClient } from "@/utils/supabase/server";
import { getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";

type Stock = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const supabase = await createClient();

  const { data: stockData } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,sector,score,price")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!stockData) notFound();
  const stock = stockData as Stock;

  // ✦ Fetch chart FIRST so we can use its price as the canonical value
  const chartData = await getStockChart(ticker, ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"]);

  // ✦ Single source of truth: Yahoo's most recent close from chart data
  // Falls back to Supabase price if Yahoo is unavailable
  const livePrice = getLatestPriceFromChart(chartData) ?? (Number(stock.price) || 0);

  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const [tradeLevels, watchlistEntry, sectorPeers] = await Promise.all([
    // ✦ Pass livePrice so trade levels match what's displayed
    calculateTradeLevels({
      ticker,
      price: livePrice,
      score: Number(stock.score) || 0,
      rank: Number(stock.rank) || null,
      sector: stock.sector ?? null,
    }),
    isAuthenticated && stock.ticker
      ? supabase
          .from("user_watchlist")
          .select("id")
          .eq("user_id", user!.id)
          .eq("ticker", stock.ticker)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    stock.sector
      ? supabase
          .from("stock_rankings")
          .select("ticker, company, rank, score, price")
          .eq("sector", stock.sector)
          .neq("ticker", ticker)
          .order("rank", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const peers = (sectorPeers?.data ?? []) as Array<{
    ticker: string;
    company: string;
    rank: number;
    score: number;
    price: number;
  }>;

  const inWatchlist = !!watchlistEntry;

  return (
    <AppShell activePath="/rankings">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-3">
          {/* HERO */}
          <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#ddb159]/70">
                  <Link href="/rankings" className="hover:text-[#ddb159]">← Rankings</Link>
                  <span>·</span>
                  <span>Rank #{stock.rank ?? "—"}</span>
                  {stock.sector && (
                    <>
                      <span>·</span>
                      <span>{stock.sector}</span>
                    </>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <h1 className="text-[34px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">
                    {stock.ticker}
                  </h1>
                  <p className="text-[16px] font-bold text-[#faf6f0]/70">{stock.company ?? "—"}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {/* ✦ Now using livePrice from same source as chart */}
                  <p className="text-[26px] font-black tabular-nums tracking-[-0.03em] text-[#faf6f0]">
                    ${livePrice.toFixed(2)}
                  </p>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: "#ddb159", color: "#072116" }}
                  >
                    AI Score · {Number(stock.score).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <WatchlistToggle
                  ticker={ticker}
                  initialInWatchlist={inWatchlist}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
          </div>

          {/* CHART */}
          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              ✦ Price Chart
            </p>
            <div className="mt-2">
              <StockChart
                ticker={ticker}
                data={chartData}
                initialRange="1Y"
                height={320}
              />
            </div>
          </div>

          {/* TRADE SETUP + PEERS */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            {tradeLevels && <TradeSetupCard levels={tradeLevels} />}

            {peers.length > 0 && (
              <aside className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "rgba(7,33,22,0.55)" }}>
                  ✦ Sector Peers
                </p>
                <p className="mt-1 text-[11px] font-semibold" style={{ color: "rgba(7,33,22,0.55)" }}>
                  Top 5 in {stock.sector}
                </p>
                <div className="mt-3 grid gap-1.5">
                  {peers.map((p) => (
                    <Link
                      key={p.ticker}
                      href={`/stock/${p.ticker}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:border-[#ddb159]"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>
                          {p.ticker}
                        </p>
                        <p className="truncate text-[10px] font-semibold" style={{ color: "rgba(7,33,22,0.55)" }}>
                          {p.company}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold" style={{ color: "rgba(7,33,22,0.65)" }}>
                          #{p.rank}
                        </p>
                        <span
                          className="inline-flex justify-center rounded-full px-2 py-0.5 text-[9px] font-black"
                          style={{ backgroundColor: "#ddb159", color: "#072116" }}
                        >
                          {Number(p.score).toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
