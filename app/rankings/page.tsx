import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

type Ranking = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

export default async function RankingsPage() {
  const supabase = await createClient();

  // Check if user is authenticated and has access
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch rankings — show top 10 as teaser for non-subscribers,
  // or all 500 for subscribers.
  // TODO: Replace `hasAccess` with your actual subscription check
  // e.g. checking a `subscriptions` table or Stripe status
  const hasAccess = !!user;

  const { data: rankingsData } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,sector,score,price")
    .order("rank", { ascending: true })
    .limit(hasAccess ? 500 : 10);

  const rankings = (rankingsData ?? []) as Ranking[];

  return (
    <AppShell activePath="/rankings">
      <main className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-end justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
              Stock Rankings
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-[#faf6f0]/50">
              {hasAccess
                ? `${rankings.length} stocks ranked by AI score`
                : "Top 10 preview — subscribe for full access"}
            </p>
          </div>
          {!hasAccess && (
            <Link
              href="/pricing"
              className="rounded-full border-2 border-[#ddb159] bg-[#ddb159] px-4 py-2 text-[12px] font-black text-[#072116] transition hover:bg-[#c9a04f]"
            >
              Unlock full rankings
            </Link>
          )}
        </div>

        {/* Table */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
          <div className="h-full overflow-y-auto">
            <table className="w-full text-left text-[12px] text-[#072116]">
              <thead className="sticky top-0 z-10 bg-[#072116] text-[#faf6f0]">
                <tr>
                  <th className="w-[60px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                    Rank
                  </th>
                  <th className="w-[80px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                    Ticker
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                    Company
                  </th>
                  <th className="w-[150px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">
                    Sector
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
                {rankings.map((stock) => (
                  <tr
                    key={stock.id}
                    className="border-b border-[#072116]/8 transition hover:bg-[#ddb159]/8"
                  >
                    <td className="px-4 py-2.5 font-bold text-[#072116]/70">
                      {stock.rank ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/stock/${stock.ticker}`}
                        className="font-black text-[#072116] underline decoration-[#ddb159]/40 underline-offset-2 transition hover:decoration-[#ddb159]"
                      >
                        {stock.ticker ?? "—"}
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

          {/* Paywall overlay for non-subscribers */}
          {!hasAccess && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center justify-end pb-10">
              {/* Gradient fade */}
              <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#faf6f0] via-[#faf6f0]/95 to-transparent" />

              {/* CTA */}
              <div className="relative text-center">
                <div className="mb-3 grid size-14 mx-auto place-items-center rounded-full border-2 border-[#ddb159] bg-[#072116]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-6 text-[#ddb159]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </div>
                <h2 className="text-[22px] font-black tracking-[-0.03em] text-[#072116]">
                  Unlock all 500 stocks
                </h2>
                <p className="mt-1 text-[13px] font-medium text-[#072116]/55">
                  Subscribe to see the full ranked list with AI scores and
                  sector breakdowns.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex h-11 items-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] px-6 text-[13px] font-black text-[#072116] transition hover:bg-[#c9a04f]"
                >
                  View pricing
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
