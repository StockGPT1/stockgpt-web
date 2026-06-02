"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";
import { LegalConsentLine } from "@/components/LegalConsentLine";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";

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

const navLinks = [
  { label: "Preview", target: "preview" },
  { label: "Rankings", target: "rankings" },
  { label: "Ask", target: "ask" },
  { label: "Portfolio", target: "portfolio" },
  { label: "Pricing", target: "pricing" },
];

const pricingFeatures = [
  "Full ranked stock table",
  "Daily scores and rank movements",
  "Individual stock research pages",
  "World news and stock impact context",
  "Portfolio Builder and alerts",
  "Ask StockGPT research assistant",
  "Live market updates",
];

const socialLinks = [
  {
    label: "X",
    href: "#",
  },
  {
    label: "TikTok",
    href: "#",
  },
  {
    label: "Instagram",
    href: "#",
  },
];

const dashboardRows = [
  {
    rank: "1",
    ticker: "NVDA",
    company: "NVIDIA Corp",
    price: "$224.38",
    score: "9,214",
    move: "+2.6%",
    moveUp: true,
  },
  {
    rank: "2",
    ticker: "MSFT",
    company: "Microsoft Corp",
    price: "$460.52",
    score: "8,906",
    move: "+0.4%",
    moveUp: true,
  },
  {
    rank: "3",
    ticker: "JPM",
    company: "JPMorgan Chase",
    price: "$296.58",
    score: "8,641",
    move: "+1.1%",
    moveUp: true,
  },
  {
    rank: "4",
    ticker: "AMZN",
    company: "Amazon.com Inc",
    price: "$182.15",
    score: "8,402",
    move: "-0.2%",
    moveUp: false,
  },
  {
    rank: "5",
    ticker: "AAPL",
    company: "Apple Inc",
    price: "$306.31",
    score: "8,188",
    move: "+0.8%",
    moveUp: true,
  },
  {
    rank: "6",
    ticker: "GOOGL",
    company: "Alphabet Inc",
    price: "$376.33",
    score: "7,954",
    move: "+0.1%",
    moveUp: true,
  },
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

function tickerToneClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#7a857e]";
  if (value > 0) return "text-[#0f9f5d]";
  if (value < 0) return "text-[#c84646]";
  return "text-[#7a857e]";
}

function scrollToSection(target: string) {
  const element = document.getElementById(target);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CheckoutButton({
  children = "Try free today",
  full = false,
  compact = false,
  variant = "gold",
}: {
  children?: React.ReactNode;
  full?: boolean;
  compact?: boolean;
  variant?: "gold" | "green" | "white";
}) {
  const variantClasses = {
    gold:
      "border-[#d9ad52] bg-[#d9ad52] text-[#061b12] hover:bg-[#e8c36b] focus:ring-[#d9ad52] focus:ring-offset-white",
    green:
      "border-[#0a2d1d] bg-[#0a2d1d] text-white hover:bg-[#123d2a] focus:ring-[#0a2d1d] focus:ring-offset-white",
    white:
      "border-white bg-white text-[#061b12] hover:bg-[#f6f2e8] focus:ring-white focus:ring-offset-[#04180f]",
  };

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
          "inline-flex items-center justify-center rounded-full border font-black uppercase tracking-[0.16em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
          full ? "w-full" : "max-sm:w-full",
          compact ? "h-11 px-5 text-[11px]" : "h-14 px-8 text-sm",
          variantClasses[variant],
        ].join(" ")}
      >
        {children}
      </button>

      {!compact && (
        <LegalConsentLine className="mt-3 max-w-[430px] text-[#66746b]" />
      )}
    </form>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-14 items-center justify-center rounded-full border border-[#0a2d1d]/18 bg-white px-8 text-sm font-black uppercase tracking-[0.16em] text-[#0a2d1d] transition-colors hover:border-[#0a2d1d]/35 hover:bg-[#f2f4ef] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d] focus:ring-offset-2 focus:ring-offset-white max-sm:w-full"
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex rounded-full border border-[#d9ad52]/26 bg-[#fff8e6] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
      {children}
    </p>
  );
}

function SocialIcon({ label }: { label: string }) {
  if (label === "X") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M18.244 2H21.5l-7.11 8.126L22.75 22h-6.54l-5.12-6.684L5.234 22H1.976l7.604-8.692L1.56 2h6.706l4.628 6.112L18.244 2Zm-1.142 17.91h1.804L7.28 3.98H5.344L17.102 19.91Z" />
      </svg>
    );
  }

  if (label === "TikTok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M16.6 2c.25 2.26 1.55 3.7 3.76 3.85v3.26a7.2 7.2 0 0 1-3.7-1.12v6.72c0 3.4-2.08 6.05-5.78 6.05-3.15 0-5.63-2.07-5.63-5.22 0-3.58 3.1-5.8 6.55-5.04v3.44c-1.55-.48-3.17.22-3.17 1.72 0 1.02.82 1.72 1.95 1.72 1.35 0 2.22-.8 2.22-2.52V2h3.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5Zm8.75 2.05a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9ZM12 7.25A4.75 4.75 0 1 1 12 16.75 4.75 4.75 0 0 1 12 7.25Zm0 2A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z" />
    </svg>
  );
}

