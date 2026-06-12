"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Mode = "portfolio" | "rankings" | "learn" | "account";

type StarterPrompt = {
  label: string;
  prompt: string;
  eyebrow: string;
  mode: Mode;
};

type HoldingOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | null;
  shares: number;
  currentValue: number;
};

type RankingResult = {
  rank: number | null;
  previous_rank: number | null;
  ticker: string;
  company: string | null;
  sector: string | null;
  score: number | null;
  price: number | null;
  updated_at: string | null;
  confidence: "High" | "Medium" | "Developing";
  rank_move: number | null;
};

type RankingsResponse = {
  rankings?: RankingResult[];
  has_more?: boolean;
  next_offset?: number;
  data_as_of?: string;
  error?: string;
};

type AskStockGPTWorkspaceProps = {
  canUseAskStockGPT: boolean;
  isAuthenticated: boolean;
};

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content:
    "I’m your StockGPT coach. Ask me about your portfolio, rankings, alerts, market news, stop-losses, take-profit levels, trading concepts, membership questions, or anything you want explained clearly.",
};

const modeOptions: Array<{ mode: Mode; label: string; shortLabel: string; description: string }> = [
  { mode: "portfolio", label: "Portfolio", shortLabel: "Portfolio", description: "Holdings, alerts, P&L" },
  { mode: "rankings", label: "Rankings", shortLabel: "Rankings", description: "Scores, sectors, leaders" },
  { mode: "learn", label: "Learn", shortLabel: "Learn", description: "Trading concepts" },
  { mode: "account", label: "Account", shortLabel: "Account", description: "Membership and billing" },
];

const starterPrompts: StarterPrompt[] = [
  { eyebrow: "Portfolio coach", label: "Find weakest holding", prompt: "What is my weakest holding and what should I do about it?", mode: "portfolio" },
  { eyebrow: "Action plan", label: "Trim, hold, sell, or buy more", prompt: "Which stocks in my portfolio should I trim, hold, sell, or buy more?", mode: "portfolio" },
  { eyebrow: "Risk control", label: "Stop-loss and take-profit", prompt: "What are the key stop-loss and take-profit levels in my portfolio?", mode: "portfolio" },
  { eyebrow: "Rankings", label: "Strongest stocks today", prompt: "Which stocks are ranking strongest right now and why?", mode: "rankings" },
  { eyebrow: "Rankings", label: "Compare my holdings", prompt: "How do my current holdings compare to the top-ranked stocks?", mode: "rankings" },
  { eyebrow: "Learning", label: "Risk/reward and sizing", prompt: "Explain risk/reward and position sizing like a market coach.", mode: "learn" },
  { eyebrow: "Learning", label: "Stop-loss theory", prompt: "Explain how stop-losses should be used without getting shaken out too early.", mode: "learn" },
  { eyebrow: "Account", label: "Membership and billing", prompt: "How do I manage my StockGPT membership or billing?", mode: "account" },
  { eyebrow: "Account", label: "Subscription help", prompt: "Who should I contact if I have a StockGPT subscription or payment issue?", mode: "account" },
];

