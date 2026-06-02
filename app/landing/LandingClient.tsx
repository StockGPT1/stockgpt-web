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
    href: "https://x.com/stockgptpro",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@stockgptai?is_from_webapp=1&sender_device=pc",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/stockgptpro/",
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

function toneClass(value: number | null) {
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
  dark = false,
}: {
  children?: React.ReactNode;
  full?: boolean;
  compact?: boolean;
  dark?: boolean;
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
          "inline-flex items-center justify-center rounded-full font-bold uppercase tracking-[0.12em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
          full ? "w-full" : "max-sm:w-full",
          compact ? "min-h-10 px-4 py-2 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
          dark
            ? "border border-[#0a2d1d] bg-[#0a2d1d] text-white hover:bg-[#0f3a27] focus:ring-[#0a2d1d] focus:ring-offset-white"
            : "border border-[#d9ad52] bg-[#d9ad52] text-[#071b11] shadow-[0_14px_34px_rgba(7,27,17,0.16)] hover:bg-[#e8c36b] focus:ring-[#d9ad52] focus:ring-offset-white",
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
        "inline-flex items-center justify-center rounded-full border border-[#0a2d1d]/20 bg-white font-bold uppercase tracking-[0.12em] text-[#0a2d1d] transition-colors duration-200 hover:border-[#0a2d1d]/36 hover:bg-[#f2f4ef] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d] focus:ring-offset-2 focus:ring-offset-white max-sm:w-full",
        compact ? "min-h-10 px-4 py-2 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex rounded-full border border-[#d9ad52]/26 bg-[#fff8e6] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a6828]">
      {children}
    </p>
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
            <span className={["sg-data", toneClass(item.changePct)].join(" ")}>
              {formatMove(item.changePct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardMockup({ metrics }: { metrics: LandingMetrics }) {
  const rows = [
    ["01", "NVDA", "Technology", "92", "+2.6%", "Locked"],
    ["02", "MSFT", "Technology", "89", "+0.4%", "Locked"],
    ["03", "JPM", "Financials", "86", "+1.1%", "Locked"],
    ["04", "AMZN", "Consumer", "84", "-0.2%", "Locked"],
    ["05", "AAPL", "Technology", "81", "+0.8%", "Locked"],
  ];

  return (
    <div className="sg-visual-card overflow-hidden rounded-[2rem] border border-[#d9ad52]/28 bg-[#061b12] shadow-[0_34px_90px_rgba(7,27,17,0.22)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d9ad52]">
            StockGPT dashboard
          </p>
          <p className="sg-heading mt-1 text-2xl font-medium text-white">
            Ranked market view
          </p>
        </div>

        <div className="hidden rounded-full border border-[#31d17b]/25 bg-[#31d17b]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#65e49c] sm:block">
          Member preview
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
            Stocks scanned
          </p>
          <p className="sg-data mt-2 text-2xl font-bold text-[#d9ad52]">
            {metrics.totalStocks > 0 ? metrics.totalStocks.toLocaleString("en-GB") : "500+"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
            Market read
          </p>
          <p className="mt-2 text-2xl font-bold text-[#65e49c]">
            {metrics.sentiment}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
            Updated
          </p>
          <p className="sg-data mt-2 text-2xl font-bold text-white">
            {metrics.lastUpdatedLabel.split(",")[0] ?? metrics.lastUpdatedLabel}
          </p>
        </div>
      </div>

      <div className="px-4 pb-5 sm:px-5">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[42px_minmax(0,1fr)_68px] bg-white/[0.05] px-3 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45 md:grid-cols-[52px_90px_minmax(0,1fr)_70px_76px_70px]">
            <span>#</span>
            <span className="hidden md:block">Ticker</span>
            <span>Context</span>
            <span className="hidden md:block">Score</span>
            <span className="hidden md:block">Move</span>
            <span className="text-right md:text-left">Access</span>
          </div>

          {rows.map(([rank, ticker, sector, score, move, access], index) => (
            <div
              key={ticker}
              className="sg-row-motion grid grid-cols-[42px_minmax(0,1fr)_68px] items-center border-t border-white/[0.07] px-3 py-3 md:grid-cols-[52px_90px_minmax(0,1fr)_70px_76px_70px]"
              style={{ animationDelay: `${index * 160}ms` }}
            >
              <span className="sg-data text-sm font-bold text-[#d9ad52]">
                {rank}
              </span>
              <span className="sg-data hidden text-sm font-bold text-white md:block">
                {ticker}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  Ranked stock hidden
                </span>
                <span className="block truncate text-[10px] font-medium text-white/42">
                  {sector} · reasoning available inside
                </span>
              </span>
              <span className="sg-data hidden text-sm font-bold text-[#65e49c] md:block">
                {score}
              </span>
              <span className="sg-data hidden text-sm font-bold text-white/50 md:block">
                {move}
              </span>
              <span className="sg-data text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[#65e49c] md:text-left">
                {access}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhoneMockup({ metrics }: { metrics: LandingMetrics }) {
  return (
    <div className="sg-phone-float mx-auto w-full max-w-[330px] rounded-[2.8rem] border-[10px] border-[#061b12] bg-[#061b12] shadow-[0_30px_80px_rgba(7,27,17,0.22)]">
      <div className="overflow-hidden rounded-[2.1rem] bg-[#fbfaf6]">
        <div className="flex items-center justify-between bg-[#061b12] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9ad52]">
              StockGPT
            </p>
            <p className="mt-1 text-sm font-bold">Today’s research list</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-[#d9ad52]" />
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-3xl border border-[#e3e8df] bg-white p-4 shadow-[0_12px_30px_rgba(7,27,17,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c766e]">
              Market read
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0a2d1d]">
              {metrics.sentiment}
            </p>
            <div className="mt-4 h-2 rounded-full bg-[#edf0ea]">
              <div className="sg-bar-fill h-2 rounded-full bg-[#0f9f5d]" />
            </div>
          </div>

          {["Rank #01", "Rank #02", "Rank #03"].map((rank, index) => (
            <div
              key={rank}
              className="rounded-2xl border border-[#e3e8df] bg-white p-4 shadow-[0_10px_26px_rgba(7,27,17,0.05)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="sg-data text-xs font-bold text-[#d9ad52]">
                    {rank}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#0a2d1d]">
                    Stock hidden
                  </p>
                  <p className="mt-1 text-[11px] text-[#6d776f]">
                    Score and reasoning inside
                  </p>
                </div>
                <div className="rounded-full bg-[#e8f7ee] px-3 py-1 text-[10px] font-bold text-[#0f9f5d]">
                  Locked
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[#edf0ea]">
                <div
                  className="h-1.5 rounded-full bg-[#d9ad52]"
                  style={{ width: `${86 - index * 10}%` }}
                />
              </div>
            </div>
          ))}

          <button className="w-full rounded-full bg-[#d9ad52] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#061b12]">
            Try free today
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroVisual({ metrics }: { metrics: LandingMetrics }) {
  return (
    <div className="relative">
      <div className="absolute -right-8 top-6 hidden h-52 w-52 rounded-full bg-[#d9ad52]/16 blur-3xl lg:block" />
      <div className="hidden lg:block">
        <DashboardMockup metrics={metrics} />
      </div>
      <div className="lg:hidden">
        <PhoneMockup metrics={metrics} />
      </div>
    </div>
  );
}

function RankingSectionVisual() {
  const rows = [
    ["01", "NVDA", "Technology", "92", "+2.6%"],
    ["02", "MSFT", "Technology", "89", "+0.4%"],
    ["03", "JPM", "Financials", "86", "+1.1%"],
    ["04", "AMZN", "Consumer", "84", "-0.2%"],
  ];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#dfe5dc] bg-white shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="border-b border-[#edf0ea] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6828]">
          Rankings preview
        </p>
        <p className="sg-heading mt-1 text-3xl font-medium text-[#0a2d1d]">
          Rank the market before researching.
        </p>
      </div>

      <div className="grid grid-cols-[44px_80px_minmax(0,1fr)_58px] border-b border-[#edf0ea] bg-[#fbfaf6] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d776f] sm:grid-cols-[52px_90px_minmax(0,1fr)_70px_78px]">
        <span>#</span>
        <span>Ticker</span>
        <span>Sector</span>
        <span>Score</span>
        <span className="hidden sm:block">Move</span>
      </div>

      {rows.map(([rank, ticker, sector, score, move]) => (
        <div
          key={ticker}
          className="grid grid-cols-[44px_80px_minmax(0,1fr)_58px] items-center border-b border-[#edf0ea] px-4 py-4 text-sm sm:grid-cols-[52px_90px_minmax(0,1fr)_70px_78px]"
        >
          <span className="sg-data font-bold text-[#d9ad52]">{rank}</span>
          <span className="sg-data font-bold text-[#0a2d1d]">{ticker}</span>
          <span className="truncate text-[#66746b]">{sector}</span>
          <span className="sg-data font-bold text-[#0f9f5d]">{score}</span>
          <span className="sg-data hidden font-bold text-[#66746b] sm:block">
            {move}
          </span>
        </div>
      ))}

      <div className="grid gap-3 bg-[#fbfaf6] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-bold text-[#0a2d1d]">Full list available inside.</p>
          <p className="mt-1 text-sm leading-6 text-[#66746b]">
            Members see all tickers, scores, movements and stock pages.
          </p>
        </div>
        <CheckoutButton compact dark>
          Unlock rankings
        </CheckoutButton>
      </div>
    </div>
  );
}

function StockPageVisual() {
  return (
    <div className="rounded-[2rem] border border-[#dfe5dc] bg-white p-4 shadow-[0_28px_80px_rgba(7,27,17,0.08)] sm:p-5">
      <div className="rounded-[1.5rem] bg-[#061b12] p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9ad52]">
              Stock page
            </p>
            <h3 className="sg-heading mt-2 text-3xl font-medium">NVDA research view</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/55">
              Ranking context, market data, news impact and risk notes in one place.
            </p>
          </div>
          <div className="rounded-2xl border border-[#65e49c]/24 bg-[#65e49c]/10 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">
              Score
            </p>
            <p className="sg-data mt-1 text-3xl font-bold text-[#65e49c]">92</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Momentum", "Strong"],
            ["Valuation", "Elevated"],
            ["News impact", "Relevant"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                {label}
              </p>
              <p className="mt-2 font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d9ad52]">
            Research summary
          </p>
          <p className="mt-2 text-sm leading-7 text-white/62">
            NVDA ranks highly due to strong momentum, sector leadership and earnings
            strength. The main risk is valuation sensitivity if growth expectations
            weaken.
          </p>
        </div>
      </div>
    </div>
  );
}

function AskStockGPTVisual() {
  return (
    <div className="rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="space-y-4">
        <div className="sg-chat-one max-w-[88%] rounded-[1.4rem] border border-[#dfe5dc] bg-[#fbfaf6] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-bold text-[#0a2d1d]">Investor</p>
            <p className="sg-data text-xs text-[#8a948d]">09:42</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#66746b]">
            Why is NVDA ranking above Microsoft this week?
          </p>
        </div>

        <div className="sg-chat-two ml-auto max-w-[92%] rounded-[1.4rem] border border-[#0a2d1d]/12 bg-[#061b12] p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="font-bold text-[#d9ad52]">Ask StockGPT</p>
            <p className="sg-data text-xs text-white/40">09:42</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/68">
            NVDA is ranking higher due to stronger momentum, earnings revision strength
            and sector leadership. Microsoft remains high quality, but its short-term
            ranking is being held back by valuation and weaker movement.
          </p>
        </div>

        <div className="sg-chat-three max-w-[88%] rounded-[1.4rem] border border-[#dfe5dc] bg-[#fbfaf6] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-bold text-[#0a2d1d]">Investor</p>
            <p className="sg-data text-xs text-[#8a948d]">09:43</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#66746b]">
            Is that a buy signal?
          </p>
        </div>

        <div className="sg-chat-four ml-auto max-w-[92%] rounded-[1.4rem] border border-[#0a2d1d]/12 bg-[#061b12] p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="font-bold text-[#d9ad52]">Ask StockGPT</p>
            <p className="sg-data text-xs text-white/40">09:43</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/68">
            No. Treat it as a research prompt, not a recommendation. Check valuation,
            risks and whether it fits your portfolio before making any decision.
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6828]">
            Portfolio
          </p>
          <p className="sg-data mt-2 text-4xl font-bold text-[#0a2d1d]">£24,810.42</p>
          <p className="mt-1 text-sm font-bold text-[#0f9f5d]">+£1,205.80 this month</p>

          <div className="mt-5 h-24 rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-3">
            <div className="sg-chart-line h-full rounded-xl" />
          </div>
        </div>

        <div className="relative mt-4 space-y-3">
          {[
            ["Technology", "High exposure", "46%"],
            ["Weak-ranked holding", "Review suggested", "1"],
            ["CSV import", "Trading 212 ready", "Ready"],
          ].map(([title, detail, value]) => (
            <div
              key={title}
              className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-[0_12px_34px_rgba(7,27,17,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-[#0a2d1d]">{title}</p>
                  <p className="mt-1 text-xs text-[#66746b]">{detail}</p>
                </div>
                <p className="sg-data font-bold text-[#d9ad52]">{value}</p>
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
          <article key={title} className="rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6828]">
                  Market news
                </p>
                <h3 className="mt-2 font-bold text-[#0a2d1d]">{title}</h3>
                <p className="sg-data mt-2 text-xs font-bold text-[#66746b]">
                  {tickers}
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#e8f7ee] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0f9f5d]">
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
          <p className="truncate text-xs font-bold text-[#0a2d1d]">
            Try StockGPT free
          </p>
          <p className="truncate text-[11px] font-medium text-[#66746b]">
            Then £18.99/month. Cancel anytime.
          </p>
        </div>
        <CheckoutButton compact dark>
          Try free
        </CheckoutButton>
      </div>
    </div>
  );
}

export function LandingClient({ tickerTape, metrics }: LandingClientProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);

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
          --sg-green: #0a2d1d;
          --sg-soft: #fbfaf6;
          --sg-gold: #d9ad52;
          --sg-muted: #66746b;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: #d9ad52 #f3efe5;
          scrollbar-gutter: stable;
          overscroll-behavior: contain;
        }

        .sg-landing::-webkit-scrollbar {
          width: 13px;
        }

        .sg-landing::-webkit-scrollbar-track {
          background: linear-gradient(180deg, #f6f2e8 0%, #fbfaf6 50%, #f6f2e8 100%);
          border-left: 1px solid rgba(10,45,29,0.08);
        }

        .sg-landing::-webkit-scrollbar-thumb {
          background:
            linear-gradient(180deg, #f0cf7a 0%, #d9ad52 42%, #a7792f 100%);
          border: 3px solid #f6f2e8;
          border-radius: 999px;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.38),
            0 0 14px rgba(217,173,82,0.26);
        }

        .sg-landing::-webkit-scrollbar-thumb:hover {
          background:
            linear-gradient(180deg, #f5d989 0%, #e8c36b 40%, #b98934 100%);
        }

        .sg-heading {
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: -0.032em;
        }

        .sg-data {
          font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
        }

        .sg-nav {
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: box-shadow 220ms ease, border-color 220ms ease, background-color 220ms ease;
        }

        .sg-nav-scrolled {
          border-bottom-color: rgba(10,45,29,0.12);
          background: rgba(255,255,255,0.96);
          box-shadow: 0 14px 34px rgba(7,27,17,0.08);
        }

        .sg-page-soft {
          background:
            radial-gradient(circle at 86% 14%, rgba(217,173,82,0.16), transparent 26%),
            radial-gradient(circle at 12% 18%, rgba(10,45,29,0.08), transparent 24%),
            linear-gradient(180deg, #fbfaf6 0%, #ffffff 46%, #f7f5ef 100%);
        }

        .sg-visual-card {
          transform: translateZ(0);
        }

        .sg-phone-float {
          animation: sgPhoneFloat 7s ease-in-out infinite;
        }

        .sg-row-motion {
          animation: sgRowPulse 5.5s ease-in-out infinite;
        }

        .sg-bar-fill {
          width: 72%;
          animation: sgBarFill 2.2s ease-out both;
        }

        .sg-chat-one,
        .sg-chat-two,
        .sg-chat-three,
        .sg-chat-four {
          opacity: 0;
          transform: translateY(10px);
          animation: sgChatIn 700ms ease forwards;
        }

        .sg-chat-two { animation-delay: 220ms; }
        .sg-chat-three { animation-delay: 440ms; }
        .sg-chat-four { animation-delay: 660ms; }

        .sg-chart-line {
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

        @keyframes sgPhoneFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }

        @keyframes sgRowPulse {
          0%, 100% { background: rgba(255,255,255,0.00); }
          45% { background: rgba(217,173,82,0.045); }
        }

        @keyframes sgBarFill {
          from { width: 0%; }
          to { width: 72%; }
        }

        @keyframes sgChatIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-landing {
            scroll-behavior: auto;
          }

          .sg-phone-float,
          .sg-row-motion,
          .sg-bar-fill,
          .sg-chat-one,
          .sg-chat-two,
          .sg-chat-three,
          .sg-chat-four,
          .sg-marquee-track {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="sg-page-soft min-h-full pb-24 sm:pb-0">
        <header
          className={[
            "sg-nav fixed left-0 right-0 top-0 z-50 border-b border-transparent bg-white/88",
            navScrolled ? "sg-nav-scrolled" : "",
          ].join(" ")}
        >
          <div className="border-b border-[#0a2d1d]/8 bg-[#eef0ea] px-4 py-2 text-center text-[11px] font-medium leading-5 text-[#3f4c44] sm:text-xs">
            StockGPT is a research and ranking tool. It does not provide financial
            advice. Investing involves risk and you are responsible for your own
            decisions.
          </div>

          <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-8">
            <Link
              href="/landing"
              className="relative h-10 w-[132px] shrink-0 focus:outline-none focus:ring-2 focus:ring-[#d9ad52] focus:ring-offset-2 focus:ring-offset-white sm:h-12 sm:w-[170px]"
              aria-label="StockGPT home"
            >
              <Image
                src="/logo.png"
                alt="StockGPT"
                fill
                priority
                className="object-contain object-left"
                sizes="(max-width: 640px) 132px, 170px"
              />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <button
                  key={link.target}
                  type="button"
                  onClick={() => scrollToSection(link.target)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-[#0a2d1d]/68 transition-colors hover:bg-[#f2f4ef] hover:text-[#0a2d1d] focus:outline-none focus:ring-2 focus:ring-[#d9ad52]"
                >
                  {link.label}
                </button>
              ))}

              <Link
                href="/affiliate"
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#0a2d1d]/68 transition-colors hover:bg-[#f2f4ef] hover:text-[#0a2d1d] focus:outline-none focus:ring-2 focus:ring-[#d9ad52]"
              >
                Affiliate
              </Link>
            </nav>

            <div className="hidden items-center gap-3 sm:flex">
              <GhostButton href="/login" compact>
                Log in
              </GhostButton>
              <CheckoutButton compact dark>
                Try free today
              </CheckoutButton>
            </div>

            <div className="sm:hidden">
              <CheckoutButton compact dark>
                Try free
              </CheckoutButton>
            </div>
          </div>
        </header>

        <section className="px-4 pt-[128px] sm:px-6 sm:pt-[150px] lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-[#d9ad52]/28 bg-[#fff8e6] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6828] sm:text-[11px]">
                  Stock research platform
                </div>

                <h1 className="sg-heading mt-5 text-[43px] font-medium leading-[0.96] text-[#071b11] sm:mt-6 sm:text-[68px] lg:text-[82px]">
                  Start your stock research with structure.
                </h1>

                <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#4f5f55] sm:mt-6 sm:text-lg sm:leading-8">
                  StockGPT scans{" "}
                  <span className="sg-data font-bold text-[#0a2d1d]">
                    {stockCountLabel}
                  </span>{" "}
                  US stocks, ranks opportunities by research priority, connects news
                  to tickers and gives your portfolio a clearer research workflow.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <CheckoutButton dark>Try free today</CheckoutButton>
                  <button
                    type="button"
                    onClick={() => scrollToSection("preview")}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#0a2d1d]/20 bg-white px-7 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#0a2d1d] transition-colors hover:bg-[#f2f4ef] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d] focus:ring-offset-2 focus:ring-offset-white max-sm:w-full"
                  >
                    View preview
                  </button>
                </div>

                <p className="mt-4 max-w-lg text-xs leading-6 text-[#66746b]">
                  Free trial. Then £18.99/month unless cancelled. Informational
                  research only. Not financial advice.
                </p>
              </div>

              <HeroVisual metrics={metrics} />
            </div>

            <div className="mt-9">
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
                  <p className="sg-data text-3xl font-bold text-[#0a2d1d]">
                    {value}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#66746b]">
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
                The product is the landing page.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#66746b]">
                Instead of hiding behind vague AI copy, the page shows how StockGPT
                actually helps: rankings, stock research, portfolio context, news and
                plain-English answers.
              </p>
            </div>

            <DashboardMockup metrics={metrics} />
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

            <RankingSectionVisual />
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
                Users can ask about rankings, stock pages, news, portfolio exposure
                and investing concepts in plain English. The assistant should remain
                useful without pretending to be a financial adviser.
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
                against the StockGPT ranking model, sector exposure and weaker-ranked
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

        <section id="method" className="scroll-mt-32 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#dfe5dc] bg-white p-6 shadow-[0_24px_70px_rgba(7,27,17,0.06)] sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
              <div>
                <SectionLabel>Methodology</SectionLabel>
                <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                  Built for research, not blind signals.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                  The ranking model is designed to help prioritise research. It is
                  not a guarantee, signal service or financial adviser.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {["Quality", "Growth", "Value", "Momentum", "Risk", "Income"].map(
                  (factor) => (
                    <div
                      key={factor}
                      className="rounded-3xl border border-[#dfe5dc] bg-[#fbfaf6] p-5"
                    >
                      <p className="font-bold text-[#0a2d1d]">{factor}</p>
                      <div className="mt-4 h-2 rounded-full bg-[#e6ebe4]">
                        <div className="h-2 w-3/4 rounded-full bg-[#d9ad52]" />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
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
                <p className="w-fit rounded-full border border-[#d9ad52]/30 bg-[#d9ad52]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d9ad52]">
                  Core access
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                  Free trial available
                </p>
              </div>

              <div className="mt-7">
                <p className="text-sm font-semibold text-[#65e49c]">
                  Try free today
                </p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="sg-data text-5xl font-bold text-white sm:text-6xl">
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
                <CheckoutButton full>Try free today</CheckoutButton>
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
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8a6828]">
                Creator partner route
              </p>
              <p className="mt-3 text-sm leading-7 text-[#66746b]">
                The dedicated affiliate page collects applications directly.
              </p>
              <Link
                href="/affiliate"
                className="mt-6 inline-flex w-full justify-center rounded-full border border-[#0a2d1d]/20 bg-[#0a2d1d] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#0f3a27] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d] focus:ring-offset-2 focus:ring-offset-white sm:w-auto"
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
                    className="inline-flex h-10 items-center justify-center rounded-full border border-white/12 px-4 text-xs font-bold uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-[#d9ad52]/60 hover:text-[#d9ad52] focus:outline-none focus:ring-2 focus:ring-[#d9ad52] focus:ring-offset-2 focus:ring-offset-[#061b12]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#d9ad52]">
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
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#d9ad52]">
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
