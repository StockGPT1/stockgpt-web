import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { getOneDayMoveMap, getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
  moveClassName,
} from "@/lib/rank-history";
import {
  buildRankExplanation,
  confidenceClassName,
  getFactorExplanations,
  getModelConfidence,
  getStyleTags,
  lightConfidenceClassName,
  matchesConfidenceFilter,
  matchesPriceMoveFilter,
  matchesScoreFilter,
  matchesStyleFilter,
} from "@/lib/research-explainability";

export const metadata: Metadata = {
  title: "AI Stock Rankings | StockGPT S&P 500 Leaderboard",
  description:
    "Explore StockGPT AI rankings for S&P 500 stocks using technical, fundamental and market data.",
  robots: { index: false, follow: false },
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

type RankingsSearchParams = {
  q?: string;
  sector?: string;
  move?: string;
  score?: string;
  priceMove?: string;
  style?: string;
  confidence?: string;
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
  if (!Number.isFinite(changePct)) return "border-[#072116]/8 bg-transparent text-[#072116]/35";
  if (Number(changePct) >= 0) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
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
    <label className="relative flex h-12 min-w-0 items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-3 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
      <span className="pointer-events-none absolute left-4 top-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70">
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
      <span className="pointer-events-none absolute right-4 text-[10px] text-[#ddb159]/70">▾</span>
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
    <details className="relative overflow-hidden rounded-[24px] border border-[#ddb159]/18 bg-[#04180f]/70 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
      <summary className="cursor-pointer list-none text-[11px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
        How the AI score works
      </summary>
      <p className="mt-3 max-w-3xl text-[12px] font-semibold leading-6 text-[#faf6f0]/58">
        StockGPT ranks the S&P 500 by combining business quality, growth, valuation discipline, trend, risk and income context into one comparable score. The score is a research signal, not a buy instruction.
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

function WhyRankDetails({
  stock,
  move,
  dailyMove,
  light = false,
}: {
  stock: Ranking;
  move: ReturnType<typeof getRankMove24h>;
  dailyMove: number | null | undefined;
  light?: boolean;
}) {
  const explanation = buildRankExplanation(stock, move, dailyMove);
  const factors = getFactorExplanations(stock, dailyMove);

  return (
    <details className={light ? "mt-3 rounded-2xl border border-[#072116]/10 bg-white px-3 py-2" : "border-b border-[#072116]/8 bg-white/72 px-4 py-2"}>
      <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.12em] text-[#8a641a]">
        Why this rank?
      </summary>
      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#072116]/68">{explanation.summary}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {factors.map((factor) => (
          <div key={factor.label} className="rounded-xl border border-[#072116]/8 bg-[#072116]/[0.025] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/45">{factor.label}</p>
              <span className="shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-0.5 text-[8px] font-black text-[#8a641a]">{factor.value}</span>
            </div>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-[#072116]/58">{factor.detail}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function StyleTags({ tags, light = false }: { tags: string[]; light?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className={[
            "rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em]",
            light
              ? "border-[#072116]/8 bg-[#072116]/5 text-[#072116]/55"
              : "border-[#ddb159]/18 bg-[#ddb159]/10 text-[#ddb159]",
          ].join(" ")}
        >
          {tag}
        </span>
      ))}
    </div>
  );
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
  const scoreFilter = params.score ?? "all";
  const priceMoveFilter = params.priceMove ?? "all";
  const styleFilter = params.style ?? "all";
  const confidenceFilter = params.confidence ?? "all";

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
  const allRankings = await Promise.all(rawRankings.map((stock) => attachLivePriceIfMissing(stock)));

  const dailyMoveMap = await getOneDayMoveMap(
    allRankings.map((stock) => stock.ticker).filter((ticker): ticker is string => !!ticker),
  );

  const sectors = Array.from(
    new Set(allRankings.map((stock) => stock.sector).filter((sector): sector is string => Boolean(sector))),
  ).sort((a, b) => a.localeCompare(b));

  const rankings = allRankings.filter((stock) => {
    const ticker = stock.ticker ?? "";
    const dailyMove = dailyMoveMap.get(ticker)?.changePct;
    const searchable = `${stock.ticker ?? ""} ${stock.company ?? ""}`.toLowerCase();
    const matchesSearch = !q || searchable.includes(q);
    const matchesSector = sectorFilter === "all" || stock.sector === sectorFilter;
    const matchesMove = matchesMoveFilter(stock, moveFilter, snapshotMap);

    return (
      matchesSearch &&
      matchesSector &&
      matchesMove &&
      matchesScoreFilter(stock, scoreFilter) &&
      matchesPriceMoveFilter(dailyMove, priceMoveFilter) &&
      matchesStyleFilter(stock, dailyMove, styleFilter) &&
      matchesConfidenceFilter(stock, confidenceFilter)
    );
  });

  const gridCols = "grid-cols-[58px_72px_104px_minmax(0,1fr)_110px_150px_86px_92px]";

  return (
    <AppShell activePath="/rankings">
      <main className="flex min-h-full flex-col gap-3 overflow-x-hidden lg:h-full lg:min-h-0 lg:overflow-hidden">
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

              <p className="mt-2 max-w-[680px] text-[13px] font-medium leading-relaxed text-[#faf6f0]/58">
                {hasSubscription
                  ? `${rankings.length} stocks shown from ${allRankings.length} ranked names. Use filters to narrow by confidence, score quality, price move, sector and strategy style.`
                  : "Rankings are locked. Subscribe to Core to unlock the full AI ranking table, score context and why-this-rank explanations."}
              </p>
            </div>

            {rankingsLocked && (
              <Link href="/pricing" className="group relative w-fit overflow-hidden rounded-full bg-[#ddb159] px-5 py-3 text-[12px] font-black text-[#072116] shadow-[0_14px_30px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(221,177,89,0.32)]">
                <span className="relative">Unlock full rankings →</span>
              </Link>
            )}
          </div>

          <form className="relative mt-4 grid grid-cols-1 gap-2 rounded-[22px] border border-[#ddb159]/16 bg-[#02150d]/62 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl md:grid-cols-2 xl:grid-cols-[minmax(250px,1fr)_170px_150px_150px_150px_150px_150px_auto]">
            <label className="group flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)] md:col-span-2 xl:col-span-1">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ddb159]/12 text-[13px] text-[#ddb159] transition group-focus-within:bg-[#ddb159] group-focus-within:text-[#072116]">⌕</span>
              <input name="q" defaultValue={params.q ?? ""} placeholder="Search ticker or company" className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/34" />
            </label>

            <FilterSelect label="Sector" name="sector" value={sectorFilter} options={[{ value: "all", label: "All sectors" }, ...sectors.map((sector) => ({ value: sector, label: sector }))]} />
            <FilterSelect label="Rank move" name="move" value={moveFilter} options={[{ value: "all", label: "All ranks" }, { value: "up", label: "Moved up" }, { value: "down", label: "Moved down" }, { value: "flat", label: "Flat" }, { value: "none", label: "No history" }]} />
            <FilterSelect label="Score" name="score" value={scoreFilter} options={[{ value: "all", label: "All scores" }, { value: "elite", label: "Elite" }, { value: "strong", label: "Strong" }, { value: "positive", label: "Positive" }, { value: "mixed", label: "Mixed" }, { value: "weak", label: "Weak" }]} />
            <FilterSelect label="Price move" name="priceMove" value={priceMoveFilter} options={[{ value: "all", label: "All prices" }, { value: "up", label: "Up today" }, { value: "down", label: "Down today" }, { value: "big-up", label: "+2%+" }, { value: "big-down", label: "−2%+" }, { value: "flat", label: "Flat" }]} />
            <FilterSelect label="Style" name="style" value={styleFilter} options={[{ value: "all", label: "All styles" }, { value: "low-risk", label: "Low risk" }, { value: "growth", label: "Growth" }, { value: "value", label: "Value" }, { value: "income", label: "Income" }, { value: "momentum", label: "Momentum" }, { value: "pullback", label: "Pullback" }]} />
            <FilterSelect label="Confidence" name="confidence" value={confidenceFilter} options={[{ value: "all", label: "All confidence" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />

            <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1 xl:flex">
              <button type="submit" className="h-12 rounded-2xl bg-[#ddb159] px-5 text-[13px] font-black text-[#072116] shadow-[0_10px_22px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:brightness-105">Apply</button>
              <Link href="/rankings" className="grid h-12 place-items-center rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.035] px-5 text-[13px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/40 hover:bg-[#ddb159]/10 hover:text-[#ddb159]">Reset</Link>
            </div>
          </form>
        </section>

        <ScoreMethodCard />

        <RankingsLock isLocked={rankingsLocked} className="grid min-w-0 max-w-full gap-2 overflow-hidden lg:hidden">
          {rankings.length > 0 ? (
            rankings.map((stock) => {
              const ticker = stock.ticker ?? "";
              const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));
              const dailyMove = dailyMoveMap.get(ticker)?.changePct;
              const confidence = getModelConfidence(stock);
              const tags = getStyleTags(stock, dailyMove);

              return (
                <div key={stock.id} className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_24px_rgba(0,0,0,0.16)] ring-1 ring-white/20">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <Link href={`/stock/${stock.ticker}`} className="flex min-w-0 items-center gap-2">
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#072116] text-[11px] font-black text-[#ddb159]">{stock.rank ?? "—"}</div>
                      <StockLogo ticker={stock.ticker} company={stock.company} size={28} />
                      <div className="min-w-0">
                        <p className="text-[15px] font-black leading-tight">{stock.ticker ?? "—"}</p>
                        <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[#072116]/55">{stock.company ?? "—"}</p>
                      </div>
                    </Link>
                    <span className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black text-[#072116]">{formatScore(stock.score)}</span>
                  </div>

                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[#072116]/10 px-2 py-2"><p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">Rank move</p><span title={move.title} className={["mt-1 inline-flex h-6 min-w-[44px] items-center justify-center rounded-full border px-2 text-[10px] font-black tabular-nums", moveClassName(move.tone)].join(" ")}>{move.label}</span></div>
                    <div className="rounded-xl border border-[#072116]/10 px-2 py-2"><p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">1D price</p><DailyMovePill changePct={dailyMove} className="mt-1 h-6 min-w-[44px] px-2 text-[10px]" /></div>
                    <div className="rounded-xl border border-[#072116]/10 px-2 py-2"><p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">Price</p><p className="mt-1 text-[11px] font-black tabular-nums">{formatPrice(stock.price)}</p></div>
                    <div className="rounded-xl border border-[#072116]/10 px-2 py-2"><p className="text-[8px] font-black uppercase tracking-wide text-[#072116]/40">Confidence</p><span className={["mt-1 inline-flex rounded-full border px-2 py-1 text-[9px] font-black", lightConfidenceClassName(confidence.label)].join(" ")}>{confidence.label}</span></div>
                  </div>
                  <div className="mt-3"><StyleTags tags={tags} light /></div>
                  <WhyRankDetails stock={stock} move={move} dailyMove={dailyMove} light />
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl bg-[#faf6f0] px-4 py-10 text-center text-[13px] font-bold text-[#072116]/55">No stocks match those filters.</div>
          )}
        </RankingsLock>

        <RankingsLock isLocked={rankingsLocked} className="relative hidden min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,0.18)] lg:block">
          <div className="h-full">
            <div className={`grid ${gridCols} sticky top-0 z-10 bg-[#072116] text-[#faf6f0]`}>
              {['Rank','Move','Ticker','Company','Confidence','Style','Price','AI Score'].map((header) => (
                <div key={header} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide">{header}</div>
              ))}
            </div>

            <div className="overflow-y-auto" style={{ height: "calc(100% - 38px)" }}>
              {rankings.length > 0 ? (
                rankings.map((stock) => {
                  const ticker = stock.ticker ?? "";
                  const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));
                  const dailyMove = dailyMoveMap.get(ticker)?.changePct;
                  const confidence = getModelConfidence(stock);
                  const tags = getStyleTags(stock, dailyMove);

                  return (
                    <div key={stock.id} className="border-b border-[#072116]/8">
                      <div className={`grid ${gridCols} items-center text-[12px] text-[#072116] transition hover:bg-[#ddb159]/8`}>
                        <div className="px-4 py-2.5 font-bold text-[#072116]/70">{stock.rank ?? "—"}</div>
                        <div className="px-4 py-2.5"><span title={move.title} className={["inline-flex h-6 min-w-[46px] items-center justify-center rounded-full border px-2 text-[10px] font-black tabular-nums", moveClassName(move.tone)].join(" ")}>{move.label}</span></div>
                        <Link href={`/stock/${stock.ticker}`} className="flex items-center gap-2 px-4 py-2.5 font-black text-[#072116]"><StockLogo ticker={stock.ticker} company={stock.company} size={22} /><span>{stock.ticker ?? "—"}</span></Link>
                        <div className="flex min-w-0 items-center gap-2 px-4 py-2.5 font-semibold text-[#072116]"><span className="min-w-0 truncate">{stock.company ?? "—"}</span><DailyMovePill changePct={dailyMove} /></div>
                        <div className="px-4 py-2.5"><span className={["inline-flex rounded-full border px-2 py-1 text-[9px] font-black", lightConfidenceClassName(confidence.label)].join(" ")}>{confidence.label}</span></div>
                        <div className="px-4 py-2.5"><StyleTags tags={tags} light /></div>
                        <div className="px-4 py-2.5 font-semibold tabular-nums text-[#072116]">{formatPrice(stock.price)}</div>
                        <div className="px-4 py-2.5"><span className="inline-flex min-w-[68px] justify-center rounded-full bg-[#ddb159] px-2.5 py-0.5 text-[10px] font-black text-[#072116]">{formatScore(stock.score)}</span></div>
                      </div>
                      <WhyRankDetails stock={stock} move={move} dailyMove={dailyMove} />
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-10 text-center text-[13px] font-bold text-[#072116]/55">No stocks match those filters.</div>
              )}
            </div>
          </div>
        </RankingsLock>
      </main>
    </AppShell>
  );
}
