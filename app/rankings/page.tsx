import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { RankingsMobileBatchList } from "@/components/RankingsMobileBatchList";
import { LazyWhyRankDetails } from "@/components/LazyWhyRankDetails";
import { RankingsLock } from "@/components/RankingsLock";
import { StockIcon } from "@/components/StockIcon";
import { StockLogo } from "@/components/StockLogo";
import { getOneDayMoveMap, getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
  moveClassName,
} from "@/lib/rank-history";
import {
  getModelConfidence,
  lightConfidenceClassName,
  matchesConfidenceFilter,
  matchesPriceMoveFilter,
  matchesScoreFilter,
} from "@/lib/research-explainability";
import {
  getRankingSectors,
  getStableRankingsPage,
  type StableRankingRow,
} from "@/lib/stable-rankings";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const metadata: Metadata = {
  title: "AI Stock Rankings | StockGPT S&P 500 Leaderboard",
  description:
    "Explore StockGPT AI rankings for S&P 500 stocks using technical, fundamental and market data.",
  robots: { index: false, follow: false },
};

type Ranking = StableRankingRow;

type RankingsSearchParams = {
  q?: string;
  sector?: string;
  move?: string;
  score?: string;
  priceMove?: string;
  confidence?: string;
  page?: string;
};

type Profile = {
  subscription_status: string | null;
};

const MIN_DISPLAY_SCORE = 100;

function normalizeDisplayScore(value: Ranking["score"]) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
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
  if (hasValidPrice(stock.price) || !stock.ticker) return stock;
  const chartData = await getStockChart(stock.ticker, ["1D", "5D", "1M", "6M", "1Y"]);
  const livePrice = getLatestPriceFromChart(chartData);
  if (!livePrice || !Number.isFinite(livePrice) || livePrice <= 0) return stock;
  return { ...stock, price: livePrice };
}

function dailyMoveClassName(changePct: number | null | undefined) {
  if (!Number.isFinite(changePct)) return "text-[#072116]/35";
  if (Number(changePct) >= 0) return "text-emerald-700";
  return "text-red-700";
}

function DailyMovePill({
  changePct,
  className = "text-[10px]",
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
        "inline-block shrink-0 font-black tabular-nums",
        className,
        dailyMoveClassName(value),
      ].join(" ")}
    >
      {value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}

