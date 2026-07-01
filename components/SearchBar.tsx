"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StockLogo } from "@/components/StockLogo";
import { StockIcon, type StockIconName } from "@/components/StockIcon";

type StockSearchResult = {
  ticker: string;
  company: string;
  sector?: string;
  rank?: number;
  score?: number;
};

type FeatureSearchResult = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string[];
  icon: StockIconName;
};

type SearchItem =
  | { type: "stock"; item: StockSearchResult }
  | { type: "feature"; item: FeatureSearchResult };

type SearchBarProps = {
  showRankingData?: boolean;
};

const RECENT_KEY = "stockgpt:recent-searches";
const SEARCH_CACHE_KEY = "stockgpt:search-cache";
const MAX_RECENT = 5;
const MAX_CACHE_ITEMS = 50;

const FEATURE_RESULTS: FeatureSearchResult[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Market overview, top ranked stocks, movers and alerts.",
    href: "/dashboard",
    icon: "dashboard",
    keywords: ["dashboard", "home", "overview", "market", "summary"],
  },
  {
    id: "rankings",
    label: "Rankings",
    description: "Full ranked stock table and model scores.",
    href: "/rankings",
    icon: "rankings",
    keywords: ["rankings", "ranking", "stocks", "table", "score", "scores"],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Build, import and review your holdings.",
    href: "/portfolio",
    icon: "portfolio",
    keywords: ["portfolio", "holdings", "positions", "import", "csv", "trading 212"],
  },
  {
    id: "watchlist",
    label: "Watchlist",
    description: "Track stocks you want to monitor.",
    href: "/watchlist",
    icon: "watchlist",
    keywords: ["watchlist", "watch", "saved", "track", "tracking"],
  },
  {
    id: "ask",
    label: "Ask StockGPT",
    description: "Open the research assistant for stock and market questions.",
    href: "/ask",
    icon: "ask",
    keywords: ["ask", "chat", "assistant", "stockgpt", "research assistant"],
  },
  {
    id: "alerts",
    label: "Alerts",
    description: "View portfolio, ranking and market alerts.",
    href: "/notifications",
    icon: "alerts",
    keywords: ["alerts", "notifications", "notification", "changes"],
  },
  {
    id: "world-news",
    label: "World News",
    description: "Market news connected to stocks, sectors and events.",
    href: "/world-news",
    icon: "news",
    keywords: ["news", "world news", "headlines", "market news", "events"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Account, theme, digest and security preferences.",
    href: "/settings",
    icon: "settings",
    keywords: ["settings", "account", "theme", "light mode", "dark mode", "preferences"],
  },
  {
    id: "subscription",
    label: "Subscription",
    description: "Billing, plan and Core access details.",
    href: "/subscription",
    icon: "portfolio",
    keywords: ["subscription", "billing", "plan", "core", "payment", "stripe"],
  },
];

const memorySearchCache = new Map<string, StockSearchResult[]>();

function cleanResultForAccess(
  item: StockSearchResult,
  showRankingData: boolean,
): StockSearchResult {
  if (showRankingData) return item;

  return {
    ticker: item.ticker,
    company: item.company,
    sector: item.sector,
  };
}

function normalise(value: string) {
  return value.toLowerCase().trim();
}

function getSearchCacheKey(query: string, showRankingData: boolean) {
  return `${showRankingData ? "auth" : "public"}:${normalise(query)}`;
}

function readSessionSearchCache(key: string) {
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, StockSearchResult[]>;
    return parsed[key] ?? null;
  } catch {
    return null;
  }
}