function TickerMarquee({ tickerTape }: { tickerTape: LandingTicker[] }) {
  if (tickerTape.length === 0) {
    return (
      <div className="rounded-3xl border border-[#dfe5dc] bg-white px-4 py-3 text-sm font-bold text-[#647267]">
        Live market data is loading.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#dfe5dc] bg-white py-2.5 shadow-[0_14px_40px_rgba(7,27,17,0.06)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-16" />

      <div className="sg-marquee-track flex w-max items-center gap-2.5">
        {repeated.map((item, index) => (
          <Link
            key={`${item.yahooSymbol}-${index}`}
            href={
              item.yahooSymbol.startsWith("^")
                ? "/"
                : `/stocks/${encodeURIComponent(item.yahooSymbol)}`
            }
            className="flex items-center gap-2 rounded-full border border-[#edf0ea] bg-[#fbfaf6] px-3 py-2 text-xs font-bold text-[#0a2d1d] transition-colors hover:border-[#d9ad52]/45 hover:bg-[#fff8e6] focus:outline-none focus:ring-2 focus:ring-[#d9ad52] focus:ring-offset-2 focus:ring-offset-white"
          >
            <span className="sg-data text-[#0a2d1d]">{item.symbol}</span>
            <span className="sg-data text-[#738076]">{formatMoney(item.price)}</span>
            <span className={["sg-data", tickerToneClass(item.changePct)].join(" ")}>
              {formatMove(item.changePct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardMiniCard({
  label,
  main,
  sub,
  tone = "gold",
}: {
  label: string;
  main: string;
  sub: string;
  tone?: "gold" | "green" | "plain";
}) {
  return (
    <div className="rounded-2xl border border-[#072116]/10 bg-[#faf6f0] p-3 shadow-[0_8px_18px_rgba(7,33,22,0.06)]">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#072116]/50">
        {label}
      </p>
      <p
        className={[
          "mt-1 truncate text-[17px] font-black leading-none tracking-[-0.03em]",
          tone === "green"
            ? "text-emerald-700"
            : tone === "plain"
              ? "text-[#072116]"
              : "text-[#b88a32]",
        ].join(" ")}
      >
        {main}
      </p>
      <p className="mt-1 truncate text-[9px] font-bold text-[#072116]/42">{sub}</p>
    </div>
  );
}

function RealDashboardScreen({ metrics }: { metrics: LandingMetrics }) {
  const stockCountLabel =
    metrics.totalStocks > 0 ? metrics.totalStocks.toLocaleString("en-GB") : "500+";

  return (
    <div className="sg-dashboard-screen h-[650px] w-[330px] overflow-hidden bg-[#072116] text-[#faf6f0]">
      <div className="flex h-[56px] items-center justify-between border-b border-[#ddb159]/18 bg-[#04180f] px-4">
        <div className="relative h-9 w-[128px]">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            className="object-contain object-left"
            sizes="128px"
          />
        </div>
        <div className="h-8 w-8 rounded-full border border-[#ddb159]/26 bg-[#ddb159]/10" />
      </div>

      <div className="h-[594px] overflow-hidden">
        <div className="sg-phone-scroll space-y-3 p-3">
          <div className="rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0]/[0.035] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Dashboard
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">
              Welcome back.
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#faf6f0]/52">
              Your market overview, rankings and research tools in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DashboardMiniCard label="Top Ranked" main="Locked" sub="trial unlock" />
            <DashboardMiniCard
              label="Bullish %"
              main={`${metrics.bullishPct}%`}
              sub={metrics.sentiment}
              tone="green"
            />
            <DashboardMiniCard label="Total" main={stockCountLabel} sub="stocks ranked" />
            <DashboardMiniCard
              label="Updated"
              main={metrics.lastUpdatedLabel.split(",")[0] ?? metrics.lastUpdatedLabel}
              sub="latest model run"
              tone="plain"
            />
          </div>

          <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)]">
            <div className="flex h-[62px] items-start justify-between border-b border-[#072116]/10 px-4 py-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#072116]/55">
                  AI Rankings
                </p>
                <h3 className="mt-1 text-[17px] font-black leading-none tracking-[-0.04em]">
                  Top 10 Ranked Stocks
                </h3>
              </div>
              <span className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[9px] font-black text-[#072116]">
                Unlock
              </span>
            </div>

            <div className="grid grid-cols-[32px_minmax(0,1fr)_72px_62px] bg-[#072116] px-3 py-2 text-[8px] font-black uppercase tracking-wide text-[#faf6f0]">
              <div>#</div>
              <div>Ticker</div>
              <div className="text-right">Price</div>
              <div className="text-right">Score</div>
            </div>

            <div className="divide-y divide-[#072116]/8">
              {dashboardRows.slice(0, 5).map((stock) => (
                <div
                  key={stock.ticker}
                  className="grid min-h-[45px] grid-cols-[32px_minmax(0,1fr)_72px_62px] items-center gap-1 px-3 py-2 text-[11px]"
                >
                  <div className="font-bold tabular-nums text-[#072116]/65">
                    {stock.rank}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-black">{stock.ticker}</p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">
                        {stock.company}
                      </p>
                      <span
                        className={[
                          "inline-flex h-4 min-w-[38px] items-center justify-center rounded-full border px-1 text-[7.5px] font-black tabular-nums",
                          stock.moveUp
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                            : "border-red-500/25 bg-red-500/10 text-red-700",
                        ].join(" ")}
                      >
                        {stock.move}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-[10px] font-bold tabular-nums">
                    {stock.price}
                  </div>

                  <div className="flex justify-end">
                    <span className="inline-flex min-w-[48px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black tabular-nums text-[#072116]">
                      {stock.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                  Market Overview
                </p>
                <h3 className="mt-1 text-[15px] font-black text-[#faf6f0]">
                  S&amp;P 500
                </h3>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">
                +0.32%
              </span>
            </div>
            <div className="mt-3 h-[86px] overflow-hidden rounded-xl bg-[#072116]/45">
              <div className="sg-real-chart h-full" />
            </div>
          </div>

          <div className="rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/55">
                Top Gainers &amp; Losers
              </p>
              <span className="rounded-full border border-[#072116]/10 px-2 py-0.5 text-[8px] font-black text-[#072116]/55">
                1D
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {[
                ["PLTR", "+4.8%", true],
                ["META", "-3.4%", false],
                ["MA", "+0.8%", true],
              ].map(([ticker, move, up]) => (
                <div
                  key={ticker}
                  className="flex items-center justify-between rounded-xl border border-[#072116]/8 bg-[#072116]/[0.03] px-3 py-2"
                >
                  <p className="sg-data text-xs font-black">{ticker}</p>
                  <p
                    className={[
                      "sg-data text-xs font-black",
                      up ? "text-emerald-700" : "text-red-700",
                    ].join(" ")}
                  >
                    {move}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}

function TiltingIphoneDashboard({ metrics }: { metrics: LandingMetrics }) {
  return (
    <div className="group relative mx-auto flex min-h-[590px] w-full items-center justify-center lg:min-h-[680px]">
      <div className="absolute h-[430px] w-[430px] rounded-full bg-[#d9ad52]/15 blur-3xl" />
      <div className="absolute bottom-8 left-6 hidden rounded-3xl bg-white p-4 shadow-[0_24px_70px_rgba(7,27,17,0.12)] lg:block">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">
          Live model
        </p>
        <p className="sg-data mt-1 text-2xl font-black text-[#072116]">
          {metrics.bullishPct}%
        </p>
        <p className="text-xs font-bold text-[#66746b]">{metrics.sentiment}</p>
      </div>

      <div className="absolute right-0 top-12 hidden rounded-3xl bg-white p-4 shadow-[0_24px_70px_rgba(7,27,17,0.12)] lg:block">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">
          Updated
        </p>
        <p className="sg-data mt-1 text-2xl font-black text-[#072116]">
          {metrics.lastUpdatedLabel.split(",")[0] ?? metrics.lastUpdatedLabel}
        </p>
        <p className="text-xs font-bold text-[#66746b]">latest model run</p>
      </div>

      <div className="sg-phone-transform relative rounded-[3.2rem] border-[11px] border-[#04180f] bg-[#04180f] shadow-[0_42px_100px_rgba(7,27,17,0.32)] transition duration-700 ease-out group-hover:rotate-0 group-hover:scale-[1.02] lg:rotate-[-8deg] lg:[transform:perspective(1200px)_rotateY(-18deg)_rotateZ(-6deg)] lg:group-hover:[transform:perspective(1200px)_rotateY(0deg)_rotateZ(0deg)]">
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-[#020806]" />
        <div className="overflow-hidden rounded-[2.35rem]">
          <RealDashboardScreen metrics={metrics} />
        </div>
      </div>
    </div>
  );
}

function RankingVisual() {
  return (
    <div className="relative">
      <div className="absolute -left-8 top-10 hidden h-52 w-52 rounded-full bg-[#0a2d1d]/8 blur-3xl lg:block" />

      <div className="overflow-hidden rounded-[2rem] border border-[#dfe5dc] bg-white shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
        <div className="grid gap-5 border-b border-[#edf0ea] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
              Rankings preview
            </p>
            <p className="sg-heading mt-1 text-3xl font-medium text-[#0a2d1d]">
              Top ranked stocks
            </p>
          </div>
          <div className="rounded-full bg-[#0a2d1d] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white">
            Free trial unlock
          </div>
        </div>

        <div className="hidden grid-cols-[52px_90px_minmax(0,1fr)_78px_82px] border-b border-[#edf0ea] bg-[#072116] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#faf6f0] sm:grid">
          <span>#</span>
          <span>Ticker</span>
          <span>Company</span>
          <span>Price</span>
          <span className="text-right">Score</span>
        </div>

        {dashboardRows.slice(0, 5).map((stock, index) => (
          <div
            key={stock.ticker}
            className="sg-rank-row grid grid-cols-[38px_minmax(0,1fr)_72px] items-center border-b border-[#edf0ea] px-4 py-4 sm:grid-cols-[52px_90px_minmax(0,1fr)_78px_82px]"
            style={{ animationDelay: `${index * 180}ms` }}
          >
            <span className="sg-data font-black text-[#b88a32]">{stock.rank}</span>
            <span className="sg-data hidden font-black text-[#072116] sm:block">
              {stock.ticker}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#072116]">
                {stock.company}
              </span>
              <span className="mt-1 flex items-center gap-2 text-xs font-bold text-[#66746b] sm:hidden">
                <span>{stock.ticker}</span>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px] font-black",
                    stock.moveUp
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                      : "border-red-500/25 bg-red-500/10 text-red-700",
                  ].join(" ")}
                >
                  {stock.move}
                </span>
              </span>
            </span>
            <span className="sg-data hidden text-sm font-bold text-[#072116]/72 sm:block">
              {stock.price}
            </span>
            <span className="flex justify-end">
              <span className="sg-data inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-1 text-xs font-black text-[#072116]">
                {stock.score}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockPageVisual() {
  return (
    <div className="relative">
      <div className="absolute -right-8 top-10 hidden h-60 w-60 rounded-full bg-[#d9ad52]/14 blur-3xl lg:block" />
      <div className="overflow-hidden rounded-[2rem] border border-[#dfe5dc] bg-white p-4 shadow-[0_28px_80px_rgba(7,27,17,0.08)] sm:p-5">
        <div className="rounded-[1.5rem] bg-[#061b12] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d9ad52]">
                Stock page
              </p>
              <h3 className="sg-heading mt-2 text-3xl font-medium">
                NVDA research view
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/55">
                Ranking context, market data, news impact and risk notes in one place.
              </p>
            </div>

            <div className="rounded-2xl border border-[#65e49c]/24 bg-[#65e49c]/10 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                Score
              </p>
              <p className="sg-data mt-1 text-3xl font-black text-[#65e49c]">
                9,214
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Momentum", "Strong"],
              ["Valuation", "Elevated"],
              ["News impact", "Relevant"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">
                  {label}
                </p>
                <p className="mt-2 font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d9ad52]">
              Research summary
            </p>
            <p className="mt-2 text-sm leading-7 text-white/62">
              NVDA ranks highly due to strong momentum, sector leadership and earnings
              strength. Main risks include valuation sensitivity and crowded sentiment.
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#072116]/55">
                Related news
              </p>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-700">
                High relevance
              </span>
            </div>
            <p className="mt-2 text-sm font-black">
              Chip demand pushes semiconductor names higher
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AskStockGPTVisual() {
  return (
    <div className="rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="mb-5 flex items-center justify-between border-b border-[#edf0ea] pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            Ask StockGPT
          </p>
          <p className="mt-1 text-lg font-black text-[#072116]">
            Research assistant preview
          </p>
        </div>
        <div className="h-3 w-3 rounded-full bg-emerald-500" />
      </div>

      <div className="sg-chat-loop min-h-[470px] space-y-4">
        <div className="sg-chat-bubble sg-chat-a max-w-[88%] rounded-[1.4rem] border border-[#dfe5dc] bg-[#fbfaf6] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#0a2d1d]">Investor</p>
            <p className="sg-data text-xs text-[#8a948d]">09:42</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#66746b]">
            Why is NVDA ranking above Microsoft this week?
          </p>
        </div>

        <div className="sg-chat-bubble sg-chat-b ml-auto max-w-[92%] rounded-[1.4rem] border border-[#0a2d1d]/12 bg-[#061b12] p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#d9ad52]">Ask StockGPT</p>
            <p className="sg-data text-xs text-white/40">09:42</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/68">
            NVDA is ranking higher due to stronger momentum, earnings revision strength
            and sector leadership. Microsoft remains high quality, but valuation and
            weaker short-term movement are weighing on its score.
          </p>
        </div>

        <div className="sg-chat-bubble sg-chat-c max-w-[88%] rounded-[1.4rem] border border-[#dfe5dc] bg-[#fbfaf6] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#0a2d1d]">Investor</p>
            <p className="sg-data text-xs text-[#8a948d]">09:43</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#66746b]">
            Is that a buy signal?
          </p>
        </div>

        <div className="sg-chat-bubble sg-chat-d ml-auto max-w-[92%] rounded-[1.4rem] border border-[#0a2d1d]/12 bg-[#061b12] p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#d9ad52]">Ask StockGPT</p>
            <p className="sg-data text-xs text-white/40">09:43</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/68">
            No. Treat it as a research prompt, not a recommendation. Check valuation,
            risk and whether it fits your portfolio before making a decision.
          </p>
        </div>
      </div>
    </div>
  );
}

function PortfolioVisual() {
  return (
    <div className="rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[#eef6ef] p-5">
        <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-[#0f9f5d]/18" />

        <div className="relative rounded-3xl bg-white p-5 shadow-[0_18px_50px_rgba(7,27,17,0.10)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            Portfolio
          </p>
          <p className="sg-data mt-2 text-4xl font-black text-[#0a2d1d]">
            £24,810.42
          </p>
          <p className="mt-1 text-sm font-black text-[#0f9f5d]">
            +£1,205.80 this month
          </p>

          <div className="mt-5 h-24 rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-3">
            <div className="sg-real-chart h-full rounded-xl" />
          </div>
        </div>

        <div className="relative mt-4 space-y-3">
          {[
            ["Technology exposure", "High concentration", "46%"],
            ["Weak-ranked holding", "Review suggested", "1"],
            ["Trading 212 CSV", "Import ready", "Ready"],
          ].map(([title, detail, value]) => (
            <div
              key={title}
              className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-[0_12px_34px_rgba(7,27,17,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-[#0a2d1d]">{title}</p>
                  <p className="mt-1 text-xs font-semibold text-[#66746b]">
                    {detail}
                  </p>
                </div>
                <p className="sg-data font-black text-[#d9ad52]">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewsVisual() {
  return (
    <div className="rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="space-y-3">
        {[
          ["Chip demand pushes semiconductor names higher", "NVDA · AMD · AVGO", "High relevance"],
          ["Banks react to rate outlook shift", "JPM · BAC · GS", "Medium relevance"],
          ["Cloud spending remains resilient", "MSFT · AMZN · GOOGL", "High relevance"],
        ].map(([title, tickers, tag]) => (
          <article
            key={title}
            className="rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">
                  Market news
                </p>
                <h3 className="mt-2 font-black text-[#0a2d1d]">{title}</h3>
                <p className="sg-data mt-2 text-xs font-black text-[#66746b]">
                  {tickers}
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#e8f7ee] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#0f9f5d]">
                {tag}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MobileBottomCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dfe5dc] bg-white/95 px-3 py-3 shadow-[0_-16px_40px_rgba(7,27,17,0.12)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-[#0a2d1d]">
            Try StockGPT free
          </p>
          <p className="truncate text-[11px] font-medium text-[#66746b]">
            Then £18.99/month. Cancel anytime.
          </p>
        </div>
        <CheckoutButton compact variant="green">
          Try free
        </CheckoutButton>
      </div>
    </div>
  );
}

export function LandingClient({ tickerTape, metrics }: LandingClientProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const handleScroll = () => {
      setNavScrolled(page.scrollTop > 18);
    };

    page.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      page.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const stockCountLabel =
    metrics.totalStocks > 0
      ? metrics.totalStocks.toLocaleString("en-GB")
      : "500+";

  return (
    <main
      ref={pageRef}
      className="sg-landing h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#fbfaf6] text-[#0a2d1d]"
    >
      <style>{`
        .sg-landing {
          --sg-green: #072116;
          --sg-green-dark: #04180f;
          --sg-soft: #fbfaf6;
          --sg-gold: #ddb159;
          --sg-muted: #66746b;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: #ddb159 #04180f;
          scrollbar-gutter: stable;
          overscroll-behavior: contain;
        }

        .sg-landing::-webkit-scrollbar {
          width: 13px;
        }

        .sg-landing::-webkit-scrollbar-track {
          background: linear-gradient(180deg, #04180f 0%, #072116 50%, #04180f 100%);
          border-left: 1px solid rgba(221,177,89,0.24);
        }

        .sg-landing::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #f0cf7a 0%, #ddb159 42%, #a7792f 100%);
          border: 3px solid #04180f;
          border-radius: 999px;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.32),
            0 0 14px rgba(221,177,89,0.28);
        }

        .sg-landing::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #f5d989 0%, #e8c36b 40%, #b98934 100%);
        }

        .sg-heading {
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: -0.035em;
        }

        .sg-data {
          font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
        }

        .sg-page-soft {
          background:
            radial-gradient(circle at 88% 14%, rgba(221,177,89,0.13), transparent 26%),
            radial-gradient(circle at 12% 18%, rgba(7,33,22,0.075), transparent 24%),
            linear-gradient(180deg, #fbfaf6 0%, #ffffff 46%, #f7f5ef 100%);
        }

        .sg-nav {
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: box-shadow 220ms ease, border-color 220ms ease, background-color 220ms ease;
        }

        .sg-nav-scrolled {
          box-shadow: 0 14px 34px rgba(7,27,17,0.18);
        }

        .sg-phone-transform {
          transform-origin: center;
        }

        .sg-phone-scroll {
          animation: sgPhoneScreenScroll 8s ease-in-out infinite;
        }

        .group:hover .sg-phone-scroll {
          animation-play-state: running;
        }

        .sg-rank-row {
          animation: sgRankSweep 6s ease-in-out infinite;
        }

        .sg-chat-bubble {
          opacity: 0;
          transform: translateY(10px);
          animation-duration: 9.5s;
          animation-iteration-count: infinite;
          animation-timing-function: ease;
        }

        .sg-chat-a { animation-name: sgChatA; }
        .sg-chat-b { animation-name: sgChatB; }
        .sg-chat-c { animation-name: sgChatC; }
        .sg-chat-d { animation-name: sgChatD; }

        .sg-real-chart {
          background:
            linear-gradient(135deg, transparent 8%, rgba(15,159,93,0.18) 8%, transparent 9%),
            linear-gradient(160deg, transparent 14%, rgba(15,159,93,0.28) 14%, transparent 15%),
            linear-gradient(145deg, transparent 28%, rgba(15,159,93,0.36) 28%, transparent 29%),
            linear-gradient(155deg, transparent 45%, rgba(15,159,93,0.50) 45%, transparent 46%),
            linear-gradient(145deg, transparent 62%, rgba(15,159,93,0.60) 62%, transparent 63%);
          border: 1px solid rgba(15,159,93,0.10);
        }

        .sg-marquee-track {
          animation: sgMarquee 34s linear infinite;
        }

        .sg-marquee-track:hover {
          animation-play-state: paused;
        }

        @keyframes sgPhoneScreenScroll {
          0%, 18% { transform: translateY(0); }
          45%, 68% { transform: translateY(-175px); }
          82%, 100% { transform: translateY(0); }
        }

        @keyframes sgRankSweep {
          0%, 100% { background: rgba(255,255,255,0); }
          45% { background: rgba(221,177,89,0.06); }
        }

        @keyframes sgChatA {
          0%, 8% { opacity: 0; transform: translateY(10px); }
          12%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgChatB {
          0%, 22% { opacity: 0; transform: translateY(10px); }
          27%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgChatC {
          0%, 43% { opacity: 0; transform: translateY(10px); }
          48%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgChatD {
          0%, 61% { opacity: 0; transform: translateY(10px); }
          66%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @media (max-width: 760px) {
          .sg-marquee-track {
            animation-duration: 24s;
          }

          .sg-landing {
            scrollbar-width: none;
          }

          .sg-landing::-webkit-scrollbar {
            width: 0;
            height: 0;
          }

          .sg-phone-scroll {
            animation: sgPhoneScreenScrollMobile 8s ease-in-out infinite;
          }

          @keyframes sgPhoneScreenScrollMobile {
            0%, 18% { transform: translateY(0); }
            45%, 68% { transform: translateY(-150px); }
            82%, 100% { transform: translateY(0); }
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-landing {
            scroll-behavior: auto;
          }

          .sg-phone-scroll,
          .sg-rank-row,
          .sg-chat-a,
          .sg-chat-b,
          .sg-chat-c,
          .sg-chat-d,
          .sg-marquee-track {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }

          .sg-phone-transform {
            transform: none !important;
          }
        }
      `}</style>

      <div className="sg-page-soft min-h-full pb-24 sm:pb-0">
        <header
          className={[
            "sg-nav fixed left-0 right-0 top-0 z-50 border-b border-[#ddb159]/18 bg-[#04180f]/96 text-white",
            navScrolled ? "sg-nav-scrolled" : "",
          ].join(" ")}
        >
          {showDisclaimer && (
            <div className="border-b border-white/10 bg-[#eef0ea] px-4 py-2 text-[#3f4c44]">
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
                <p className="text-center text-[11px] font-semibold leading-5 sm:text-xs">
                  StockGPT is a research and ranking tool. It does not provide financial
                  advice. Investing involves risk and you are responsible for your own
                  decisions.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDisclaimer(false)}
                  aria-label="Dismiss investment risk notice"
                  className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#3f4c44]/70 transition-colors hover:bg-[#dfe4dc] hover:text-[#0a2d1d] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d]"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-8">
            <Link
              href="/landing"
              className="relative h-10 w-[132px] shrink-0 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#04180f] sm:h-12 sm:w-[170px]"
              aria-label="StockGPT home"
            >
              <Image
                src="/logo.png"
                alt="StockGPT"
                fill
                priority
                className="object-contain object-left drop-shadow-[0_6px_14px_rgba(221,177,89,0.12)]"
                sizes="(max-width: 640px) 132px, 170px"
              />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <button
                  key={link.target}
                  type="button"
                  onClick={() => scrollToSection(link.target)}
                  className="rounded-full px-4 py-2 text-sm font-bold text-white/66 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                >
                  {link.label}
                </button>
              ))}

              <Link
                href="/affiliate"
                className="rounded-full px-4 py-2 text-sm font-bold text-white/66 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
              >
                Affiliate
              </Link>
            </nav>

            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/16 bg-white px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#04180f] transition-colors hover:bg-[#f6f2e8] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#04180f]"
              >
                Log in
              </Link>
              <CheckoutButton compact variant="gold">
                Try free today
              </CheckoutButton>
            </div>

            <div className="sm:hidden">
              <CheckoutButton compact variant="gold">
                Try free
              </CheckoutButton>
            </div>
          </div>
        </header>

        <section className="px-4 pt-[128px] sm:px-6 sm:pt-[150px] lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-[#d9ad52]/28 bg-[#fff8e6] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828] sm:text-[11px]">
                  Stock research platform
                </div>

                <h1 className="sg-heading mt-5 text-[43px] font-medium leading-[0.96] text-[#071b11] sm:mt-6 sm:text-[68px] lg:text-[82px]">
                  Start your stock research with structure.
                </h1>

                <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#4f5f55] sm:mt-6 sm:text-lg sm:leading-8">
                  StockGPT scans{" "}
                  <span className="sg-data font-black text-[#0a2d1d]">
                    {stockCountLabel}
                  </span>{" "}
                  US stocks, ranks opportunities by research priority, connects news
                  to tickers and gives your portfolio a clearer research workflow.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <CheckoutButton variant="green">Try free today</CheckoutButton>
                  <GhostButton onClick={() => scrollToSection("preview")}>
                    View preview
                  </GhostButton>
                </div>

                <p className="mt-4 max-w-lg text-xs leading-6 text-[#66746b]">
                  Free trial. Then £18.99/month unless cancelled. Informational
                  research only. Not financial advice.
                </p>
              </div>

              <TiltingIphoneDashboard metrics={metrics} />
            </div>

            <div className="mt-6 sm:mt-9">
              <TickerMarquee tickerTape={tickerTape} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [`${stockCountLabel}`, "US stocks scanned"],
                ["Daily", "ranking updates"],
                ["6 factors", "quality, growth, value, momentum, risk, income"],
                ["One workflow", "rankings, news, portfolio and research"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-[#dfe5dc] bg-white p-5 shadow-[0_14px_40px_rgba(7,27,17,0.05)]"
                >
                  <p className="sg-data text-3xl font-black text-[#0a2d1d]">
                    {value}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#66746b]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-32 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <SectionLabel>Product preview</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                The product does the selling.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#66746b]">
                The landing page now shows how StockGPT actually works: dashboard,
                rankings, stock pages, portfolio context, news and Ask StockGPT.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
              <div>
                <SectionLabel>Dashboard</SectionLabel>
                <h3 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-5xl">
                  A mobile-first view of your research workflow.
                </h3>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                  The hero preview now mirrors the real mobile dashboard structure:
                  stats, Top 10 rankings, market overview and movers.
                </p>
              </div>

              <div className="flex justify-center">
                <TiltingIphoneDashboard metrics={metrics} />
              </div>
            </div>
          </div>
        </section>

        <section id="rankings" className="scroll-mt-32 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div>
              <SectionLabel>Rankings</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Rank the market before you research.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                Start with a ranked research list instead of opening ten tabs and
                guessing where to begin. The full table unlocks during the free trial.
              </p>
            </div>

            <RankingVisual />
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <StockPageVisual />

            <div>
              <SectionLabel>Stock pages</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Go from a ranking to a research view.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                Each stock page gives users context around why a stock is appearing,
                what has changed, which news may matter and what risks deserve
                attention.
              </p>
            </div>
          </div>
        </section>

        <section id="ask" className="scroll-mt-32 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <SectionLabel>Ask StockGPT</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Ask questions like you would to an analyst.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                The messages now loop one by one, like a live product demo. It shows
                StockGPT being useful while staying clear that it is not giving
                financial advice.
              </p>
            </div>

            <AskStockGPTVisual />
          </div>
        </section>

        <section id="portfolio" className="scroll-mt-32 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <PortfolioVisual />

            <div>
              <SectionLabel>Portfolio</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                See how your holdings fit the wider market.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                Add holdings manually or import a CSV to compare your portfolio
                against StockGPT’s ranking model, sector exposure and weaker-ranked
                holdings.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div>
              <SectionLabel>Market news</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Turn headlines into ticker-level context.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                StockGPT connects relevant headlines back to stocks, sectors and
                portfolio exposure so users can see what may actually matter.
              </p>
            </div>

            <NewsVisual />
          </div>
        </section>

        <section id="pricing" className="scroll-mt-32 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-[#dfe5dc] bg-white p-6 shadow-[0_24px_70px_rgba(7,27,17,0.06)] sm:p-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <SectionLabel>Free trial</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Try the full research workflow before paying.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                Open the ranked table, explore stock pages, add portfolio context and
                test Ask StockGPT. Continue with Core if it earns a place in your
                workflow.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-[#0a2d1d]/10 bg-[#061b12] p-6 text-white shadow-[0_28px_80px_rgba(7,27,17,0.16)] sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="w-fit rounded-full border border-[#d9ad52]/30 bg-[#d9ad52]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#d9ad52]">
                  Core access
                </p>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                  Free trial available
                </p>
              </div>

              <div className="mt-7">
                <p className="text-sm font-semibold text-[#65e49c]">
                  Try free today
                </p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="sg-data text-5xl font-black text-white sm:text-6xl">
                    £18.99
                  </p>
                  <p className="pb-2 text-base font-semibold text-white/48">
                    / month after trial
                  </p>
                </div>
              </div>

              <ul className="mt-7 space-y-3.5 text-base font-semibold text-white">
                {pricingFeatures.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#65e49c]/34 bg-[#65e49c]/10 text-[11px] text-[#65e49c]">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <CheckoutButton full variant="gold">
                  Try free today
                </CheckoutButton>
              </div>

              <p className="mt-4 text-xs leading-6 text-white/42">
                Subscription continues at £18.99/month after the trial unless
                cancelled. Informational research only. Not financial advice.
              </p>

              <form
                action="/api/premium-waitlist"
                method="post"
                className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"
              >
                <p className="text-sm font-semibold text-white/55">
                  Executive tier coming soon — join the waitlist.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <label className="sr-only" htmlFor="executive-email">
                    Email address
                  </label>
                  <input
                    id="executive-email"
                    name="email"
                    type="email"
                    required
                    placeholder="Email address"
                    className="min-h-11 flex-1 rounded-full border border-white/[0.1] bg-[#03140c] px-4 text-sm font-semibold text-white outline-none transition-colors placeholder:text-white/34 focus:border-[#d9ad52]/60 focus:ring-2 focus:ring-[#d9ad52]/35"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-[#d9ad52]/45 px-5 py-3 text-sm font-bold text-[#d9ad52] transition-colors hover:bg-[#d9ad52]/8 focus:outline-none focus:ring-2 focus:ring-[#d9ad52] focus:ring-offset-2 focus:ring-offset-[#061b12]"
                  >
                    Join
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-[#d9ad52]/18 bg-[#fff8e6] p-6 sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <SectionLabel>Affiliate program</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Earn with StockGPT.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#66746b]">
                Apply to partner with StockGPT and earn commission on approved
                subscriber referrals. Built for investors, creators and finance
                communities.
              </p>
            </div>

            <div className="rounded-3xl border border-[#d9ad52]/24 bg-white p-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a6828]">
                Creator partner route
              </p>
              <p className="mt-3 text-sm leading-7 text-[#66746b]">
                The dedicated affiliate page collects applications directly.
              </p>
              <Link
                href="/affiliate"
                className="mt-6 inline-flex w-full justify-center rounded-full border border-[#0a2d1d]/20 bg-[#0a2d1d] px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#0f3a27] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d] focus:ring-offset-2 focus:ring-offset-white sm:w-auto"
              >
                Become an affiliate
              </Link>
            </div>
          </div>
        </section>

        <footer className="bg-[#061b12] px-4 py-10 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.15fr_1fr_1fr]">
            <div>
              <div className="relative h-12 w-[170px]">
                <Image
                  src="/logo.png"
                  alt="StockGPT"
                  fill
                  className="object-contain object-left"
                  sizes="170px"
                />
              </div>

              <p className="mt-5 max-w-sm text-sm leading-7 text-white/52">
                Stock rankings, portfolio tools and market intelligence for investors
                who want a clearer research process.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href === "#" ? undefined : "_blank"}
                    rel={link.href === "#" ? undefined : "noreferrer"}
                    aria-label={link.label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/70 transition-colors hover:border-[#d9ad52]/60 hover:text-[#d9ad52] focus:outline-none focus:ring-2 focus:ring-[#d9ad52] focus:ring-offset-2 focus:ring-offset-[#061b12]"
                  >
                    <SocialIcon label={link.label} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#d9ad52]">
                Platform
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-white/55">
                <Link href="/dashboard" className="transition-colors hover:text-[#d9ad52]">
                  Dashboard
                </Link>
                <Link href="/rankings" className="transition-colors hover:text-[#d9ad52]">
                  Rankings
                </Link>
                <Link href="/portfolio" className="transition-colors hover:text-[#d9ad52]">
                  Portfolio
                </Link>
                <Link href="/world-news" className="transition-colors hover:text-[#d9ad52]">
                  News
                </Link>
                <Link href="/pricing" className="transition-colors hover:text-[#d9ad52]">
                  Pricing
                </Link>
                <Link href="/affiliate" className="transition-colors hover:text-[#d9ad52]">
                  Affiliate
                </Link>
                <Link href="/about" className="transition-colors hover:text-[#d9ad52]">
                  About
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#d9ad52]">
                Access
              </p>
              <div className="space-y-3 text-sm font-semibold text-white/55">
                <Link href="/login" className="block transition-colors hover:text-[#d9ad52]">
                  Log in
                </Link>
                <Link href="/affiliate" className="block transition-colors hover:text-[#d9ad52]">
                  Apply as affiliate
                </Link>
                <Link href="/pricing" className="block transition-colors hover:text-[#d9ad52]">
                  Subscription
                </Link>
              </div>

              <div className="mt-5">
                <LegalFooterLinks className="text-white/50" />
              </div>
            </div>

            <div className="border-t border-white/[0.08] pt-5 md:col-span-3">
              <p className="text-[11px] leading-6 text-white/42">
                StockGPT is a research and ranking tool. All content is for
                informational and educational purposes only. Nothing on this platform
                constitutes financial advice, investment advice, or a recommendation
                to buy or sell any security. Always conduct your own research and
                consult a qualified financial professional before making investment
                decisions. Past performance of rankings or examples is not indicative
                of future results.
              </p>
            </div>
          </div>
        </footer>

        <MobileBottomCta />
      </div>
    </main>
  );
}
