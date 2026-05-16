"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StockLogo } from "@/components/StockLogo";

type SearchResult = {
  ticker: string;
  company: string;
  sector?: string;
  rank?: number;
  score?: number;
};

type SearchBarProps = {
  showRankingData?: boolean;
};

const RECENT_KEY = "stockgpt:recent-searches";
const MAX_RECENT = 5;

function cleanResultForAccess(item: SearchResult, showRankingData: boolean) {
  if (showRankingData) return item;

  return {
    ticker: item.ticker,
    company: item.company,
    sector: item.sector,
  };
}

export function SearchBar({ showRankingData = false }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as SearchResult[];
        setRecents(
          parsed.map((item) => cleanResultForAccess(item, showRankingData)),
        );
      }
    } catch {}
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
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { cache: "no-store" },
        );

        const data: SearchResult[] = await res.json();

        setResults(
          data.map((item) => cleanResultForAccess(item, showRankingData)),
        );

        setActive(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [query, showRankingData]);

  const list = query.trim() ? results : recents;
  const showDropdown = open && (list.length > 0 || loading || query.trim());

  function persistRecent(item: SearchResult) {
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

  function navigate(item: SearchResult) {
    persistRecent(item);
    setOpen(false);
    setQuery("");
    router.push(`/stock/${item.ticker}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();

      if (active >= 0 && list[active]) {
        navigate(list[active]);
      } else if (query.trim()) {
        navigate({
          ticker: query.trim().toUpperCase(),
          company: query.trim().toUpperCase(),
        });
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} className="relative mx-auto w-full max-w-[520px]">
      <div className="flex h-10 items-center rounded-full border border-[#ddb159]/30 bg-[#072116] px-5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          type="text"
          placeholder="Search stocks..."
          className="h-full flex-1 bg-transparent text-sm text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/50"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            className="ml-2 grid size-6 place-items-center rounded-full text-[#faf6f0]/40 transition hover:text-[#faf6f0]/70"
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
          <kbd className="ml-2 hidden rounded border border-[#ddb159]/30 px-1.5 py-0.5 text-[10px] text-[#faf6f0]/40 sm:inline-block">
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
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#ddb159]/25 bg-[#04180f] shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
          {!query.trim() && recents.length > 0 && (
            <div className="px-4 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Recent
            </div>
          )}

          {loading && query.trim() && (
            <div className="px-4 py-4 text-xs font-semibold text-[#faf6f0]/50">
              Searching…
            </div>
          )}

          {!loading && list.length === 0 && query.trim() && (
            <div className="px-4 py-4 text-xs font-semibold text-[#faf6f0]/50">
              No matches found. Press Enter to look up &quot;
              {query.trim().toUpperCase()}&quot;.
            </div>
          )}

          {list.map((item, i) => (
            <button
              key={item.ticker}
              onMouseEnter={() => setActive(i)}
              onClick={() => navigate(item)}
              className={[
                "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                i === active ? "bg-[#ddb159]/10" : "",
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
          ))}
        </div>
      )}
    </div>
  );
}