"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/* ================================================================== */
/*  Command palette — ⌘K / Ctrl+K anywhere inside the app             */
/*                                                                     */
/*  Complements the "/" stock search: this is for movement. Jump to    */
/*  any page, fire common actions, or type a ticker to open its        */
/*  research page. Recent ticker jumps are remembered locally.         */
/* ================================================================== */

type Command = {
  id: string;
  label: string;
  hint?: string;
  section: "Navigate" | "Actions";
  href: string;
  keywords: string;
  icon: React.ReactNode;
};

const NAV_ICON = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  rankings: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  portfolio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l6.5 4" />
    </>
  ),
  watchlist: (
    <path d="M12 3.5 14.7 9l6 .8-4.4 4.2 1.1 6-5.4-2.9L6.6 20l1.1-6L3.3 9.8l6-.8L12 3.5Z" />
  ),
  alerts: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </>
  ),
  news: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z" />
      <path d="M9 11h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
    </>
  ),
  screener: (
    <>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </>
  ),
  reports: (
    <>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6M9 14h6M9 17h4" />
    </>
  ),
  ticker: (
    <>
      <path d="M3 17l5-5 4 3 6-7 3 3" />
      <path d="M3 21h18" />
    </>
  ),
} as const;

const COMMANDS: Command[] = [
  { id: "nav-dashboard", label: "Dashboard", section: "Navigate", href: "/dashboard", keywords: "home overview widgets", icon: NAV_ICON.dashboard },
  { id: "nav-rankings", label: "Rankings", section: "Navigate", href: "/rankings", keywords: "scores list top stocks ranked", icon: NAV_ICON.rankings },
  { id: "nav-portfolio", label: "Portfolio", section: "Navigate", href: "/portfolio", keywords: "holdings allocation builder positions", icon: NAV_ICON.portfolio },
  { id: "nav-watchlist", label: "Watchlist", section: "Navigate", href: "/watchlist", keywords: "saved starred follow", icon: NAV_ICON.watchlist },
  { id: "nav-alerts", label: "Alerts", section: "Navigate", href: "/notifications", keywords: "notifications warnings reviews", icon: NAV_ICON.alerts },
  { id: "nav-news", label: "World News", section: "Navigate", href: "/world-news", keywords: "headlines market impact", icon: NAV_ICON.news },
  { id: "nav-ask", label: "Ask StockGPT", section: "Navigate", href: "/ask-stockgpt", keywords: "ai chat coach question analyst", icon: NAV_ICON.chat },
  { id: "nav-screener", label: "Screener", section: "Navigate", href: "/screener", keywords: "filter factor search universe", icon: NAV_ICON.screener },
  { id: "nav-reports", label: "Reports", section: "Navigate", href: "/reports", keywords: "weekly summary digest", icon: NAV_ICON.reports },
  { id: "nav-settings", label: "Settings", section: "Navigate", href: "/settings", keywords: "account preferences profile", icon: NAV_ICON.settings },
  { id: "act-subscription", label: "Manage subscription", hint: "Billing, plan, cancel", section: "Actions", href: "/subscription", keywords: "billing plan upgrade cancel stripe payment", icon: NAV_ICON.card },
  { id: "act-ask", label: "Ask about my portfolio", hint: "Opens the AI analyst", section: "Actions", href: "/ask-stockgpt?contextType=portfolio", keywords: "ai analyse holdings advice question", icon: NAV_ICON.chat },
];

