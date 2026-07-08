"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AffectedStockInsight,
  EnrichedNewsArticle,
} from "@/lib/news-intelligence";
import {
  articleText,
  displaySummary,
  formatNewsDate,
  formatShortNewsDate,
  getNewsInsight,
  impactStyle,
  inferImpact,
} from "@/lib/news-intelligence";

export type WorldNewsArticle = EnrichedNewsArticle;

type Props = {
  articles: WorldNewsArticle[];
  fetchedAt: string;
  latestPublishedAt: string | null;
  sourceArticleCount: number;
  stockUniverseCount: number;
  locked?: boolean;
};

type EnrichedArticleView = WorldNewsArticle & {
  country: string;
  topic: string;
  category: string;
  industries: string[];
  highestImpactRating: number;
};

const CATEGORY_CHIPS = [
  "All",
  "Macro",
  "Stocks",
  "Tech / AI",
  "Energy",
  "Banks",
  "Semis",
] as const;

function inferCountry(article: WorldNewsArticle) {
  const text = articleText(article);

  if (/\b(us|u\.s\.|usa|america|american|washington|white house|fed|federal reserve)\b/i.test(text)) {
    return "United States";
  }

  if (/\b(uk|u\.k\.|britain|british|england|london|bank of england|boe)\b/i.test(text)) {
    return "United Kingdom";
  }

  if (/\b(china|chinese|beijing|hong kong|shanghai)\b/i.test(text)) return "China";
  if (/\b(europe|european|eurozone|ecb|germany|france|italy|spain)\b/i.test(text)) return "Europe";
  if (/\b(japan|japanese|tokyo)\b/i.test(text)) return "Japan";
  if (/\b(middle east|israel|iran|saudi|qatar|uae|dubai|opec)\b/i.test(text)) return "Middle East";

  return "Global";
}

function inferTopic(article: WorldNewsArticle) {
  const text = articleText(article);

  if (/\b(election|government|policy|tariff|regulation|sanction|war|conflict|president|prime minister|congress|senate|tax|budget|geopolitical|parliament|central bank|rates|fed|federal reserve|inflation|jobs report|cpi|gdp)\b/i.test(text)) {
    return "Politics / Macro";
  }

  if (article.affectedStocks.some((stock) => stock.impactRating >= 8)) return "Company-specific";
  if (article.affectedStocks.some((stock) => stock.impactRating >= 4)) return "Sector read-through";

  return "Market activity";
}