function matchesMoveFilter(stock: Ranking, moveFilter: string, snapshotMap: Map<string, number>) {
  if (!moveFilter || moveFilter === "all") return true;
  const ticker = stock.ticker ?? "";
  const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));
  return move.tone === moveFilter;
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="relative flex h-11 min-w-0 items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-3 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
      <span className="pointer-events-none absolute left-4 top-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="h-full w-full appearance-none bg-transparent pt-3 text-[12px] font-black text-[#faf6f0] outline-none"
      >
        {options.map((option) => (
          <option className="text-black" key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <StockIcon
        name="chevron-down"
        className="pointer-events-none absolute right-4 size-3 text-[#ddb159]/70"
      />
    </label>
  );
}

function ScoreMethodCard() {
  const factors = [
    ["Financial strength", "Profitability, balance sheet quality and cash generation."],
    ["Growth potential", "Revenue, earnings and sector-adjusted growth signals."],
    ["Price value", "Whether price looks reasonable against the model signal."],
    ["Market trend", "Momentum, rank movement and recent price confirmation."],
    ["Risk level", "Volatility, downside risk and concentration warnings."],
    ["Dividend profile", "Income context where sector and data support it."],
  ];

  return (
    <details className="relative overflow-hidden rounded-[22px] border border-[#ddb159]/18 bg-[#04180f]/70 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
      <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
        How the AI score works
      </summary>
      <p className="mt-3 max-w-3xl text-[12px] font-semibold leading-6 text-[#faf6f0]/58">
        StockGPT ranks the S&amp;P 500 by combining business quality, growth, valuation discipline, trend, risk and income context into one comparable score. The score is a research signal, not a buy instruction.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {factors.map(([title, detail]) => (
          <div key={title} className="rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] p-3">
            <p className="text-[12px] font-black text-[#faf6f0]">{title}</p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/50">{detail}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function HiddenFilterValue({ name, value }: { name: string; value: string }) {
  return value && value !== "all" ? <input type="hidden" name={name} value={value} /> : null;
}

function rankingsPageHref(params: RankingsSearchParams, page: number) {
  const next = new URLSearchParams();

  for (const key of ["q", "sector", "move", "score", "priceMove", "confidence"] as const) {
    const value = params[key];
    if (value && value !== "all") next.set(key, value);
  }

  if (page > 1) next.set("page", String(page));
  const query = next.toString();
  return query ? `/rankings?${query}` : "/rankings";
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams?: Promise<RankingsSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const q = (params.q ?? "").trim();
  const sectorFilter = params.sector ?? "all";
  const moveFilter = params.move ?? "all";
  const scoreFilter = params.score ?? "all";
  const priceMoveFilter = params.priceMove ?? "all";
  const confidenceFilter = params.confidence ?? "all";
  const advancedFiltersActive =
    sectorFilter !== "all" ||
    moveFilter !== "all" ||
    scoreFilter !== "all" ||
    priceMoveFilter !== "all" ||
    confidenceFilter !== "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, sectors] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("subscription_status")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getRankingSectors(supabase),
  ]);

  const profile = (profileResult.data ?? null) as Profile | null;
  const hasSubscription = hasActiveSubscription(profile?.subscription_status);

  const rankingsLocked = !hasSubscription;
  const perPage = rankingsLocked ? 10 : 50;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const currentPage =
    rankingsLocked || !Number.isFinite(parsedPage) || parsedPage < 1
      ? 1
      : parsedPage;
  const offset = (currentPage - 1) * perPage;
  const rankingSource = rankingsLocked ? createAdminClient() : supabase;
  const rankingPage = await getStableRankingsPage(rankingSource, {
    limit: perPage,
    offset,
    q,
    sector: sectorFilter,
    scoreFilter,
  });
  const rawRankings = rankingPage.rows;

  // Run price enrichment and daily move fetch concurrently —
  // previously dailyMoveMap waited for allRankings to complete first.
  const tickers = rawRankings
    .map((stock) => stock.ticker)
    .filter((ticker): ticker is string => !!ticker);

  const [allRankings, dailyMoveMap, snapshotMap] = await Promise.all([
    Promise.all(rawRankings.map((stock) => attachLivePriceIfMissing(stock))),
    getOneDayMoveMap(tickers),
    getRankSnapshotMapAround24hAgo(supabase, tickers),
  ]);

  const rankings = allRankings.filter((stock) => {
    const ticker = stock.ticker ?? "";
    const dailyMove = dailyMoveMap.get(ticker)?.changePct;
    const searchable = `${stock.ticker ?? ""} ${stock.company ?? ""}`.toLowerCase();
    const matchesSearch = !q || searchable.includes(q.toLowerCase());
    const matchesSector = sectorFilter === "all" || stock.sector === sectorFilter;
    const matchesMove = matchesMoveFilter(stock, moveFilter, snapshotMap);

    return (
      matchesSearch &&
      matchesSector &&
      matchesMove &&
      matchesScoreFilter(stock, scoreFilter) &&
      matchesPriceMoveFilter(dailyMove, priceMoveFilter) &&
      matchesConfidenceFilter(stock, confidenceFilter)
    );
  });
  const totalPages = Math.max(1, Math.ceil(rankingPage.total / perPage));
  const hasPreviousPage = !rankingsLocked && currentPage > 1;
  const hasNextPage =
    !rankingsLocked &&
    currentPage < totalPages &&
    offset + rawRankings.length < rankingPage.total;

  const gridCols = "grid-cols-[58px_72px_104px_minmax(0,1fr)_110px_86px_92px_86px]";

  return (
    <AppShell activePath="/rankings" askLabel="Ask about rankings" askContext={{ contextType: "rankings", activeFilters: { q, sector: sectorFilter, move: moveFilter, score: scoreFilter, priceMove: priceMoveFilter, confidence: confidenceFilter } }}>
      <main className="flex min-h-full flex-col gap-3 overflow-y-auto overflow-x-hidden pr-1 pb-8">
        <section className="relative shrink-0 overflow-hidden rounded-[24px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,0.07),rgba(250,246,240,0.022)_46%,rgba(221,177,89,0.06))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-4">
          <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ddb159]/24 bg-[#072116]/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span className="size-1.5 rounded-full bg-[#ddb159] shadow-[0_0_12px_rgba(221,177,89,0.8)]" />
                AI Ranking Engine
              </div>
              <h1 className="text-[28px] font-black leading-none tracking-[-0.055em] text-[#faf6f0] sm:text-[34px]">
                Stock Rankings
              </h1>
              <div className="mt-2"><FreshnessLabel value={rawRankings[0]?.updated_at} label={rawRankings[0]?.updated_at ? `Last model run ${new Date(rawRankings[0].updated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Model run time unavailable"} /></div>
              <p className="mt-2 max-w-[680px] text-[12px] font-medium leading-relaxed text-[#faf6f0]/58 sm:text-[13px]">
                {hasSubscription
                  ? `${rankings.length} stocks shown on page ${currentPage} of ${totalPages}. Rankings use the latest complete StockGPT snapshot.`
                  : "Rankings are locked. Subscribe to Core to unlock the full AI ranking table, score context and why-this-rank explanations."}
              </p>
            </div>

            {rankingsLocked && (
              <Link href="/pricing" className="group relative w-fit overflow-hidden rounded-full bg-[#ddb159] px-5 py-3 text-[12px] font-black text-[#072116] shadow-[0_14px_30px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(221,177,89,0.32)]">
                <span className="relative">Unlock full rankings →</span>
              </Link>
            )}
          </div>

          <form className="relative mt-3 rounded-[20px] border border-[#ddb159]/16 bg-[#02150d]/62 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_12px_26px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            {!advancedFiltersActive && (
              <>
                <HiddenFilterValue name="sector" value={sectorFilter} />
                <HiddenFilterValue name="move" value={moveFilter} />
                <HiddenFilterValue name="score" value={scoreFilter} />
                <HiddenFilterValue name="priceMove" value={priceMoveFilter} />
                <HiddenFilterValue name="confidence" value={confidenceFilter} />
              </>
            )}

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
              <label className="group flex h-11 min-w-0 items-center gap-3 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ddb159]/12 text-[#ddb159] transition group-focus-within:bg-[#ddb159] group-focus-within:text-[#072116]">
                  <StockIcon name="search" className="size-4" />
                </span>
                <input name="q" defaultValue={params.q ?? ""} placeholder="Search ticker or company" className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/34" />
              </label>

              <button type="submit" className="h-11 rounded-2xl bg-[#ddb159] px-6 text-[13px] font-black text-[#072116] shadow-[0_10px_22px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:brightness-105">
                Apply
              </button>

              <Link href="/rankings" className="grid h-11 place-items-center rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.035] px-6 text-[13px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/40 hover:bg-[#ddb159]/10 hover:text-[#ddb159]">
                Reset
              </Link>
            </div>

            <details open={advancedFiltersActive} className="mt-2 rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.025] p-2">
              <summary className="cursor-pointer list-none rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                Advanced filters {advancedFiltersActive ? "active" : "optional"}
                <StockIcon name="chevron-down" className="ml-1 inline size-3" />
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                <FilterSelect label="Sector" name="sector" value={sectorFilter} options={[{ value: "all", label: "All sectors" }, ...sectors.map((sector) => ({ value: sector, label: sector }))]} />
                <FilterSelect label="Rank move" name="move" value={moveFilter} options={[{ value: "all", label: "All ranks" }, { value: "up", label: "Moved up" }, { value: "down", label: "Moved down" }, { value: "flat", label: "Flat" }, { value: "none", label: "No history" }]} />
                <FilterSelect label="Score" name="score" value={scoreFilter} options={[{ value: "all", label: "All scores" }, { value: "elite", label: "Elite" }, { value: "strong", label: "Strong" }, { value: "positive", label: "Positive" }, { value: "mixed", label: "Mixed" }, { value: "weak", label: "Weak" }]} />
                <FilterSelect label="Price move" name="priceMove" value={priceMoveFilter} options={[{ value: "all", label: "All prices" }, { value: "up", label: "Up today" }, { value: "down", label: "Down today" }, { value: "big-up", label: "+2%+" }, { value: "big-down", label: "−2%+" }, { value: "flat", label: "Flat" }]} />
                <FilterSelect label="Confidence" name="confidence" value={confidenceFilter} options={[{ value: "all", label: "All confidence" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
              </div>
            </details>
          </form>
        </section>

        <ScoreMethodCard />

        <RankingsLock isLocked={rankingsLocked} className="min-w-0 max-w-full overflow-hidden bg-[#faf6f0] lg:hidden">
          <RankingsMobileBatchList initialItems={rankings.map((stock) => ({ ...stock, dailyMove: dailyMoveMap.get(stock.ticker ?? "")?.changePct ?? null }))} initialPage={currentPage} totalPages={totalPages} locked={rankingsLocked} filters={{ q, sector: sectorFilter, move: moveFilter, score: scoreFilter, priceMove: priceMoveFilter, confidence: confidenceFilter }} />
        </RankingsLock>

        <RankingsLock isLocked={rankingsLocked} className="relative hidden min-w-0 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)] lg:block">
          <div className="min-w-0">
            <div className={`grid ${gridCols} sticky top-0 z-10 bg-[#072116] text-[#faf6f0]`}>
              {["Rank", "Move", "Ticker", "Company", "Confidence", "Price", "AI Score", "Why"].map((header) => (
                <div key={header} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">{header}</div>
              ))}
            </div>

            <div>
              {rankings.length > 0 ? (
                rankings.map((stock) => {
                  const ticker = stock.ticker ?? "";
                  const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));
                  const dailyMove = dailyMoveMap.get(ticker)?.changePct;
                  const confidence = getModelConfidence(stock);

                  return (
                    <div key={stock.id} className="border-b border-[#072116]/8">
                      <div className={`grid ${gridCols} items-center text-[12px] text-[#072116] transition hover:bg-[#ddb159]/8`}>
                        <div className="px-4 py-2.5 font-bold text-[#072116]/70">{stock.rank ?? "—"}</div>
                        <div className="px-4 py-2.5"><span title={move.title} className={["inline-flex h-6 min-w-[46px] items-center justify-center rounded-full border px-2 text-[10px] font-black tabular-nums", moveClassName(move.tone)].join(" ")}>{move.label}</span></div>
                        <Link href={`/stock/${stock.ticker}`} className="flex items-center gap-2 px-4 py-2.5 font-black text-[#072116]"><StockLogo ticker={stock.ticker} company={stock.company} size={22} /><span>{stock.ticker ?? "—"}</span></Link>
                        <div className="flex min-w-0 items-center gap-2 px-4 py-2.5 font-semibold text-[#072116]"><span className="min-w-0 truncate">{stock.company ?? "—"}</span><DailyMovePill changePct={dailyMove} /></div>
                        <div className="px-4 py-2.5"><span className={["inline-flex rounded-full border px-2 py-1 text-[9px] font-black", lightConfidenceClassName(confidence.label)].join(" ")}>{confidence.label}</span></div>
                        <div className="px-4 py-2.5 font-semibold tabular-nums text-[#072116]">{formatPrice(stock.price)}</div>
                        <div className="px-4 py-2.5"><span className="inline-flex min-w-[68px] justify-center rounded-full bg-[#ddb159] px-2.5 py-0.5 text-[10px] font-black text-[#072116]">{formatScore(stock.score)}</span></div>
                        <div className="px-2 py-1.5"><LazyWhyRankDetails stock={stock} dailyMove={dailyMove} /></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-10 text-center text-[13px] font-bold text-[#072116]/55">No stocks match those filters.</div>
              )}
            </div>
          </div>
        </RankingsLock>

        {!rankingsLocked && (
          <nav
            aria-label="Rankings pages"
            className="hidden min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/72 p-2 lg:grid"
          >
            {hasPreviousPage ? (
              <Link
                href={rankingsPageHref(params, currentPage - 1)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb159]/28 px-4 text-[11px] font-black text-[#ddb159]"
              >
                Previous
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/55">
              Page {currentPage} of {totalPages}
            </span>
            {hasNextPage ? (
              <Link
                href={rankingsPageHref(params, currentPage + 1)}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#072116]"
              >
                Next 50
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
      </main>
    </AppShell>
  );
}
