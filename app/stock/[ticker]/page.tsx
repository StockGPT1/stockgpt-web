import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

type StockData = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

function formatPrice(value: StockData["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: StockData["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function scoreColor(score: number) {
  if (score >= 9000) return "text-emerald-400";
  if (score >= 7000) return "text-[#ddb159]";
  if (score >= 4000) return "text-orange-400";
  return "text-red-400";
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const supabase = await createClient();

  // Fetch this stock
  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,sector,score,price,updated_at")
    .eq("ticker", upperTicker)
    .single();

  if (!stock) notFound();

  const s = stock as StockData;
  const numScore = Number(s.score);

  // Fetch sector peers (same sector, ordered by rank, excluding this stock)
  const { data: peersData } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,score,price")
    .eq("sector", s.sector ?? "")
    .neq("ticker", upperTicker)
    .order("rank", { ascending: true })
    .limit(5);

  const peers = (peersData ?? []) as StockData[];

  return (
    <AppShell activePath="">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#faf6f0]/50">
          <Link href="/" className="transition hover:text-[#ddb159]">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/rankings" className="transition hover:text-[#ddb159]">
            Rankings
          </Link>
          <span>/</span>
          <span className="text-[#ddb159]">{s.ticker}</span>
        </div>

        {/* Header card */}
        <div className="rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(90deg,#082519,#123b25)] px-6 py-5 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[40px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">
                  {s.ticker}
                </h1>
                {s.rank != null && (
                  <span className="rounded-full border border-[#ddb159]/30 bg-[#072116]/60 px-3 py-1 text-[11px] font-bold text-[#ddb159]">
                    Rank #{s.rank}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[16px] font-semibold text-[#faf6f0]/70">
                {s.company ?? "Unknown company"}
              </p>
              {s.sector && (
                <p className="mt-1.5 inline-block rounded-full border border-[#ddb159]/20 bg-[#072116]/40 px-2.5 py-0.5 text-[10px] font-bold text-[#ddb159]">
                  {s.sector}
                </p>
              )}
            </div>

            <div className="text-right">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#ddb159]">
                Price
              </p>
              <p className="mt-1 text-[32px] font-black leading-none tracking-[-0.03em] text-[#faf6f0]">
                {formatPrice(s.price)}
              </p>
            </div>
          </div>
        </div>

        {/* Score + details grid */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          {/* AI Score card */}
          <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">
              AI Score
            </p>
            <p
              className={`mt-1 text-[42px] font-black leading-none tracking-[-0.04em] ${Number.isFinite(numScore) ? scoreColor(numScore) : "text-[#072116]"}`}
            >
              {formatScore(s.score)}
            </p>
            <p className="mt-2 text-[10px] font-semibold text-[#072116]/55">
              {Number.isFinite(numScore) && numScore >= 9000
                ? "Exceptionally strong signal"
                : Number.isFinite(numScore) && numScore >= 7000
                  ? "Strong signal"
                  : Number.isFinite(numScore) && numScore >= 4000
                    ? "Moderate signal"
                    : "Weak signal"}
            </p>
          </div>

          {/* Rank card */}
          <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">
              Overall Rank
            </p>
            <p className="mt-1 text-[42px] font-black leading-none tracking-[-0.04em]">
              {s.rank != null ? `#${s.rank}` : "—"}
            </p>
            <p className="mt-2 text-[10px] font-semibold text-[#072116]/55">
              out of 500 ranked stocks
            </p>
          </div>

          {/* Last updated card */}
          <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">
              Last Updated
            </p>
            <p className="mt-1 text-[20px] font-black leading-none tracking-[-0.02em]">
              {s.updated_at
                ? new Date(s.updated_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
            <p className="mt-1 text-[16px] font-bold text-[#072116]/70">
              {s.updated_at
                ? new Date(s.updated_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </p>
          </div>
        </div>

        {/* Sector peers */}
        {peers.length > 0 && (
          <div className="mt-3 rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
            <h2 className="text-[16px] font-black tracking-[-0.02em]">
              Sector Peers — {s.sector}
            </h2>
            <p className="mb-3 text-[10px] font-semibold text-[#072116]/55">
              Other stocks in the same sector, ranked by AI score
            </p>
            <div className="overflow-hidden rounded-xl border border-[#072116]/10">
              <table className="w-full table-fixed text-left text-[11px]">
                <thead className="bg-[#072116] text-[#faf6f0]">
                  <tr>
                    <th className="w-[50px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="w-[76px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Ticker
                    </th>
                    <th className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Company
                    </th>
                    <th className="w-[90px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Price
                    </th>
                    <th className="w-[88px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      AI Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((peer) => (
                    <tr
                      key={peer.id}
                      className="border-b border-[#072116]/10 transition last:border-b-0 hover:bg-[#ddb159]/8"
                    >
                      <td className="px-2.5 py-1.5 font-bold">
                        {peer.rank ?? "—"}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Link
                          href={`/stock/${peer.ticker}`}
                          className="font-black underline decoration-[#ddb159]/40 underline-offset-2 transition hover:decoration-[#ddb159]"
                        >
                          {peer.ticker}
                        </Link>
                      </td>
                      <td className="truncate px-2.5 py-1.5 font-semibold">
                        {peer.company ?? "—"}
                      </td>
                      <td className="px-2.5 py-1.5 font-semibold">
                        {formatPrice(peer.price)}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className="inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116]">
                          {formatScore(peer.score)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