function inferCategory(article: WorldNewsArticle) {
  const text = articleText(article);
  const sectors = article.affectedStocks.map((stock) => stock.sector ?? "").join(" ");

  if (/\b(rate|inflation|fed|central bank|tariff|jobs|gdp|macro|oil|opec|geopolitical|war|policy)\b/i.test(text)) {
    return "Macro";
  }

  if (/\b(ai|artificial intelligence|cloud|software|semiconductor|chip|chips|nvidia|data center)\b/i.test(`${text} ${sectors}`)) {
    return "Tech / AI";
  }

  if (/\b(energy|oil|gas|opec|utilities|renewable)\b/i.test(`${text} ${sectors}`)) return "Energy";
  if (/\b(bank|banks|financial|credit|lending|fintech)\b/i.test(`${text} ${sectors}`)) return "Banks";
  if (/\b(semi|semiconductor|chip|chips|memory|foundry)\b/i.test(`${text} ${sectors}`)) return "Semis";

  return article.affectedStocks.length ? "Stocks" : "Macro";
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "time unavailable";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return "time unavailable";
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function SelectChevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-[#ddb159]/60"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const cls =
    direction === "Positive"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : direction === "Negative"
        ? "border-red-400/25 bg-red-400/10 text-red-300"
        : "border-[#faf6f0]/12 bg-[#faf6f0]/8 text-[#faf6f0]/58";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${cls}`}>
      {direction}
    </span>
  );
}

function BriefingStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "positive" | "negative" | "neutral" | "gold";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-red-300"
        : tone === "gold"
          ? "text-[#ddb159]"
          : "text-[#faf6f0]";

  return (
    <div className="min-w-0 rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/72 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/36">
        {label}
      </p>
      <p className={`mt-1 truncate text-[20px] font-black leading-none tracking-[-0.04em] ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function ImpactMeter({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative || 1;

  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-[#faf6f0]/8" aria-label="Market briefing impact mix">
      <div className="bg-emerald-400" style={{ width: `${(positive / total) * 100}%` }} />
      <div className="bg-[#faf6f0]/32" style={{ width: `${(neutral / total) * 100}%` }} />
      <div className="bg-red-400" style={{ width: `${(negative / total) * 100}%` }} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative h-11 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] px-3 transition focus-within:border-[#ddb159]/50">
      <span className="absolute left-3 top-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]/78">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full w-full appearance-none bg-transparent pb-1 pt-4 text-[12px] font-black text-[#faf6f0] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#061b12] text-[#faf6f0]">
            {option}
          </option>
        ))}
      </select>
      <SelectChevron />
    </label>
  );
}

function ArticleCard({
  article,
  onOpen,
  featured = false,
}: {
  article: EnrichedArticleView;
  onOpen: (article: EnrichedArticleView) => void;
  featured?: boolean;
}) {
  const style = impactStyle(article.impact);
  const topStock = article.affectedStocks[0];

  return (
    <button
      type="button"
      onClick={() => onOpen(article)}
      className={[
        "group grid w-full min-w-0 gap-3 rounded-[24px] border border-[#ddb159]/14 bg-[#071f15]/82 p-3 text-left shadow-[0_16px_34px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-[#ddb159]/42 hover:bg-[#0b2b1d]",
        featured ? "sm:grid-cols-[150px_minmax(0,1fr)] sm:p-4" : "sm:grid-cols-[116px_minmax(0,1fr)]",
      ].join(" ")}
    >
      <div className={[featured ? "h-36 sm:h-full" : "hidden h-24 sm:block", "overflow-hidden rounded-2xl bg-[#0b2b1d]"].join(" ")}>
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(221,177,89,0.18),transparent_36%),linear-gradient(135deg,#061b12,#0b2b1d)]">
            <span className="text-[8px] font-black uppercase tracking-[0.18em] text-[#ddb159]/55">
              Brief
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
            {article.source ?? "Market source"}
          </span>
          <span className="text-[10px] font-semibold text-[#faf6f0]/34">
            {formatShortNewsDate(article.published_at)}
          </span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${style.bg} ${style.text} ${style.border}`}>
            {style.label}
          </span>
          {topStock ? (
            <span className="rounded-full border border-[#ddb159]/24 bg-[#ddb159]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#ddb159]">
              {topStock.ticker} · {topStock.impactRating}/10
            </span>
          ) : null}
        </div>

        <h3 className={[featured ? "text-[20px] sm:text-[23px]" : "text-[15px]", "mt-2 font-black leading-tight tracking-[-0.035em] text-[#faf6f0] group-hover:text-[#ddb159]"].join(" ")}>
          {article.title ?? "Untitled article"}
        </h3>

        <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">
          {displaySummary(article)}
        </p>

        <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-5 text-[#ddb159]/72">
          {getNewsInsight(article)}
        </p>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
          {article.affectedStocks.slice(0, 4).map((stock) => (
            <span
              key={stock.ticker}
              className="rounded-full bg-[#faf6f0]/8 px-2 py-1 text-[9px] font-black text-[#faf6f0]/72"
            >
              {stock.ticker}
            </span>
          ))}
          <span className="ml-auto hidden text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/58 sm:inline">
            Open brief
          </span>
        </div>
      </div>
    </button>
  );
}

function AffectedStockRow({ stock }: { stock: AffectedStockInsight }) {
  return (
    <Link
      href={`/stock/${stock.ticker}`}
      prefetch={false}
      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#ddb159]/12 bg-[#071f15] px-3 py-2 transition hover:border-[#ddb159]/42 hover:bg-[#0b2b1d]"
    >
      <div className="min-w-0">
        <p className="truncate text-[12px] font-black text-[#ddb159]">{stock.ticker}</p>
        <p className="truncate text-[10px] font-semibold text-[#faf6f0]/48">
          {stock.company ?? stock.sector ?? "Stock context"}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#ddb159] px-2 py-1 text-[9px] font-black text-[#061b12]">
        {stock.impactRating}/10
      </span>
    </Link>
  );
}

function LockedBriefing() {
  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto pb-8">
      <section className="rounded-[28px] border border-[#ddb159]/22 bg-[#061b12]/86 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.26)]">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
          StockGPT Market Briefing
        </p>
        <h1 className="mt-2 text-[30px] font-black leading-none tracking-[-0.05em] text-[#faf6f0]">
          Market news is a subscriber research layer.
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] font-semibold leading-6 text-[#faf6f0]/58">
          Sign in with an active plan to see AI-linked market stories, affected stocks, and plain-English impact context.
        </p>
        <Link
          href="/subscription"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.12em] text-[#061b12]"
        >
          Manage subscription
        </Link>
      </section>
    </main>
  );
}

function EmptyBriefing({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-[24px] border border-[#ddb159]/18 bg-[#061b12]/76 px-5 py-12 text-center shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
        No matching briefings
      </p>
      <p className="mx-auto mt-2 max-w-md text-[13px] font-semibold leading-6 text-[#faf6f0]/56">
        No articles match the current search and filter combination. Reset filters or check back after the next news refresh.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 h-10 rounded-full border border-[#ddb159]/30 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10"
      >
        Reset filters
      </button>
    </div>
  );
}

export function WorldNewsClient({
  articles,
  fetchedAt,
  latestPublishedAt,
  sourceArticleCount,
  stockUniverseCount,
  locked = false,
}: Props) {
  const [selectedArticle, setSelectedArticle] = useState<EnrichedArticleView | null>(null);
  const [search, setSearch] = useState("");
  const [impactFilter, setImpactFilter] = useState("All impacts");
  const [industryFilter, setIndustryFilter] = useState("All industries");
  const [countryFilter, setCountryFilter] = useState("All countries");
  const [topicFilter, setTopicFilter] = useState("All topics");
  const [category, setCategory] = useState<(typeof CATEGORY_CHIPS)[number]>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const enrichedArticles = useMemo<EnrichedArticleView[]>(
    () =>
      articles.map((article) => ({
        ...article,
        country: inferCountry(article),
        topic: inferTopic(article),
        category: inferCategory(article),
        industries: Array.from(
          new Set(
            article.affectedStocks
              .map((stock) => stock.sector)
              .filter((sector): sector is string => Boolean(sector)),
          ),
        ),
        highestImpactRating: Math.max(
          ...article.affectedStocks.map((stock) => stock.impactRating),
          1,
        ),
      })),
    [articles],
  );

  const counts = useMemo(
    () =>
      enrichedArticles.reduce(
        (acc, article) => {
          const impact = inferImpact(article);
          if (impact === "positive") acc.positive += 1;
          else if (impact === "negative") acc.negative += 1;
          else acc.neutral += 1;
          return acc;
        },
        { positive: 0, negative: 0, neutral: 0 },
      ),
    [enrichedArticles],
  );

  const filterOptions = useMemo(() => {
    const industries = Array.from(new Set(enrichedArticles.flatMap((article) => article.industries))).sort();
    const countries = Array.from(new Set(enrichedArticles.map((article) => article.country))).sort();
    const topics = Array.from(new Set(enrichedArticles.map((article) => article.topic))).sort();

    return {
      industries: ["All industries", ...industries],
      countries: ["All countries", ...countries],
      topics: ["All topics", ...topics],
    };
  }, [enrichedArticles]);

  const filteredArticles = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return enrichedArticles.filter((article) => {
      const text = [
        articleText(article),
        article.category,
        article.country,
        article.topic,
        article.affectedStocks
          .map((stock) => `${stock.ticker} ${stock.company} ${stock.sector} ${stock.customerSummary} ${stock.matchReason}`)
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !cleanSearch || text.includes(cleanSearch);
      const matchesCategory = category === "All" || article.category === category;
      const matchesImpact = impactFilter === "All impacts" || inferImpact(article) === impactFilter.toLowerCase();
      const matchesIndustry = industryFilter === "All industries" || article.industries.includes(industryFilter);
      const matchesCountry = countryFilter === "All countries" || article.country === countryFilter;
      const matchesTopic = topicFilter === "All topics" || article.topic === topicFilter;

      return matchesSearch && matchesCategory && matchesImpact && matchesIndustry && matchesCountry && matchesTopic;
    });
  }, [category, countryFilter, enrichedArticles, impactFilter, industryFilter, search, topicFilter]);

  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const topStory = filteredArticles[0] ?? enrichedArticles[0] ?? null;
  const topAffectedStocks = useMemo(() => {
    const map = new Map<string, AffectedStockInsight & { appearances: number; totalImpact: number }>();

    for (const article of enrichedArticles) {
      for (const stock of article.affectedStocks.slice(0, 5)) {
        const existing = map.get(stock.ticker);
        if (existing) {
          existing.appearances += 1;
          existing.totalImpact += stock.impactRating;
        } else {
          map.set(stock.ticker, { ...stock, appearances: 1, totalImpact: stock.impactRating });
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalImpact - a.totalImpact)
      .slice(0, 6);
  }, [enrichedArticles]);

  const biggestPositive = enrichedArticles.find((article) => inferImpact(article) === "positive");
  const biggestNegative = enrichedArticles.find((article) => inferImpact(article) === "negative");

  function resetFilters() {
    setSearch("");
    setImpactFilter("All impacts");
    setIndustryFilter("All industries");
    setCountryFilter("All countries");
    setTopicFilter("All topics");
    setCategory("All");
    setVisibleCount(20);
  }

  if (locked) return <LockedBriefing />;

  const FilterControls = (
    <div className="grid gap-2 lg:grid-cols-4">
      <SelectField
        label="Impact"
        value={impactFilter}
        options={["All impacts", "Positive", "Neutral", "Negative"]}
        onChange={(value) => {
          setImpactFilter(value);
          setVisibleCount(20);
        }}
      />
      <SelectField
        label="Industry"
        value={industryFilter}
        options={filterOptions.industries}
        onChange={(value) => {
          setIndustryFilter(value);
          setVisibleCount(20);
        }}
      />
      <SelectField
        label="Country"
        value={countryFilter}
        options={filterOptions.countries}
        onChange={(value) => {
          setCountryFilter(value);
          setVisibleCount(20);
        }}
      />
      <SelectField
        label="Topic"
        value={topicFilter}
        options={filterOptions.topics}
        onChange={(value) => {
          setTopicFilter(value);
          setVisibleCount(20);
        }}
      />
    </div>
  );

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid min-w-0 gap-4 pb-8">
          <section className="rounded-[28px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,#061b12,#0b2b1d_58%,#061b12)] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.24)] sm:p-5">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                  StockGPT Market Briefing
                </p>
                <h1 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[#faf6f0] sm:text-[40px]">
                  World News
                </h1>
                <p className="mt-2 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/55">
                  AI-linked market stories, affected stocks, and plain-English context. Educational research only, not financial advice.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 lg:w-[430px]">
                <BriefingStat label="Updated" value={relativeTime(fetchedAt)} tone="gold" />
                <BriefingStat label="Articles" value={filteredArticles.length} />
                <BriefingStat label="Stocks" value={stockUniverseCount || "-"} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_320px]">
              <div className="rounded-[24px] border border-[#ddb159]/14 bg-[#04180f]/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Today&apos;s tone
                  </p>
                  <p className="text-[10px] font-bold text-[#faf6f0]/42">
                    Latest source: {relativeTime(latestPublishedAt)}
                  </p>
                </div>
                <ImpactMeter positive={counts.positive} neutral={counts.neutral} negative={counts.negative} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <BriefingStat label="Positive" value={counts.positive} tone="positive" />
                  <BriefingStat label="Neutral" value={counts.neutral} />
                  <BriefingStat label="Negative" value={counts.negative} tone="negative" />
                </div>
              </div>

              <div className="rounded-[24px] border border-[#ddb159]/14 bg-[#04180f]/60 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Feed scope
                </p>
                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">
                  Showing the most relevant cached briefings from {sourceArticleCount} recent source articles. Refreshes every few minutes.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid min-w-0 gap-3">
              {topStory ? <ArticleCard article={topStory} onOpen={setSelectedArticle} featured /> : null}

              <div className="sticky top-0 z-10 rounded-[24px] border border-[#ddb159]/16 bg-[#061b12]/92 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] px-3 transition focus-within:border-[#ddb159]/50">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ddb159]/12 text-[#ddb159]">
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m16.5 16.5 4 4" />
                      </svg>
                    </span>
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setVisibleCount(20);
                      }}
                      placeholder="Search ticker, company, source, theme..."
                      className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/32"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="h-11 rounded-2xl border border-[#ddb159]/22 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10 lg:hidden"
                  >
                    Filters
                  </button>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-11 rounded-2xl bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#061b12] transition hover:brightness-110"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {CATEGORY_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setCategory(chip);
                        setVisibleCount(20);
                      }}
                      data-active={category === chip ? "true" : "false"}
                      className="shrink-0 rounded-full border border-[#ddb159]/16 px-3 py-2 text-[11px] font-black text-[#faf6f0]/62 transition hover:border-[#ddb159]/45 hover:text-[#faf6f0] data-[active=true]:border-[#ddb159] data-[active=true]:bg-[#ddb159] data-[active=true]:text-[#061b12]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="mt-3 hidden lg:block">{FilterControls}</div>
              </div>

              <div className="grid gap-3">
                {visibleArticles.length > 0 ? (
                  visibleArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} onOpen={setSelectedArticle} />
                  ))
                ) : (
                  <EmptyBriefing onReset={resetFilters} />
                )}
              </div>

              {visibleArticles.length < filteredArticles.length ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 16)}
                  className="h-12 rounded-2xl border border-[#ddb159]/22 bg-[#061b12]/80 text-[12px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                >
                  Load more briefings
                </button>
              ) : null}
            </div>

            <aside className="hidden min-w-0 gap-3 lg:grid">
              <section className="rounded-[24px] border border-[#ddb159]/16 bg-[#061b12]/78 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Top affected stocks
                </p>
                <div className="mt-3 grid gap-2">
                  {topAffectedStocks.length ? (
                    topAffectedStocks.map((stock) => <AffectedStockRow key={stock.ticker} stock={stock} />)
                  ) : (
                    <p className="text-[12px] font-semibold leading-5 text-[#faf6f0]/46">
                      No high-confidence stock links are available yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#ddb159]/16 bg-[#061b12]/78 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Biggest moves in the briefing
                </p>
                <div className="mt-3 grid gap-2">
                  {biggestPositive ? (
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(biggestPositive)}
                      className="rounded-2xl border border-emerald-400/18 bg-emerald-400/8 p-3 text-left transition hover:border-emerald-300/35"
                    >
                      <DirectionBadge direction="Positive" />
                      <p className="mt-2 line-clamp-2 text-[12px] font-black leading-5 text-[#faf6f0]">
                        {biggestPositive.title}
                      </p>
                    </button>
                  ) : null}
                  {biggestNegative ? (
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(biggestNegative)}
                      className="rounded-2xl border border-red-400/18 bg-red-400/8 p-3 text-left transition hover:border-red-300/35"
                    >
                      <DirectionBadge direction="Negative" />
                      <p className="mt-2 line-clamp-2 text-[12px] font-black leading-5 text-[#faf6f0]">
                        {biggestNegative.title}
                      </p>
                    </button>
                  ) : null}
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[2147483646] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-black/62 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[28px] border border-[#ddb159]/22 bg-[#061b12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(0,0,0,0.48)]">
            <div className="mx-auto h-1 w-12 rounded-full bg-[#faf6f0]/18" />
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Advanced filters
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/48">
                  Refine the briefing without cluttering the feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/22 text-[18px] font-black text-[#ddb159]"
                aria-label="Close filters"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-2 overflow-y-auto">{FilterControls}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="h-11 rounded-2xl border border-[#ddb159]/22 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="h-11 rounded-2xl bg-[#ddb159] text-[11px] font-black uppercase tracking-[0.12em] text-[#061b12]"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedArticle ? (
        <div className="fixed inset-0 z-[2147483645]">
          <button
            type="button"
            aria-label="Close article briefing"
            className="absolute inset-0 bg-black/62 backdrop-blur-md"
            onClick={() => setSelectedArticle(null)}
          />
          <div className="absolute inset-x-2 bottom-[calc(88px+env(safe-area-inset-bottom))] top-4 mx-auto flex max-w-[1120px] overflow-hidden rounded-[28px] border border-[#ddb159]/28 bg-[#061b12] shadow-[0_30px_100px_rgba(0,0,0,0.72)] sm:inset-x-5 sm:bottom-5 lg:grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="hidden min-h-0 overflow-hidden bg-[#0b2b1d] lg:block">
              {selectedArticle.image_url ? (
                <img src={selectedArticle.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_40%_22%,rgba(221,177,89,0.18),transparent_36%),linear-gradient(135deg,#061b12,#0b2b1d)]">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]/58">
                    StockGPT Briefing
                  </span>
                </div>
              )}
            </div>

            <article className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-[#ddb159]/14 p-4 pr-16 sm:p-5 sm:pr-20">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-[#ddb159]/22 bg-[#061b12]/90 text-[18px] font-black text-[#ddb159]"
                  aria-label="Close article briefing"
                >
                  ×
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <DirectionBadge direction={selectedArticle.affectedStocks[0]?.impactDirection ?? "Neutral"} />
                  <span className="text-[10px] font-bold text-[#faf6f0]/42">
                    {selectedArticle.source ?? "Market source"} · {formatNewsDate(selectedArticle.published_at)}
                  </span>
                </div>
                <h2 className="mt-3 text-[22px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0] sm:text-[31px]">
                  {selectedArticle.title ?? "Untitled article"}
                </h2>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-4">
                  <section className="rounded-[22px] border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                      What happened
                    </p>
                    <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/70">
                      {displaySummary(selectedArticle)}
                    </p>
                  </section>

                  <section className="rounded-[22px] border border-[#ddb159]/16 bg-[#ddb159]/[0.07] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                      Why it matters
                    </p>
                    <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/72">
                      {getNewsInsight(selectedArticle)}
                    </p>
                  </section>

                  <section>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                        Affected stocks
                      </p>
                      <p className="text-[10px] font-bold text-[#faf6f0]/34">
                        Educational context only
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedArticle.affectedStocks.length ? (
                        selectedArticle.affectedStocks.map((stock) => <AffectedStockRow key={stock.ticker} stock={stock} />)
                      ) : (
                        <div className="rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.03] p-3 text-[12px] font-semibold text-[#faf6f0]/50 sm:col-span-2">
                          No specific stock link is strong enough to show.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <div className="shrink-0 border-t border-[#ddb159]/14 p-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <p className="text-[10px] font-semibold leading-5 text-[#faf6f0]/38">
                    StockGPT Market Briefing summarises public market news for research support. It is not a buy, sell, or hold recommendation.
                  </p>
                  {selectedArticle.url ? (
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#061b12]"
                    >
                      Read source
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </main>
  );
}
