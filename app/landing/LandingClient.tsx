"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";

export type LandingTicker = {
  symbol: string;
  yahooSymbol: string;
  price: number;
  change: number;
  changePct: number;
};

type LandingMetrics = {
  totalStocks: number;
  bullishPct: number;
  sentiment: string;
  lastUpdatedLabel: string;
};

type LandingClientProps = {
  tickerTape: LandingTicker[];
  metrics: LandingMetrics;
};

const resultStats = [
  {
    label: "Illustrative top-10 return",
    target: 31.4,
    prefix: "+",
    suffix: "%",
    decimals: 1,
    detail: "example return spread vs benchmark",
  },
  {
    label: "Illustrative downside avoided",
    target: 18.6,
    prefix: "+",
    suffix: "%",
    decimals: 1,
    detail: "example protected capital scenario",
  },
  {
    label: "Illustrative winning periods",
    target: 83,
    suffix: "%",
    decimals: 0,
    detail: "example top-ranked basket periods",
  },
  {
    label: "Illustrative return capture",
    target: 4.2,
    suffix: "x",
    decimals: 1,
    detail: "example signal-to-return ratio",
  },
];

const features = [
  {
    id: "rankings",
    icon: "♛",
    title: "Locked AI Rankings",
    copy:
      "The public page proves the engine is live, but the actual tickers, scores and ranking order stay locked. Subscribers unlock the full ranked table and the reasoning behind each opportunity.",
  },
  {
    id: "portfolio",
    icon: "✦",
    title: "Portfolio Builder",
    copy:
      "Turn ranking intelligence into a structured portfolio workflow. Compare holdings, spot weakening positions, and avoid relying on scattered apps or guesswork.",
  },
  {
    id: "news",
    icon: "◈",
    title: "AI News Context",
    copy:
      "Combine market news, stock movement and ranking context in one dashboard. StockGPT helps users focus on what could matter, instead of drowning in noise.",
  },
];

const engineSteps = [
  {
    title: "Collect",
    copy: "Prices, rankings, fundamentals, sector context and market news are pulled into the StockGPT research layer.",
  },
  {
    title: "Normalise",
    copy: "Indicators are standardised so different stocks can be compared more fairly across sectors and market caps.",
  },
  {
    title: "Score",
    copy: "Each stock is assessed across Quality, Growth, Value, Momentum, Risk and Income.",
  },
  {
    title: "Risk-filter",
    copy: "Fragile, overextended or debt-stressed companies are penalised before the final ranking is shown.",
  },
  {
    title: "Rank & Deliver",
    copy: "Subscribers see the locked ranking table, AI summaries, portfolio context and market research tools.",
  },
];