function writeSessionSearchCache(key: string, value: StockSearchResult[]) {
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StockSearchResult[]>) : {};

    parsed[key] = value;

    const entries = Object.entries(parsed).slice(-MAX_CACHE_ITEMS);
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function getFeatureMatches(query: string) {
  const q = normalise(query);

  if (!q) {
    return FEATURE_RESULTS.filter((item) =>
      ["dashboard", "rankings", "portfolio", "world-news", "settings"].includes(item.id),
    );
  }

  return FEATURE_RESULTS.filter((feature) => {
    const haystack = [
      feature.label,
      feature.description,
      feature.href,
      ...feature.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  }).slice(0, 6);
}

export function SearchBar({ showRankingData = false }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [recents, setRecents] = useState<StockSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(RECENT_KEY);

        if (raw) {
          const parsed = JSON.parse(raw) as StockSearchResult[];
          setRecents(
            parsed.map((item) => cleanResultForAccess(item, showRankingData)),
          );
        }
      } catch {}
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [showRankingData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;

      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      const timeout = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
        setActive(-1);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const cacheKey = getSearchCacheKey(trimmed, showRankingData);
    const memoryHit = memorySearchCache.get(cacheKey);
    const sessionHit = readSessionSearchCache(cacheKey);

    if (memoryHit) {
      const timeout = window.setTimeout(() => {
        setResults(memoryHit);
        setLoading(false);
        setActive(-1);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    if (sessionHit) {
      memorySearchCache.set(cacheKey, sessionHit);
      const timeout = window.setTimeout(() => {
        setResults(sessionHit);
        setLoading(false);
        setActive(-1);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });

        const data: StockSearchResult[] = await res.json();

        const cleaned = data.map((item) =>
          cleanResultForAccess(item, showRankingData),
        );

        memorySearchCache.set(cacheKey, cleaned);
        writeSessionSearchCache(cacheKey, cleaned);

        setResults(cleaned);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 120);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, showRankingData]);

  const trimmedQuery = query.trim();
  const stockList = trimmedQuery ? results : recents;
  const featureList = useMemo(() => getFeatureMatches(query), [query]);

  const activeItems: SearchItem[] = [
    ...stockList.map((item): SearchItem => ({ type: "stock", item })),
    ...featureList.map((item): SearchItem => ({ type: "feature", item })),
  ];

  const showDropdown =
    open &&
    (stockList.length > 0 || featureList.length > 0 || loading || Boolean(trimmedQuery));

  function persistRecent(item: StockSearchResult) {
    const cleanedItem = cleanResultForAccess(item, showRankingData);

    const next = [
      cleanedItem,
      ...recents.filter((r) => r.ticker !== cleanedItem.ticker),
    ].slice(0, MAX_RECENT);

    setRecents(next);

    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }

  function navigateToStock(item: StockSearchResult) {
    persistRecent(item);
    setOpen(false);
    setQuery("");
    router.push(`/stock/${item.ticker}`);
  }

  function navigateToFeature(item: FeatureSearchResult) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  function navigateItem(item: SearchItem) {
    if (item.type === "stock") {
      navigateToStock(item.item);
      return;
    }

    navigateToFeature(item.item);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, activeItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();

      if (active >= 0 && activeItems[active]) {
        navigateItem(activeItems[active]);
      } else if (stockList[0]) {
        navigateToStock(stockList[0]);
      } else if (featureList[0]) {
        navigateToFeature(featureList[0]);
      } else if (trimmedQuery) {
        navigateToStock({
          ticker: trimmedQuery.toUpperCase(),
          company: trimmedQuery.toUpperCase(),
        });
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} className="sg-search-root relative mx-auto w-full max-w-[560px]">
      <div className="sg-search-shell flex h-10 items-center rounded-full border border-[#ddb159]/30 bg-[#072116] px-5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setOpen(true);
            setLoading(Boolean(value.trim()));
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          type="text"
          placeholder="Search stocks or features..."
          className="sg-search-input h-full flex-1 bg-transparent text-sm text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/50"
        />

        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setResults([]);
              setLoading(false);
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="sg-search-clear ml-2 grid size-6 place-items-center rounded-full text-[#faf6f0]/40 transition hover:text-[#faf6f0]/70"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <kbd className="sg-search-kbd ml-2 hidden rounded border border-[#ddb159]/30 px-1.5 py-0.5 text-[10px] text-[#faf6f0]/40 sm:inline-block">
            /
          </kbd>
        )}

        <div className="ml-2 grid size-8 place-items-center rounded-full text-[#ddb159]">
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
      </div>

      {showDropdown && (
        <div className="sg-search-dropdown absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#ddb159]/25 bg-[#04180f] shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
          {!trimmedQuery && stockList.length > 0 && (
            <div className="px-4 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Recent tickers
            </div>
          )}

          {trimmedQuery && (
            <div className="px-4 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Stocks
            </div>
          )}

          {loading && trimmedQuery && (
            <div className="space-y-2 px-4 py-3">
              <div className="h-9 animate-pulse rounded-xl bg-[#faf6f0]/8" />
              <div className="h-9 animate-pulse rounded-xl bg-[#faf6f0]/8" />
            </div>
          )}

          {!loading && stockList.length === 0 && trimmedQuery && (
            <div className="px-4 py-3 text-xs font-semibold text-[#faf6f0]/50">
              No ticker matches for &quot;{trimmedQuery}&quot;.
            </div>
          )}

          {!loading &&
            stockList.map((item, index) => {
              return (
                <button
                  key={`stock-${item.ticker}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => navigateToStock(item)}
                  className={[
                    "sg-search-row flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                    index === active ? "bg-[#ddb159]/10" : "",
                  ].join(" ")}
                >
                  <span className="flex h-8 w-16 shrink-0 items-center gap-2 rounded-lg bg-[#072116] px-2">
                    <StockLogo ticker={item.ticker} company={item.company} size={20} />
                    <span className="text-xs font-black text-[#ddb159]">
                      {item.ticker}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#faf6f0]">
                      {item.company}
                    </p>

                    {item.sector && (
                      <p className="truncate text-[10px] font-semibold text-[#faf6f0]/45">
                        {item.sector}
                      </p>
                    )}
                  </div>

                  {showRankingData && item.score != null && (
                    <span className="shrink-0 rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116]">
                      {Number(item.score).toLocaleString()}
                    </span>
                  )}

                  {showRankingData && item.rank != null && (
                    <span className="shrink-0 text-[10px] font-bold text-[#faf6f0]/35">
                      #{item.rank}
                    </span>
                  )}
                </button>
              );
            })}

          {featureList.length > 0 && (
            <div className="border-t border-[#ddb159]/15 px-4 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Features
            </div>
          )}

          {featureList.map((item, featureIndex) => {
            const index = stockList.length + featureIndex;
            return (
              <button
                key={`feature-${item.id}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => navigateToFeature(item)}
                className={[
                  "sg-search-row flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                  index === active ? "bg-[#ddb159]/10" : "",
                ].join(" ")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#ddb159]/25 bg-[#072116] text-base text-[#ddb159]">
                  <StockIcon name={item.icon} className="size-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#faf6f0]">
                    {item.label}
                  </p>
                  <p className="truncate text-[10px] font-semibold text-[#faf6f0]/45">
                    {item.description}
                  </p>
                </div>

                <span className="shrink-0 text-[11px] font-black text-[#ddb159]">
                  →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