function money(value: number | null | undefined) {
  const n = Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isFinite(n) && n >= 1000 ? 0 : 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatNumber(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${part}-${index}`} className="font-black">{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderMessageContent(content: string) {
  const lines = content.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`bullets-${blocks.length}`} className="mt-2 grid gap-1.5 pl-4">
        {bullets.map((item, index) => (
          <li key={`${item}-${index}`} className="list-disc text-[13px] leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      return;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      bullets.push(trimmed.replace(/^[-•]\s+/, ""));
      return;
    }
    flushBullets();
    if (trimmed.startsWith("### ")) {
      blocks.push(<p key={`heading-${index}`} className="mt-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#ddb159]">{trimmed.replace(/^###\s+/, "")}</p>);
      return;
    }
    blocks.push(<p key={`paragraph-${index}`} className="mt-2 text-[13px] leading-relaxed">{renderInlineMarkdown(trimmed)}</p>);
  });

  flushBullets();
  return <>{blocks}</>;
}

function PremiumOrb({ small = false }: { small?: boolean }) {
  return (
    <span className={["relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#ddb159]/40 bg-[#092418] shadow-[0_10px_35px_rgba(221,177,89,0.18)]", small ? "size-8" : "size-10"].join(" ")}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),transparent_24%),radial-gradient(circle_at_70%_80%,rgba(221,177,89,0.22),transparent_42%)]" />
      <span className={["relative font-black text-[#ddb159]", small ? "text-[13px]" : "text-[16px]"].join(" ")}>S</span>
    </span>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/portfolio");
      }}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/24 bg-[#fbf4e5]/[0.04] text-[18px] font-black leading-none text-[#ddb159] transition hover:bg-[#ddb159]/10 sm:w-auto sm:gap-2 sm:px-4 sm:text-[12px] sm:uppercase sm:tracking-[0.14em]"
    >
      <span aria-hidden="true">←</span>
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={["flex w-full min-w-0", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div className={[
        "min-w-0 max-w-[92%] overflow-hidden break-words rounded-[22px] px-3.5 py-3 text-[13px] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[82%] md:max-w-[78%] [overflow-wrap:anywhere]",
        isUser ? "rounded-br-md bg-[#ddb159] text-[#07170f]" : "rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] text-[#07170f]",
      ].join(" ")}>
        {!isUser && (
          <div className="mb-1.5 flex min-w-0 items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#07170f] text-[9px] font-black text-[#ddb159]">S</span>
            <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#07170f]/45">StockGPT Coach</span>
          </div>
        )}
        <div className="min-w-0 [&>p:first-child]:mt-0">{renderMessageContent(message.content)}</div>
      </div>
    </div>
  );
}

function PromptCard({ starter, onClick }: { starter: StarterPrompt; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group min-w-0 w-full overflow-hidden rounded-2xl border border-[#ddb159]/16 bg-[#fbf4e5]/[0.035] px-3 py-2.5 text-left transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10">
      <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">{starter.eyebrow}</p>
      <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-snug text-[#fbf4e5]/78">{starter.label}</p>
    </button>
  );
}

function LockedExperience({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[34px] border border-[#ddb159]/25 bg-[#06140d] text-[#fbf4e5] shadow-[0_35px_110px_rgba(0,0,0,0.72)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(221,177,89,0.18),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(72,140,94,0.18),transparent_35%),linear-gradient(135deg,#06140d,#0b2417_48%,#06140d)]" />
        <section className="relative flex min-h-[520px] min-w-0 flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex min-w-0 items-center gap-3"><PremiumOrb /><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">Premium intelligence</p><p className="mt-0.5 truncate text-[12px] font-semibold text-[#fbf4e5]/45">Portfolio-aware AI coach</p></div></div>
            <h1 className="mt-7 max-w-xl text-[38px] font-black leading-[0.94] tracking-[-0.06em] text-[#fbf4e5] sm:text-[52px] lg:text-[58px]">Ask StockGPT is a subscriber feature.</h1>
            <p className="mt-5 max-w-xl text-[14px] font-medium leading-7 text-[#fbf4e5]/64 sm:text-[15px]">Unlock a premium market coach that can explain your portfolio, alerts, rankings, stop-loss levels, take-profit zones, news impact and trading concepts in plain English.</p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href={isAuthenticated ? "/subscription" : "/login"} className="inline-flex h-12 items-center justify-center rounded-full bg-[#ddb159] px-6 text-[12px] font-black uppercase tracking-[0.16em] text-[#07170f] transition hover:brightness-105">{isAuthenticated ? "Upgrade access" : "Log in"}</Link>
            <a href="mailto:sales@stockgpt.pro" className="inline-flex h-12 items-center justify-center rounded-full border border-[#ddb159]/35 px-6 text-[12px] font-black uppercase tracking-[0.16em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Contact sales</a>
          </div>
        </section>
        <aside className="relative hidden min-h-0 border-l border-[#ddb159]/14 bg-[#fbf4e5]/[0.035] p-8 lg:block">
          <div className="rounded-[28px] border border-[#ddb159]/25 bg-[#06140d]/55 p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ddb159]">What it answers</p><div className="mt-5 grid gap-3">{["What should I do with my weakest holding?", "Which stocks are worth adding to?", "Where am I overexposed?", "Why did an alert appear?", "What does this trading concept mean?", "How do I manage billing or membership?"].map((item) => <div key={item} className="rounded-2xl border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] px-4 py-3 text-[13px] font-bold leading-relaxed text-[#fbf4e5]/72">{item}</div>)}</div></div>
        </aside>
      </section>
    </main>
  );
}

function ModeSidebar({ activeMode, setActiveMode, visibleStarters, onPrompt, onClear }: { activeMode: Mode; setActiveMode: (mode: Mode) => void; visibleStarters: StarterPrompt[]; onPrompt: (prompt: string) => void; onClear: () => void }) {
  return (
    <aside className="hidden min-h-0 border-r border-[#ddb159]/14 bg-[#fbf4e5]/[0.035] lg:grid lg:grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="shrink-0 px-5 pb-4 pt-5 xl:px-6 xl:pt-6">
        <div className="flex items-center gap-3"><PremiumOrb /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]">StockGPT Coach</p><p className="mt-0.5 text-[12px] font-semibold text-[#fbf4e5]/45">Workspace intelligence</p></div></div>
      </div>
      <div className="min-h-0 overflow-y-auto px-5 pb-4 xl:px-6">
        <div className="rounded-[24px] border border-[#ddb159]/18 bg-[#06140d]/60 p-3.5 xl:p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Workspace</p>
          <div className="mt-3 grid gap-2">
            {modeOptions.map((option) => {
              const selected = activeMode === option.mode;
              return <button key={option.mode} type="button" onClick={() => setActiveMode(option.mode)} className={["min-w-0 overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition", selected ? "border-[#ddb159]/55 bg-[#ddb159]/14" : "border-[#ddb159]/12 bg-[#fbf4e5]/[0.025] hover:border-[#ddb159]/35 hover:bg-[#ddb159]/8"].join(" ")}><p className="truncate text-[13px] font-black leading-tight text-[#fbf4e5]">{option.label}</p><p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-[#fbf4e5]/42">{option.description}</p></button>;
            })}
          </div>
        </div>
        <div className="mt-4 rounded-[24px] border border-[#ddb159]/18 bg-[#06140d]/45 p-3.5 xl:p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Suggested prompts</p>
          <div className="mt-3 grid gap-2">{visibleStarters.slice(0, 4).map((starter) => <PromptCard key={starter.prompt} starter={starter} onClick={() => onPrompt(starter.prompt)} />)}</div>
        </div>
      </div>
      <div className="shrink-0 border-t border-[#ddb159]/12 px-5 py-3 xl:px-6 xl:py-4">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]/70">Chat log</p><button type="button" onClick={onClear} className="inline-flex h-7 items-center justify-center rounded-full border border-[#ddb159]/20 px-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/70 transition hover:bg-[#ddb159]/10 hover:text-[#ddb159]">Clear</button></div>
        <p className="text-[10.5px] font-medium leading-5 text-[#fbf4e5]/38">Last 7 days are saved. Account-specific billing help goes through <span className="font-bold text-[#ddb159]/75">sales@stockgpt.pro</span>.</p>
      </div>
    </aside>
  );
}

function MobileModeChips({ activeMode, setActiveMode }: { activeMode: Mode; setActiveMode: (mode: Mode) => void }) {
  return (
    <nav className="grid shrink-0 grid-cols-4 gap-1 border-b border-[#ddb159]/12 bg-[#06140d] px-3 py-2 lg:hidden">
      {modeOptions.map((option) => {
        const selected = activeMode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => setActiveMode(option.mode)}
            className={["inline-flex h-9 min-w-0 items-center justify-center truncate rounded-full border px-1.5 text-[10px] font-black uppercase tracking-[0.04em] transition", selected ? "border-[#ddb159]/70 bg-[#ddb159] text-[#07170f]" : "border-[#ddb159]/18 bg-[#fbf4e5]/[0.035] text-[#fbf4e5]/70"].join(" ")}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </nav>
  );
}

function PanelShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#ddb159]/16 bg-[#04140c]/88 lg:h-full lg:rounded-none lg:border-0 lg:bg-transparent">
      <div className="shrink-0 border-b border-[#ddb159]/12 px-4 py-3 lg:py-4">
        <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] lg:text-[10px] lg:tracking-[0.2em]">{eyebrow}</p>
        <h3 className="mt-1 truncate text-[22px] font-black leading-none tracking-[-0.05em] text-[#fbf4e5] lg:text-[24px]">{title}</h3>
      </div>
      <div className="min-h-0 overflow-visible p-3 lg:overflow-y-auto lg:overflow-x-hidden lg:p-4">{children}</div>
    </div>
  );
}

function PortfolioPanel({ holdings, loading, onAskHolding, onAskPrompt }: { holdings: HoldingOption[]; loading: boolean; onAskHolding: (holding: HoldingOption) => void; onAskPrompt: (prompt: string) => void }) {
  const total = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const strongest = [...holdings].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)).slice(0, 3);
  const weakest = [...holdings].sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1)).slice(0, 3);

  return (
    <PanelShell eyebrow="Portfolio intelligence" title="Your holdings">
      <div className="grid gap-3">
        <div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] p-4">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">Tracked value</p>
          <p className="mt-2 truncate text-[30px] font-black leading-none tracking-[-0.05em] text-[#fbf4e5]">{money(total)}</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-[#fbf4e5]/42">Loaded when Portfolio opens.</p>
        </div>

        {loading ? (
          <div className="grid gap-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-[#ddb159]/10 bg-[#fbf4e5]/[0.045]" />)}</div>
        ) : holdings.length === 0 ? (
          <div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] p-4"><p className="text-[14px] font-black text-[#fbf4e5]">No holdings found.</p><p className="mt-1 text-[12px] font-semibold leading-5 text-[#fbf4e5]/48">Add or import holdings in Portfolio first, then Ask StockGPT can analyse exposure, alerts and actions.</p></div>
        ) : (
          <div className="grid gap-2">
            {holdings.slice(0, 8).map((holding) => (
              <button key={holding.ticker} type="button" onClick={() => onAskHolding(holding)} className="group min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/12 bg-[#06140d]/55 p-3 text-left transition hover:border-[#ddb159]/42 hover:bg-[#ddb159]/8">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded-full bg-[#ddb159] px-2 py-1 text-[10px] font-black text-[#07170f]">#{holding.rank ?? "—"}</span>
                      <p className="truncate text-[14px] font-black text-[#fbf4e5]">{holding.ticker}</p>
                    </div>
                    <p className="mt-1 truncate text-[12px] font-semibold text-[#fbf4e5]/50">{holding.company ?? "Holding"}</p>
                    <p className="mt-1 truncate text-[10.5px] font-bold text-[#fbf4e5]/34">{holding.sector ?? "Sector unknown"} · {holding.shares.toLocaleString()} sh</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="truncate text-[13px] font-black text-[#ddb159]">{money(holding.currentValue)}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#fbf4e5]/42">Ask</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-2 rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.035] p-3 sm:grid-cols-2 lg:grid-cols-1">
          <button type="button" onClick={() => onAskPrompt("Compare my current portfolio against the top-ranked StockGPT names. Highlight weak holdings, concentration risk and any sensible next review steps.")} className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#07170f] transition hover:brightness-105">Compare</button>
          <button type="button" onClick={() => onAskPrompt("Review my portfolio risk. Focus on allocation, cash, weak ranks, alerts, stop-losses and take-profit discipline.")} className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/24 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Risk</button>
        </div>

        {(strongest.length > 0 || weakest.length > 0) && <div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.03] p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">Quick signal</p><p className="mt-2 truncate text-[12px] font-semibold leading-5 text-[#fbf4e5]/58">Strongest: {strongest.map((h) => h.ticker).join(", ") || "—"}</p><p className="truncate text-[12px] font-semibold leading-5 text-[#fbf4e5]/58">Needs review: {weakest.map((h) => h.ticker).join(", ") || "—"}</p></div>}
      </div>
    </PanelShell>
  );
}

function RankingsPanel({ onAskPrompt }: { onAskPrompt: (prompt: string) => void }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function loadRankings(reset = false, query = search) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const offset = reset ? 0 : nextOffset;
    if (reset) setLoading(true); else setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "25", offset: String(offset) });
      const cleaned = query.trim();
      if (cleaned) params.set("search", cleaned);
      const response = await fetch(`/api/ask-stockgpt/rankings?${params.toString()}`, { headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => null)) as RankingsResponse | null;
      if (requestIdRef.current !== requestId) return;
      if (!response.ok) throw new Error(data?.error ?? "Could not load rankings.");
      const nextRows = Array.isArray(data?.rankings) ? data.rankings : [];
      setRows((current) => (reset ? nextRows : [...current, ...nextRows]));
      setHasMore(Boolean(data?.has_more));
      setNextOffset(Number(data?.next_offset ?? offset + nextRows.length));
      setDataAsOf(data?.data_as_of ?? null);
    } catch (err) {
      if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : "Could not load rankings.");
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRankings(true, search), 280);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function rankMove(row: RankingResult) {
    if (row.rank_move === null || row.rank_move === 0) return "—";
    return row.rank_move > 0 ? `↑ ${row.rank_move}` : `↓ ${Math.abs(row.rank_move)}`;
  }

  return (
    <PanelShell eyebrow="Ranking engine" title="Stock rankings">
      <div className="grid gap-3">
        <div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] p-3">
          <label className="sr-only" htmlFor="ask-rankings-search">Search rankings</label>
          <input id="ask-rankings-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ticker or company" className="h-11 w-full rounded-2xl border border-[#ddb159]/14 bg-[#06140d]/72 px-4 text-[13px] font-semibold text-[#fbf4e5] outline-none transition placeholder:text-[#fbf4e5]/32 focus:border-[#ddb159]/55" />
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold text-[#fbf4e5]/35"><span className="truncate">Batches of 25</span><span className="shrink-0">{dataAsOf ? new Date(dataAsOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live"}</span></div>
        </div>
        {error && <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-[12px] font-bold text-red-100">{error}</div>}
        {loading ? (
          <div className="grid gap-2">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-[#ddb159]/10 bg-[#fbf4e5]/[0.045]" />)}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] p-4"><p className="text-[14px] font-black text-[#fbf4e5]">No matching rankings.</p><p className="mt-1 text-[12px] font-semibold leading-5 text-[#fbf4e5]/48">Try a ticker, company name, or clear the search.</p></div>
        ) : (
          <div className="grid gap-2">
            {rows.map((row) => (
              <div key={`${row.ticker}-${row.rank}`} className="min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/12 bg-[#06140d]/55 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded-full bg-[#ddb159] px-2 py-1 text-[10px] font-black text-[#07170f]">#{row.rank ?? "—"}</span>
                      <p className="truncate text-[14px] font-black text-[#fbf4e5]">{row.ticker}</p>
                      <span className={["shrink-0 rounded-full px-2 py-1 text-[9px] font-black", row.confidence === "High" ? "bg-emerald-300/15 text-emerald-100" : row.confidence === "Medium" ? "bg-[#ddb159]/14 text-[#ddb159]" : "bg-white/8 text-white/55"].join(" ")}>{row.confidence}</span>
                    </div>
                    <p className="mt-1 truncate text-[12px] font-semibold text-[#fbf4e5]/48">{row.company ?? "Company unknown"}</p>
                    <p className="mt-1 truncate text-[10.5px] font-bold text-[#fbf4e5]/32">{row.sector ?? "Sector unknown"} · Move {rankMove(row)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-black text-[#ddb159]">{formatNumber(row.score)}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#fbf4e5]/48">{money(row.price)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => onAskPrompt(`Explain why ${row.ticker} is ranked #${row.rank ?? "unknown"}. Use its StockGPT score, confidence, sector, ranking movement and any relevant portfolio/news context if available.`)} className="inline-flex h-9 min-w-0 items-center justify-center rounded-full border border-[#ddb159]/22 px-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Why?</button>
                  <button type="button" onClick={() => onAskPrompt(`Compare ${row.ticker} to my portfolio holdings. Should it be on my watchlist or is my portfolio already stronger?`)} className="inline-flex h-9 min-w-0 items-center justify-center rounded-full bg-[#ddb159] px-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#07170f] transition hover:brightness-105">Compare</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasMore && !loading && <button type="button" disabled={loadingMore} onClick={() => void loadRankings(false)} className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/24 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10 disabled:opacity-45">{loadingMore ? "Loading" : "Load more"}</button>}
      </div>
    </PanelShell>
  );
}