const navLinks = [
  { label: "Rankings", href: "#rankings-preview" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Affiliate", href: "/affiliate" },
];

const sparkStyles = [
  { left: "6%", top: "18%", delay: "0s", duration: "11s" },
  { left: "14%", top: "62%", delay: "1.8s", duration: "13s" },
  { left: "26%", top: "12%", delay: "0.7s", duration: "10s" },
  { left: "38%", top: "72%", delay: "2.4s", duration: "12s" },
  { left: "46%", top: "28%", delay: "1.1s", duration: "9.5s" },
  { left: "58%", top: "58%", delay: "3.2s", duration: "13s" },
  { left: "66%", top: "16%", delay: "2s", duration: "11.8s" },
  { left: "74%", top: "76%", delay: "4s", duration: "14s" },
  { left: "82%", top: "32%", delay: "0.5s", duration: "10.5s" },
  { left: "92%", top: "66%", delay: "2.6s", duration: "12.5s" },
];

const candleStyles = [
  { left: "8%", top: "25%", height: "44px", delay: "0.2s" },
  { left: "20%", top: "13%", height: "68px", delay: "1.5s" },
  { left: "32%", top: "42%", height: "52px", delay: "0.8s" },
  { left: "48%", top: "22%", height: "74px", delay: "2.1s" },
  { left: "62%", top: "52%", height: "46px", delay: "1.1s" },
  { left: "78%", top: "20%", height: "64px", delay: "2.8s" },
  { left: "88%", top: "44%", height: "58px", delay: "3.4s" },
];

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMove(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#faf6f0]/48";
  if (value > 0) return "text-[#00ff88]";
  if (value < 0) return "text-red-300";
  return "text-[#faf6f0]/48";
}

function CheckoutButton({
  children,
  full = false,
  compact = false,
}: {
  children: React.ReactNode;
  full?: boolean;
  compact?: boolean;
}) {
  return (
    <form
      action="/api/create-checkout-session"
      method="post"
      className={full ? "w-full" : "w-fit max-sm:w-full"}
    >
      <EndorselyReferralInput />
      <button
        type="submit"
        className={[
          "sg-magnetic group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#ecc874] via-[#ddb159] to-[#b58a3a] font-black uppercase tracking-[0.16em] text-[#06180f] shadow-[0_18px_52px_rgba(221,177,89,0.32),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(221,177,89,0.5),inset_0_1px_0_rgba(255,255,255,0.5)] active:translate-y-0",
          full ? "w-full" : "max-sm:w-full",
          compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
        ].join(" ")}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-[#fff3cc] opacity-0 transition-opacity duration-500 group-hover:opacity-30" />
        <span className="relative z-10 flex items-center gap-2">
          {children}
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </button>
    </form>
  );
}

function GhostButton({
  href,
  children,
  compact = false,
}: {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "sg-magnetic group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[#ddb159]/50 bg-[#ddb159]/[0.03] font-black uppercase tracking-[0.16em] text-[#faf6f0] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[#ddb159] hover:bg-[#ddb159]/10 hover:text-[#ddb159] hover:shadow-[0_18px_50px_rgba(221,177,89,0.18)] max-sm:w-full",
        compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
      ].join(" ")}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#ddb159]/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="sg-section-label mb-5 inline-flex items-center gap-2 rounded-full border border-[#ddb159]/30 bg-gradient-to-r from-[#ddb159]/12 via-[#ddb159]/8 to-[#ddb159]/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#ddb159] shadow-[0_0_32px_rgba(221,177,89,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.9)]" />
      <span className="sg-label-text">{children}</span>
    </p>
  );
}

function StatCounter({
  target,
  prefix = "",
  suffix = "",
  decimals,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals: number;
}) {
  return (
    <span
      className="sg-counter sg-data"
      data-count-to={target}
      data-prefix={prefix}
      data-suffix={suffix}
      data-decimals={decimals}
    >
      {prefix}
      {decimals > 0 ? "0.0" : "0"}
      {suffix}
    </span>
  );
}

