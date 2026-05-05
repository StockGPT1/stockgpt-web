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

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function getRankMove(currentRank: number | null, previousRank: number | null): RankMove {
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

export default async function RankingsPage() {
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

  const rankings = (rankingsData ?? []) as Ranking[];

  const gridCols =
    "grid-cols-[58px_76px_108px_minmax(0,1fr)_150px_100px_100px]";

  return (
    <AppShell activePath="/rankings">
      <main className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 items-end justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
              Stock Rankings
            </h1>

            <p className="mt-0.5 text-[13px] font-medium text-[#faf6f0]/50">
              {hasAccess
                ? `${rankings.length} stocks ranked by AI score · click any row for full analysis`
                : "Top 10 preview — sign in for full access"}
            </p>
          </div>

          {!hasAccess && (
            <Link
              href="/pricing"
              style={{ backgroundColor: "#ddb159", color: "#072116" }}
              className="rounded-full px-4 py-2 text-[12px] font-black transition hover:opacity-90"
            >
              Unlock full rankings
            </Link>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
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
            {rankings.map((stock) => {
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
                      className="inline-flex min-w-[60px] justify-center rounded-full px-2.5 py-0.5 text-[10px] font-black"
                      style={{ backgroundColor: "#ddb159", color: "#072116" }}
                    >
                      {formatScore(stock.score)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