function LearnPanel({ onAskPrompt }: { onAskPrompt: (prompt: string) => void }) {
  const lessons = [
    ["Risk/reward", "Explain risk/reward using a simple stock example and show what a good setup looks like."],
    ["Position sizing", "Teach me position sizing like a beginner investor, using my portfolio if available."],
    ["Stop-losses", "Explain how to use stop-losses without getting shaken out too early."],
    ["AI scores", "Explain how StockGPT AI score and rank should be interpreted in plain English."],
  ];
  return (
    <PanelShell eyebrow="Beginner-friendly coach" title="Learn faster">
      <div className="grid gap-3">
        <div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] p-4"><p className="text-[13px] font-semibold leading-6 text-[#fbf4e5]/58">Learn the concept, then apply it to rankings or your holdings.</p></div>
        <div className="grid overflow-hidden rounded-[22px] border border-[#ddb159]/14 bg-[#06140d]/55">
          {lessons.map(([label, prompt]) => (
            <button key={label} type="button" onClick={() => onAskPrompt(prompt)} className="flex min-h-[54px] min-w-0 items-center justify-between gap-3 border-b border-[#ddb159]/10 px-4 py-3 text-left last:border-b-0 transition hover:bg-[#ddb159]/8">
              <span className="truncate text-[14px] font-black text-[#fbf4e5]">{label}</span>
              <span className="shrink-0 text-[20px] font-light leading-none text-[#ddb159]">›</span>
            </button>
          ))}
        </div>
      </div>
    </PanelShell>
  );
}