function TickerMarquee({ tickerTape }: { tickerTape: LandingTicker[] }) {
  if (tickerTape.length === 0) {
    return (
      <div className="rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 px-4 py-3 text-sm font-bold text-[#faf6f0]/50 backdrop-blur">
        Live ticker data is loading from the market feed.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="sg-marquee-wrap relative overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 py-2.5 shadow-[0_20px_80px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#061b12] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#061b12] to-transparent" />
      <div className="sg-marquee-track flex w-max items-center gap-2.5">
        {repeated.map((item, index) => (
          <Link
            key={`${item.yahooSymbol}-${index}`}
            href={
              item.yahooSymbol.startsWith("^")
                ? "/"
                : `/stocks/${encodeURIComponent(item.yahooSymbol)}`
            }
            className="group flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#04180f]/85 px-3 py-2 text-xs font-black text-[#faf6f0] transition-all duration-300 hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10 hover:shadow-[0_0_24px_rgba(221,177,89,0.18)]"
          >
            <span className="sg-data text-[#faf6f0]">{item.symbol}</span>
            <span className="sg-data text-[#faf6f0]/45">
              {formatMoney(item.price)}
            </span>
            <span className={["sg-data", toneClass(item.changePct)].join(" ")}>
              {item.changePct > 0 ? "▲" : item.changePct < 0 ? "▼" : "■"}{" "}
              {formatMove(item.changePct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone = "gold",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "gold" | "green";
}) {
  return (
    <div className="sg-metric-card group relative overflow-hidden rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/82 p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[#ddb159]/45 hover:bg-[#ddb159]/[0.055] hover:shadow-[0_24px_60px_rgba(0,0,0,0.32),0_0_36px_rgba(221,177,89,0.16)]">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ddb159]/0 via-[#ddb159]/0 to-[#ddb159]/0 transition-all duration-500 group-hover:from-[#ddb159]/8 group-hover:via-transparent group-hover:to-[#00ff88]/4" />
      <p className="relative text-[10px] font-black uppercase tracking-[0.22em] text-[#faf6f0]/42">
        {label}
      </p>
      <p
        className={[
          "sg-data relative mt-2 text-2xl font-black",
          tone === "green" ? "text-[#00ff88]" : "text-[#ddb159]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="relative mt-1 truncate text-xs font-bold text-[#faf6f0]/42">
        {sub}
      </p>
    </div>
  );
}

function LockedRankingPreview({ metrics }: { metrics: LandingMetrics }) {
  const lockedRows = Array.from({ length: 8 });

  return (
    <div
      id="rankings-preview"
      className="sg-monitor sg-reveal relative scroll-mt-28 overflow-hidden rounded-[1.35rem] border border-[#ddb159]/24 bg-[#06180f]/86 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_40px_130px_rgba(0,0,0,0.58),0_0_90px_rgba(221,177,89,0.16)] backdrop-blur-xl sm:rounded-[2rem] sm:p-3"
    >
      <div className="sg-scanline pointer-events-none absolute inset-0 z-20 rounded-[1.35rem] sm:rounded-[2rem]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(221,177,89,0.18),transparent_30%),radial-gradient(circle_at_18%_8%,rgba(0,255,136,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]" />

      <div className="relative overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[#04180f]/94 sm:rounded-[1.55rem]">
        <div className="flex items-center gap-2 border-b border-[#ddb159]/10 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]/70" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]/70" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]/70" />
          <span className="sg-data ml-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#faf6f0]/35">
            stockgpt.terminal / live
          </span>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#ddb159]/16 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#ddb159] sm:text-[10px]">
              ✦ Subscriber Intelligence
            </p>
            <h2 className="sg-heading mt-1 text-2xl font-light text-[#faf6f0] sm:text-3xl">
              Live Rankings Locked
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-[#00ff88]/25 bg-[#00ff88]/8 px-3 py-1.5 text-[10px] font-black text-[#00ff88] sm:text-[11px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
              </span>
              Engine live
            </span>
            <span className="rounded-full border border-[#ddb159]/20 bg-[#ddb159]/8 px-3 py-1.5 text-[10px] font-bold text-[#ddb159] sm:text-[11px]">
              Updated: {metrics.lastUpdatedLabel}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="grid grid-cols-[42px_minmax(0,1fr)_90px] border-b border-white/[0.08] px-3 py-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#faf6f0]/45 sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_90px_90px] md:text-[10px]">
            <span>#</span>
            <span>Stock</span>
            <span className="hidden md:block">Signal</span>
            <span className="hidden md:block">Price</span>
            <span className="text-right md:text-left">Score</span>
          </div>

          <div>
            {lockedRows.map((_, index) => (
              <div
                key={`locked-${index}`}
                className="sg-row-shimmer grid grid-cols-[42px_minmax(0,1fr)_90px] items-center border-b border-white/[0.06] px-3 py-3 transition-colors hover:bg-[#ddb159]/[0.03] sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_90px_90px]"
                style={{ "--row-delay": `${index * 90}ms` } as CSSProperties}
              >
                <span className="sg-data text-sm font-black text-[#ddb159]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 text-[9px] font-black text-[#ddb159]">
                    🔒
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#faf6f0]">
                      Subscriber stock locked
                    </span>
                    <span className="block truncate text-[10px] font-bold text-[#faf6f0]/38">
                      Unlock to view ticker, company and rank movement
                    </span>
                  </span>
                </span>

                <span className="hidden truncate text-sm font-bold text-[#faf6f0]/42 md:block">
                  AI signal hidden
                </span>

                <span className="sg-data hidden text-sm font-bold text-[#faf6f0]/38 md:block">
                  Locked
                </span>

                <span className="sg-data text-right text-sm font-black text-[#00ff88] md:text-left">
                  ••••
                </span>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#04180f]/22 via-[#04180f]/70 to-[#04180f]/92 px-4">
            <div className="sg-unlock-card pointer-events-auto max-w-[420px] rounded-[1.4rem] border border-[#ddb159]/40 bg-[#04180f]/94 p-5 text-center shadow-[0_0_46px_rgba(221,177,89,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ddb159]">
                Rankings are subscriber-only
              </p>
              <h3 className="sg-heading mt-2 text-3xl font-light text-[#faf6f0]">
                Unlock the actual tickers.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#faf6f0]/52">
                The engine is live. The ranking order, scores and stock names
                are protected for paying members.
              </p>
              <div className="mt-5 flex justify-center">
                <CheckoutButton compact>Unlock Rankings</CheckoutButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