const RECENTS_KEY = "stockgpt.palette.recent-tickers";
const MAX_RECENTS = 5;

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(ticker: string) {
  try {
    const next = [ticker, ...readRecents().filter((t) => t !== ticker)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. — recents are a nicety, not a requirement */
  }
}

function looksLikeTicker(query: string) {
  return /^[A-Za-z][A-Za-z.]{0,5}$/.test(query.trim());
}

type Row =
  | { kind: "command"; command: Command }
  | { kind: "ticker"; ticker: string; recent?: boolean };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /* app-wide hotkey; state resets happen inside the keydown listener */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (openRef.current) {
          setOpen(false);
          return;
        }
        setQuery("");
        setIndex(0);
        setRecents(readRecents());
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Row[] = [];

    if (q && looksLikeTicker(q)) {
      out.push({ kind: "ticker", ticker: q.toUpperCase() });
    }

    const matches = COMMANDS.filter((command) => {
      if (!q) return true;
      return (
        command.label.toLowerCase().includes(q) ||
        command.keywords.includes(q) ||
        command.section.toLowerCase().startsWith(q)
      );
    });
    matches.forEach((command) => out.push({ kind: "command", command }));

    if (!q && recents.length > 0) {
      recents.forEach((ticker) => out.push({ kind: "ticker", ticker, recent: true }));
    }

    return out;
  }, [query, recents]);

  const run = useCallback(
    (row: Row) => {
      setOpen(false);
      if (row.kind === "ticker") {
        pushRecent(row.ticker);
        router.push(`/stock/${row.ticker}`);
        return;
      }
      router.push(row.command.href);
    },
    [router],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, rows.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter" && rows[index]) {
        event.preventDefault();
        run(rows[index]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows, index, run]);

  /* keep the active row on screen while arrowing */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-row-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  let renderedSection: string | null = null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483200] flex items-start justify-center bg-[#010504]/72 px-4 pt-[16vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[560px] overflow-hidden rounded-[22px] border border-[#ddb159]/25 bg-[#04140c]/97 shadow-[0_50px_140px_rgba(0,0,0,0.7),0_0_60px_rgba(221,177,89,0.08)]"
      >
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <svg
            viewBox="0 0 24 24"
            className="size-4 shrink-0 text-[#ddb159]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            placeholder="Jump to a page, or type a ticker…"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#faf6f0] outline-none placeholder:text-white/30"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/40">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto overscroll-contain p-2">
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] font-semibold text-white/40">
              Nothing matches — try a page name or a ticker like NVDA.
            </p>
          )}
          {rows.map((row, i) => {
            const section =
              row.kind === "ticker" ? (row.recent ? "Recent tickers" : "Research") : row.command.section;
            const showHeading = section !== renderedSection;
            renderedSection = section;
            const active = i === index;
            return (
              <div key={row.kind === "ticker" ? `t-${row.ticker}-${row.recent ? "r" : "q"}` : row.command.id}>
                {showHeading && (
                  <p className="px-3 pb-1 pt-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#ddb159]/70">
                    {section}
                  </p>
                )}
                <button
                  type="button"
                  data-row-index={i}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => run(row)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? "bg-[#ddb159]/12" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
                      active
                        ? "border-[#ddb159]/50 bg-[#ddb159]/10 text-[#ddb159]"
                        : "border-white/10 bg-white/[0.03] text-white/50"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {row.kind === "ticker" ? NAV_ICON.ticker : row.command.icon}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] font-black ${active ? "text-[#faf6f0]" : "text-[#faf6f0]/80"}`}>
                      {row.kind === "ticker" ? `Open ${row.ticker} research` : row.command.label}
                    </span>
                    {row.kind === "command" && row.command.hint && (
                      <span className="block truncate text-[10.5px] font-semibold text-white/38">
                        {row.command.hint}
                      </span>
                    )}
                  </span>
                  {active && (
                    <kbd className="shrink-0 rounded-md border border-[#ddb159]/30 bg-[#ddb159]/8 px-1.5 py-0.5 text-[9px] font-black text-[#ddb159]">
                      ↵
                    </kbd>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-white/8 px-5 py-2.5">
          <span className="text-[9.5px] font-bold text-white/32">
            <kbd className="font-black text-white/45">↑↓</kbd> navigate ·{" "}
            <kbd className="font-black text-white/45">↵</kbd> open
          </span>
          <span className="sl-mono text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159]/60">
            StockGPT
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