function AccountPanel({ onAskPrompt }: { onAskPrompt: (prompt: string) => void }) {
  return <PanelShell eyebrow="Membership support" title="Account help"><div className="grid gap-3"><div className="rounded-[22px] border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] p-4"><p className="text-[13px] font-semibold leading-6 text-[#fbf4e5]/58">For account-specific billing, refunds or plan issues, use the subscription page or email sales@stockgpt.pro. Ask StockGPT can explain general steps but will not invent billing details.</p></div><Link href="/subscription" className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#07170f] transition hover:brightness-105">Subscription</Link><a href="mailto:sales@stockgpt.pro" className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/24 px-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Email sales</a><button type="button" onClick={() => onAskPrompt("How do I manage my StockGPT membership, billing or subscription?")} className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/24 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Ask account</button></div></PanelShell>;
}

function IntelligencePanel({ activeMode, holdings, holdingsLoading, onAskHolding, onAskPrompt, desktopOnly = false }: { activeMode: Mode; holdings: HoldingOption[]; holdingsLoading: boolean; onAskHolding: (holding: HoldingOption) => void; onAskPrompt: (prompt: string) => void; desktopOnly?: boolean }) {
  return (
    <aside className={["min-w-0 overflow-hidden bg-[#04140c]/80 lg:min-h-0 lg:border-l lg:border-[#ddb159]/14", desktopOnly ? "hidden lg:block" : ""].join(" ")}>
      {activeMode === "portfolio" && <PortfolioPanel holdings={holdings} loading={holdingsLoading} onAskHolding={onAskHolding} onAskPrompt={onAskPrompt} />}
      {activeMode === "rankings" && <RankingsPanel onAskPrompt={onAskPrompt} />}
      {activeMode === "learn" && <LearnPanel onAskPrompt={onAskPrompt} />}
      {activeMode === "account" && <AccountPanel onAskPrompt={onAskPrompt} />}
    </aside>
  );
}

export function AskStockGPTWorkspace({ canUseAskStockGPT, isAuthenticated }: AskStockGPTWorkspaceProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>("portfolio");
  const [holdingOptions, setHoldingOptions] = useState<HoldingOption[]>([]);
  const [holdingLoading, setHoldingLoading] = useState(false);
  const [holdingsLoaded, setHoldingsLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locked = !canUseAskStockGPT;

  const visibleStarters = useMemo(() => starterPrompts.filter((prompt) => prompt.mode === activeMode), [activeMode]);
  const mobileStarters = useMemo(() => visibleStarters.slice(0, 2), [visibleStarters]);
  const showStarterCards = messages.length <= 1 && !loading && !historyLoading;

  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const response = await fetch("/api/ask-stockgpt", { method: "GET", headers: { Accept: "application/json" } });
        const data = (await response.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
        if (cancelled) return;
        const saved = Array.isArray(data?.messages) ? data.messages.filter((message): message is ChatMessage => message !== null && typeof message === "object" && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim().length > 0) : [];
        setMessages(saved.length > 0 ? saved : [welcomeMessage]);
      } catch {
        if (!cancelled) setMessages([welcomeMessage]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => { cancelled = true; };
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const timeout = window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (window.matchMedia("(min-width: 1024px)").matches) {
        textarea.focus({ preventScroll: true });
        return;
      }
      textarea.focus();
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const bottom = bottomRef.current;
    if (!bottom) return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      const scroller = bottom.closest<HTMLElement>(".sg-ask-scroll");
      if (scroller) {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        return;
      }
    }
    bottom.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, historyLoading, locked]);

  useEffect(() => {
    if (locked || activeMode !== "portfolio" || holdingsLoaded || holdingLoading) return;
    void loadHoldings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, activeMode, holdingsLoaded, holdingLoading]);

  async function clearHistory() {
    setMessages([welcomeMessage]);
    try { await fetch("/api/ask-stockgpt", { method: "DELETE" }); } catch {}
  }

  async function sendQuestion(nextQuestion?: string) {
    if (locked) return;
    const text = (nextQuestion ?? question).trim();
    if (!text || loading || historyLoading) return;
    setQuestion("");
    setLoading(true);
    const userMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    try {
      const response = await fetch("/api/ask-stockgpt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, mode: activeMode, messages: nextMessages.slice(-14) }) });
      const data = (await response.json().catch(() => null)) as { answer?: string } | null;
      const answer = data?.answer ?? "I could not return an answer from Ask StockGPT. Try again, or email sales@stockgpt.pro if this relates to membership or billing.";
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I could not connect to the StockGPT coach. Check the deployment logs and API route. For membership or billing questions, contact sales@stockgpt.pro." }]);
    } finally {
      setLoading(false);
    }
  }

  async function loadHoldings() {
    if (holdingLoading) return;
    setHoldingLoading(true);
    try {
      const response = await fetch("/api/ask-stockgpt/portfolio-holdings", { headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => null)) as { holdings?: HoldingOption[] } | null;
      setHoldingOptions(Array.isArray(data?.holdings) ? data.holdings : []);
      setHoldingsLoaded(true);
    } catch {
      setHoldingOptions([]);
      setHoldingsLoaded(true);
    } finally {
      setHoldingLoading(false);
    }
  }

  function askAboutHolding(holding: HoldingOption) {
    setActiveMode("portfolio");
    void sendQuestion(`Analyse my ${holding.ticker} position. Explain whether I should hold, trim, sell, or buy more, using its AI score, rank, alerts, trade plan levels, risk/reward, position sizing, and any relevant market/news context.`);
  }

  function askPrompt(prompt: string) {
    void sendQuestion(prompt);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion();
  }

  const chatContent = (
    <>
      {historyLoading && <div className="flex justify-center"><div className="rounded-full border border-[#ddb159]/18 bg-[#fbf4e5]/[0.045] px-4 py-2 text-[11px] font-bold text-[#fbf4e5]/58">Loading chat log</div></div>}
      {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
      {loading && <div className="flex justify-start"><div className="max-w-[92%] overflow-hidden break-words rounded-[22px] rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] px-3.5 py-3 text-[#07170f] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"><div className="mb-1.5 flex min-w-0 items-center gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#07170f] text-[9px] font-black text-[#ddb159]">S</span><span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#07170f]/45">Analysing</span></div><div className="text-[13px] font-semibold text-[#07170f]/72">Reading the conversation and app context.</div></div></div>}
      <div ref={bottomRef} />
    </>
  );

  return (
    <div className="sg-ask-workspace flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#020805] text-[#fbf4e5]">
      <header className="shrink-0 border-b border-[#ddb159]/16 bg-[#04140c] px-3 py-2 sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-3">
          <BackButton />
          <div className="min-w-0 text-center"><p className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">Ask StockGPT</p><p className="mt-0.5 hidden text-[12px] font-semibold text-[#fbf4e5]/42 sm:block">Chat and portfolio intelligence</p></div>
          <button type="button" onClick={() => void clearHistory()} className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/24 bg-[#fbf4e5]/[0.04] px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:bg-[#ddb159]/10 sm:px-4 sm:text-[12px] sm:tracking-[0.14em]">Clear</button>
        </div>
      </header>

      {locked ? <LockedExperience isAuthenticated={isAuthenticated} /> : (
        <>
          <MobileModeChips activeMode={activeMode} setActiveMode={setActiveMode} />

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
            <div className="sg-ask-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
              <div className="grid gap-3 pb-3">
                <IntelligencePanel activeMode={activeMode} holdings={holdingOptions} holdingsLoading={holdingLoading} onAskHolding={askAboutHolding} onAskPrompt={askPrompt} />

                <section className="grid min-w-0 gap-3 overflow-hidden rounded-[24px] border border-[#ddb159]/16 bg-[#06140d] p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <PremiumOrb small />
                    <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Chat</p><p className="truncate text-[12px] font-semibold text-[#fbf4e5]/45">Ask naturally</p></div>
                  </div>
                  {showStarterCards && <div className="grid grid-cols-2 gap-2">{mobileStarters.map((starter) => <button key={starter.prompt} type="button" onClick={() => void sendQuestion(starter.prompt)} className="min-h-[58px] min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#fbf4e5]/[0.04] px-3 py-2.5 text-left text-[11px] font-bold leading-snug text-[#fbf4e5]/80"><span className="block truncate text-[8px] font-black uppercase tracking-[0.13em] text-[#ddb159]/72">{starter.eyebrow}</span><span className="mt-1 block line-clamp-2">{starter.label}</span></button>)}</div>}
                  <div className="grid gap-3">{chatContent}</div>
                </section>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#ddb159]/14 bg-[#04140c]/98 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-end gap-2 rounded-[24px] border border-[#ddb159]/28 bg-[#071b12] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_55px_rgba(0,0,0,0.3)]">
                <textarea ref={textareaRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything..." rows={1} className="max-h-24 min-h-[44px] min-w-0 resize-none bg-transparent px-2 py-2.5 text-[14px] font-medium leading-relaxed text-[#fbf4e5] outline-none placeholder:text-[#fbf4e5]/34" />
                <button type="submit" aria-label="Send" disabled={!question.trim() || loading || historyLoading} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#ddb159] text-[18px] font-black leading-none text-[#07170f] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45">↑</button>
              </div>
            </form>
          </main>

          <main className="sg-ask-desktop mx-auto hidden min-h-0 w-full max-w-[1700px] flex-1 grid-cols-[190px_minmax(0,1fr)_260px] grid-rows-[minmax(0,1fr)] gap-2 overflow-hidden p-2 lg:grid xl:grid-cols-[250px_minmax(420px,1fr)_320px] 2xl:grid-cols-[300px_minmax(480px,1fr)_390px] xl:p-3">
            <ModeSidebar activeMode={activeMode} setActiveMode={setActiveMode} visibleStarters={visibleStarters} onPrompt={askPrompt} onClear={() => void clearHistory()} />

            <section className="grid min-h-0 min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[26px] border border-[#ddb159]/18 bg-[#06140d] xl:rounded-l-[30px] xl:rounded-r-none xl:border-r-0">
              <header className="relative shrink-0 border-b border-[#ddb159]/14 px-5 py-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><PremiumOrb small /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">Portfolio intelligence</p><h1 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[#fbf4e5] xl:text-[34px]">Ask StockGPT</h1></div></div>
                </div>
                <p className="mt-3 max-w-full text-[13px] font-medium leading-5 text-[#fbf4e5]/52">Ask naturally. Portfolio and ranking tools load only when needed.</p>
              </header>

              <main className="sg-ask-scroll min-h-0 max-w-full overflow-y-auto overflow-x-hidden px-5 py-4">
                <div className="mx-auto grid max-w-3xl gap-3">{chatContent}</div>
              </main>

              <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#ddb159]/14 bg-[#04140c]/95 p-4">
                <div className="mx-auto max-w-3xl rounded-[26px] border border-[#ddb159]/28 bg-[#071b12] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_55px_rgba(0,0,0,0.3)]">
                  <textarea ref={textareaRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendQuestion(); } }} placeholder="Ask naturally. Imperfect grammar is fine..." rows={2} className="max-h-28 min-h-[58px] w-full resize-none bg-transparent px-3 py-2 text-[14px] font-medium leading-relaxed text-[#fbf4e5] outline-none placeholder:text-[#fbf4e5]/34" />
                  <div className="flex min-w-0 items-center justify-end gap-2 px-2 pb-1">
                    <button type="button" onClick={() => { setActiveMode("portfolio"); void loadHoldings(); }} className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/20 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/75 transition hover:bg-[#ddb159]/10">Holdings</button>
                    <button type="submit" disabled={!question.trim() || loading || historyLoading} className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#07170f] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">{loading ? "Thinking" : "Send"}</button>
                  </div>
                </div>
              </form>
            </section>

            <IntelligencePanel activeMode={activeMode} holdings={holdingOptions} holdingsLoading={holdingLoading} onAskHolding={askAboutHolding} onAskPrompt={askPrompt} desktopOnly />
          </main>
        </>
      )}
    </div>
  );
}
