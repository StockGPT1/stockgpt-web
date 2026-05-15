"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";
import { StockLogo } from "@/components/StockLogo";

export type LandingRanking = {
  id: string;
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  price: number | null;
  score: number | null;
  movePct: number | null;
  updatedAt: string | null;
  locked: boolean;
};

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
  rankings: LandingRanking[];
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
    title: "AI Stock Rankings",
    copy:
      "Every trading day, StockGPT scores the market across quality, growth, valuation, momentum, risk and income. The result is a ranked list that tells you where the strongest opportunities sit.",
  },
  {
    id: "portfolio",
    icon: "✦",
    title: "AI Portfolio Builder",
    copy:
      "Add your holdings and let the AI evaluate them against the ranking engine. See when a position weakens, where capital may be better allocated, and how risk is changing across your portfolio.",
  },
  {
    id: "news",
    icon: "◈",
    title: "AI Chatbot & Market News",
    copy:
      "Ask StockGPT about a stock, sector or portfolio. Get instant summaries of world news and market impact, filtered and ranked without the noise.",
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
    copy: "Each stock is assessed across factor groups including Quality, Growth, Value, Momentum, Risk and Income.",
  },
  {
    title: "Risk-filter",
    copy: "Fragile, overextended or debt-stressed companies are penalised before the final ranking is shown.",
  },
  {
    title: "Rank & Deliver",
    copy: "The final ranked list is delivered with AI summaries, portfolio context, news and research tools.",
  },
];

const navLinks = [
  { label: "Rankings", href: "#rankings-preview" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "News", href: "#news" },
  { label: "Pricing", href: "#pricing" },
  { label: "Affiliate", href: "/affiliate" },
];

const sparkStyles = [
  { left: "8%", top: "20%", delay: "0s", duration: "9s" },
  { left: "18%", top: "62%", delay: "1.8s", duration: "11s" },
  { left: "34%", top: "16%", delay: "0.7s", duration: "10s" },
  { left: "49%", top: "70%", delay: "2.4s", duration: "12s" },
  { left: "63%", top: "24%", delay: "1.1s", duration: "9.5s" },
  { left: "77%", top: "58%", delay: "3.2s", duration: "13s" },
  { left: "88%", top: "18%", delay: "2s", duration: "10.8s" },
  { left: "92%", top: "78%", delay: "4s", duration: "14s" },
];

const candleStyles = [
  { left: "10%", top: "28%", height: "44px", delay: "0.2s" },
  { left: "22%", top: "15%", height: "68px", delay: "1.5s" },
  { left: "36%", top: "42%", height: "52px", delay: "0.8s" },
  { left: "52%", top: "25%", height: "74px", delay: "2.1s" },
  { left: "66%", top: "54%", height: "46px", delay: "1.1s" },
  { left: "82%", top: "22%", height: "64px", delay: "2.8s" },
];

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-GB");
}

function formatMove(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#94a3b8]";
  if (value > 0) return "text-[#00ff88]";
  if (value < 0) return "text-red-300";
  return "text-[#94a3b8]";
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
          "group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[#00ff88] font-black uppercase tracking-[0.16em] text-[#03140c] shadow-[0_18px_52px_rgba(0,255,136,0.20)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,255,136,0.34)] active:translate-y-0",
          full ? "w-full" : "max-sm:w-full",
          compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
        ].join(" ")}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-700 group-hover:translate-x-full" />
        <span className="relative z-10">
          {children}{" "}
          <span className="inline-block transition group-hover:translate-x-1">
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
        "inline-flex items-center justify-center rounded-full border border-[#D4AF37]/50 bg-white/[0.03] font-black uppercase tracking-[0.16em] text-[#e8f5e9] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] max-sm:w-full",
        compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.08)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.8)]" />
      {children}
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
      <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-bold text-[#94a3b8] backdrop-blur sm:mt-8">
        Live ticker data is loading from the market feed.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#D4AF37]/18 bg-white/[0.035] py-3 shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur sm:mt-8">
      <div className="sg-marquee-track flex w-max items-center gap-3">
        {repeated.map((item, index) => (
          <Link
            key={`${item.yahooSymbol}-${index}`}
            href={
              item.yahooSymbol.startsWith("^")
                ? "/"
                : `/stocks/${encodeURIComponent(item.yahooSymbol)}`
            }
            className="group flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#06180f]/80 px-3 py-2 text-xs font-black text-[#e8f5e9] transition hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/10"
          >
            <span className="sg-data text-[#e8f5e9]">{item.symbol}</span>
            <span className="sg-data text-[#94a3b8]">
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

function DashboardPreview({
  rankings,
  metrics,
}: {
  rankings: LandingRanking[];
  metrics: LandingMetrics;
}) {
  return (
    <div
      id="rankings-preview"
      className="sg-monitor sg-reveal relative scroll-mt-28 overflow-hidden rounded-[1.5rem] border border-[#D4AF37]/24 bg-[#06180f]/86 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_40px_130px_rgba(0,0,0,0.58),0_0_90px_rgba(212,175,55,0.12)] backdrop-blur-xl sm:rounded-[2rem] sm:p-3"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(212,175,55,0.14),transparent_28%),radial-gradient(circle_at_18%_8%,rgba(0,255,136,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.045),transparent_42%)]" />

      <div className="relative overflow-hidden rounded-[1.2rem] border border-white/[0.08] bg-[#03140c]/92 sm:rounded-[1.55rem]">
        <div className="flex flex-col gap-3 border-b border-white/[0.08] p-3 sm:gap-4 sm:p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#D4AF37] sm:text-[10px]">
              ✦ Live AI Rankings
            </p>
            <h2 className="sg-heading mt-1 text-2xl font-black text-[#e8f5e9] sm:text-3xl">
              Top Ranked Stocks
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#00ff88]/25 bg-[#00ff88]/8 px-3 py-1.5 text-[10px] font-black text-[#00ff88] sm:text-[11px]">
              Bullish: {metrics.bullishPct}% — {metrics.sentiment}
            </span>
            <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/8 px-3 py-1.5 text-[10px] font-bold text-[#D4AF37] sm:text-[11px]">
              Updated: {metrics.lastUpdatedLabel}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="grid grid-cols-[34px_minmax(0,1fr)_82px] border-b border-white/[0.08] px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#94a3b8] sm:px-4 md:grid-cols-[42px_112px_minmax(150px,1fr)_90px_90px] md:text-[10px]">
            <span>#</span>
            <span>Ticker</span>
            <span className="hidden md:block">Company</span>
            <span className="hidden md:block">Price</span>
            <span className="text-right md:text-left">Score</span>
          </div>

          {rankings.length === 0 ? (
            <div className="p-6 text-sm font-bold text-[#94a3b8]">
              Live rankings are loading. Once the ranking job runs, this preview
              will display the current top stocks automatically.
            </div>
          ) : (
            <div>
              {rankings.map((row) => (
                <Link
                  key={row.id}
                  href={`/stocks/${encodeURIComponent(row.ticker)}`}
                  className="group grid grid-cols-[34px_minmax(0,1fr)_82px] items-center border-b border-white/[0.06] px-3 py-3 transition duration-300 hover:bg-[#D4AF37]/8 sm:px-4 md:grid-cols-[42px_112px_minmax(150px,1fr)_90px_90px]"
                >
                  <span
                    className={[
                      "sg-data text-sm font-black",
                      row.rank <= 3 ? "text-[#D4AF37]" : "text-[#94a3b8]",
                      row.locked ? "blur-[2px]" : "",
                    ].join(" ")}
                  >
                    {row.rank}
                  </span>

                  <span
                    className={[
                      "flex min-w-0 items-center gap-2",
                      row.locked ? "blur-[2px]" : "",
                    ].join(" ")}
                  >
                    <StockLogo
                      ticker={row.ticker}
                      company={row.company}
                      size={24}
                    />
                    <span className="min-w-0">
                      <span className="sg-data block truncate text-sm font-black text-[#e8f5e9]">
                        {row.ticker}
                      </span>
                      <span className="block truncate text-[10px] font-bold text-[#94a3b8] md:hidden">
                        {row.company}
                      </span>
                      <span className="sg-data block text-[10px] text-[#94a3b8] md:hidden">
                        {formatMoney(row.price)} ·{" "}
                        <span className={toneClass(row.movePct)}>
                          {formatMove(row.movePct)}
                        </span>
                      </span>
                      <span
                        className={[
                          "sg-data hidden text-[10px] md:block",
                          toneClass(row.movePct),
                        ].join(" ")}
                      >
                        {formatMove(row.movePct)}
                      </span>
                    </span>
                  </span>

                  <span
                    className={[
                      "hidden truncate text-sm font-bold text-[#94a3b8] md:block",
                      row.locked ? "blur-[2px]" : "",
                    ].join(" ")}
                  >
                    {row.company}
                  </span>

                  <span
                    className={[
                      "sg-data hidden text-sm font-bold text-[#e8f5e9] md:block",
                      row.locked ? "blur-[2px]" : "",
                    ].join(" ")}
                  >
                    {formatMoney(row.price)}
                  </span>

                  <span
                    className={[
                      "sg-data text-right text-sm font-black text-[#00ff88] drop-shadow-[0_0_14px_rgba(0,255,136,0.35)] md:text-left",
                      row.locked ? "blur-[2px]" : "",
                    ].join(" ")}
                  >
                    {formatScore(row.score)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {rankings.length > 5 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[44%] items-center justify-center bg-gradient-to-b from-[#06180f]/10 via-[#06180f]/72 to-[#06180f]/94 px-4">
              <div className="pointer-events-auto rounded-full border border-[#D4AF37]/35 bg-[#03140c]/92 px-4 py-3 text-center text-xs font-black text-[#e8f5e9] shadow-[0_0_36px_rgba(212,175,55,0.16)] backdrop-blur-xl sm:px-5 sm:text-sm">
                🔒 Subscribe to unlock full rankings
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LandingClient({
  rankings,
  tickerTape,
  metrics,
}: LandingClientProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const handleScroll = () => {
      setNavScrolled(page.scrollTop > 44);
    };

    page.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { root: page, threshold: 0.14 },
    );

    page.querySelectorAll(".sg-reveal").forEach((element) => {
      revealObserver.observe(element);
    });

    const animatedCounters = new WeakSet<Element>();

    function animateCounter(element: HTMLElement) {
      if (animatedCounters.has(element)) return;
      animatedCounters.add(element);

      const target = Number(element.dataset.countTo ?? "0");
      const prefix = element.dataset.prefix ?? "";
      const suffix = element.dataset.suffix ?? "";
      const decimals = Number(element.dataset.decimals ?? "0");

      if (reduceMotion || !Number.isFinite(target)) {
        element.textContent = `${prefix}${target.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;
        return;
      }

      const duration = 1200;
      let start: number | null = null;

      const tick = (time: number) => {
        start ??= time;
        const progress = Math.min((time - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;

        element.textContent = `${prefix}${current.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;

        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) animateCounter(entry.target as HTMLElement);
        });
      },
      { root: page, threshold: 0.38 },
    );

    page.querySelectorAll(".sg-counter").forEach((element) => {
      counterObserver.observe(element);
    });

    return () => {
      page.removeEventListener("scroll", handleScroll);
      revealObserver.disconnect();
      counterObserver.disconnect();
    };
  }, []);

  return (
    <main
      ref={pageRef}
      className="sg-landing h-[100dvh] overflow-y-auto bg-[#072116] text-[#e8f5e9]"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=IBM+Plex+Mono:wght@500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .sg-landing {
          --sg-bg: #072116;
          --sg-bg-deep: #03140c;
          --sg-green: #00ff88;
          --sg-heading: #e8f5e9;
          --sg-body: #94a3b8;
          --sg-gold: #D4AF37;
          --sg-gold-soft: #ddb159;
          font-family: "DM Sans", Inter, Arial, sans-serif;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,175,55,0.42) rgba(255,255,255,0.04);
          scroll-behavior: smooth;
        }

        .sg-heading {
          font-family: "Playfair Display", Georgia, serif;
          letter-spacing: -0.045em;
        }

        .sg-data {
          font-family: "IBM Plex Mono", "Courier New", monospace;
          letter-spacing: -0.035em;
        }

        .sg-nav {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: border-color 320ms ease, background-color 320ms ease, box-shadow 320ms ease;
        }

        .sg-nav-scrolled {
          border-bottom-color: rgba(212,175,55,0.28);
          background: rgba(3,20,12,0.88);
          box-shadow: 0 16px 50px rgba(0,0,0,0.28);
        }

        .sg-hero-grid {
          background-image:
            linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.045) 1px, transparent 1px);
          background-size: 72px 72px;
          animation: sgGridMove 22s linear infinite;
          mask-image: radial-gradient(circle at 50% 18%, black 0%, transparent 76%);
        }

        .sg-hero-glow {
          animation: sgPulseGlow 5s ease-in-out infinite;
        }

        .sg-word {
          display: inline-block;
          opacity: 0;
          transform: translateY(22px);
          animation: sgWordIn 760ms cubic-bezier(.2,.72,.16,1) forwards;
          animation-delay: var(--delay);
        }

        .sg-marquee-track {
          animation: sgMarquee 34s linear infinite;
        }

        .sg-marquee-track:hover {
          animation-play-state: paused;
        }

        .sg-spark {
          position: absolute;
          height: 3px;
          width: 3px;
          border-radius: 999px;
          background: var(--sg-gold);
          box-shadow: 0 0 18px rgba(212,175,55,0.9);
          opacity: 0;
          animation: sgSparkFloat var(--spark-duration) ease-in-out infinite;
          animation-delay: var(--spark-delay);
        }

        .sg-candle {
          position: absolute;
          width: 1px;
          height: var(--candle-height);
          background: rgba(212,175,55,0.28);
          opacity: 0.4;
          animation: sgCandlePulse 4.6s ease-in-out infinite;
          animation-delay: var(--candle-delay);
        }

        .sg-candle::after {
          content: "";
          position: absolute;
          left: -4px;
          top: 35%;
          height: 18px;
          width: 8px;
          border: 1px solid rgba(212,175,55,0.34);
          background: rgba(212,175,55,0.08);
          border-radius: 2px;
        }

        .sg-reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 760ms ease, transform 760ms cubic-bezier(.2,.72,.16,1);
        }

        .sg-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .sg-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 80px rgba(0,0,0,0.22);
          transition: transform 300ms ease, border-color 300ms ease, box-shadow 300ms ease, background 300ms ease;
        }

        .sg-card:hover {
          transform: translateY(-6px);
          border-color: rgba(212,175,55,0.42);
          background: rgba(212,175,55,0.055);
          box-shadow: 0 28px 100px rgba(0,0,0,0.32), 0 0 44px rgba(212,175,55,0.12);
        }

        .sg-engine-line {
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 1100ms cubic-bezier(.2,.72,.16,1);
        }

        .engine-flow.is-visible .sg-engine-line {
          transform: scaleX(1);
        }

        @keyframes sgGridMove {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-72px,72px,0); }
        }

        @keyframes sgPulseGlow {
          0%, 100% { opacity: 0.34; transform: scale(0.98); }
          50% { opacity: 0.68; transform: scale(1.05); }
        }

        @keyframes sgWordIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes sgMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes sgSparkFloat {
          0% { opacity: 0; transform: translate3d(0, 16px, 0); }
          20% { opacity: .75; }
          70% { opacity: .32; }
          100% { opacity: 0; transform: translate3d(36px, -46px, 0); }
        }

        @keyframes sgCandlePulse {
          0%, 100% { opacity: 0.18; transform: translateY(0); }
          50% { opacity: 0.55; transform: translateY(-8px); }
        }

        @media (max-width: 760px) {
          .sg-marquee-track {
            animation-duration: 24s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-landing,
          .sg-hero-grid,
          .sg-hero-glow,
          .sg-word,
          .sg-marquee-track,
          .sg-spark,
          .sg-candle {
            animation: none !important;
          }

          .sg-word,
          .sg-reveal {
            opacity: 1 !important;
            transform: none !important;
          }

          .sg-engine-line {
            transform: scaleX(1) !important;
          }
        }
      `}</style>

      <nav
        className={[
          "sg-nav sticky top-0 z-50 border-b border-transparent bg-[#03140c]/66",
          navScrolled ? "sg-nav-scrolled" : "",
        ].join(" ")}
      >
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-4 sm:h-[70px] sm:px-6 lg:px-8">
          <Link href="/landing" className="flex items-center gap-3">
            <div className="relative h-9 w-[132px] sm:h-10 sm:w-[155px]">
              <Image
                src="/logo.png"
                alt="StockGPT"
                fill
                priority
                className="object-contain object-left drop-shadow-[0_0_18px_rgba(212,175,55,0.16)]"
                sizes="155px"
              />
            </div>
            <span className="hidden text-sm font-black text-[#D4AF37] lg:inline">
              ✦
            </span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((item) =>
              item.href.startsWith("#") ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-bold text-[#e8f5e9]/80 transition hover:text-[#D4AF37]"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-bold text-[#e8f5e9]/80 transition hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>

          <div className="hidden sm:block">
            <GhostButton href="/login" compact>
              Log In →
            </GhostButton>
          </div>

          <Link
            href="/login"
            className="rounded-full border border-[#D4AF37]/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#D4AF37] sm:hidden"
          >
            Login
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-14 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8 lg:pt-10">
        <div className="sg-hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_10%,rgba(212,175,55,0.13),transparent_26%),radial-gradient(circle_at_82%_34%,rgba(0,255,136,0.07),transparent_34%),linear-gradient(180deg,rgba(7,33,22,0.04),#072116_88%)]" />
        <div className="sg-hero-glow pointer-events-none absolute left-1/2 top-[6%] h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[#D4AF37]/12 blur-3xl" />

        {sparkStyles.map((spark, index) => (
          <span
            key={`spark-${index}`}
            className="sg-spark"
            style={
              {
                left: spark.left,
                top: spark.top,
                "--spark-delay": spark.delay,
                "--spark-duration": spark.duration,
              } as CSSProperties
            }
          />
        ))}

        {candleStyles.map((candle, index) => (
          <span
            key={`candle-${index}`}
            className="sg-candle"
            style={
              {
                left: candle.left,
                top: candle.top,
                "--candle-height": candle.height,
                "--candle-delay": candle.delay,
              } as CSSProperties
            }
          />
        ))}

        <div className="relative z-10 mx-auto grid max-w-7xl items-start gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 xl:gap-12">
          <div className="pt-4 sm:pt-6 lg:pt-8">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#D4AF37]/28 bg-[#D4AF37]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37] shadow-[0_0_34px_rgba(212,175,55,0.08)] sm:text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ff88]" />
              </span>
              ✦ AI-Powered Stock Intelligence
            </div>

            <h1 className="sg-heading max-w-4xl text-[46px] font-black leading-[0.92] text-[#e8f5e9] sm:text-6xl lg:text-[70px] xl:text-[82px]">
              {"The market ranks itself. You just need to know who's at the top."
                .split(" ")
                .map((word, index) => (
                  <span
                    key={`${word}-${index}`}
                    className="sg-word mr-[0.18em]"
                    style={{ "--delay": `${index * 72}ms` } as CSSProperties}
                  >
                    {word}
                  </span>
                ))}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-[#94a3b8] sm:mt-6 sm:text-lg lg:text-xl">
              StockGPT ranks {metrics.totalStocks.toLocaleString("en-GB")} US
              stocks using AI signals across fundamentals, momentum and risk, so
              you always know where to look.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <CheckoutButton>Unlock Access</CheckoutButton>
              <GhostButton href="/login">Log In</GhostButton>
            </div>

            <TickerMarquee tickerTape={tickerTape} />
          </div>

          <div className="pt-0 lg:pt-8">
            <DashboardPreview rankings={rankings} metrics={metrics} />
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-[#06180f] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="sg-reveal">
            <SectionLabel>Illustrative Returns</SectionLabel>
            <h2 className="sg-heading max-w-4xl text-4xl font-black leading-tight text-[#e8f5e9] sm:text-5xl">
              Results shown as return scenarios, not fake testimonials.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#94a3b8]">
              These figures are illustrative examples only. They are not live
              performance data, not financial advice, and not a guarantee of
              future returns.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resultStats.map((stat) => (
              <div
                key={stat.label}
                className="sg-card sg-reveal rounded-[1.6rem] p-6"
              >
                <p className="min-h-[42px] text-[11px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">
                  {stat.label}
                </p>
                <p className="mt-5 text-5xl font-black text-[#D4AF37] drop-shadow-[0_0_22px_rgba(212,175,55,0.24)]">
                  <StatCounter
                    target={stat.target}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                  />
                </p>
                <p className="mt-3 text-sm font-bold text-[#94a3b8]">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              [
                "Momentum rotation example",
                "+22.8%",
                "Illustrative top-ranked basket return",
              ],
              [
                "Risk reduction example",
                "-28.0%",
                "Illustrative drawdown avoided after risk deterioration",
              ],
              [
                "Portfolio reallocation example",
                "+14.6%",
                "Illustrative uplift from replacing weak-ranked holdings",
              ],
            ].map(([title, value, detail]) => (
              <article
                key={title}
                className="sg-card sg-reveal rounded-[1.6rem] border-l-2 border-l-[#D4AF37] p-6"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#94a3b8]">
                  {title}
                </p>
                <p className="sg-data mt-5 text-5xl font-black text-[#00ff88]">
                  {value}
                </p>
                <p className="mt-4 text-sm leading-7 text-[#94a3b8]">
                  {detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="sg-reveal text-center">
            <SectionLabel>Core Features</SectionLabel>
            <h2 className="sg-heading text-4xl font-black leading-tight text-[#e8f5e9] sm:text-5xl">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                id={feature.id}
                key={feature.title}
                className="sg-card sg-reveal scroll-mt-28 rounded-[1.8rem] p-7"
              >
                <div className="mb-7 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-[#D4AF37]/28 bg-[#D4AF37]/10 text-3xl text-[#D4AF37] shadow-[0_0_28px_rgba(212,175,55,0.10)]">
                  {feature.icon}
                </div>
                <h3 className="sg-heading text-3xl font-black text-[#e8f5e9]">
                  {feature.title}
                </h3>
                <p className="mt-5 text-base leading-8 text-[#94a3b8]">
                  {feature.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-[#06180f] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="sg-reveal">
            <SectionLabel>How StockGPT Works</SectionLabel>
            <h2 className="sg-heading text-4xl font-black leading-tight text-[#e8f5e9] sm:text-5xl">
              How the engine thinks.
            </h2>
            <p className="mt-4 text-lg text-[#94a3b8]">
              Live market inputs. AI scoring. One ranked list.
            </p>
          </div>

          <div className="engine-flow sg-reveal relative mt-14">
            <div className="sg-engine-line absolute left-0 top-[31px] hidden h-px w-full bg-gradient-to-r from-[#D4AF37] via-[#D4AF37]/45 to-transparent lg:block" />

            <div className="grid gap-5 lg:grid-cols-5">
              {engineSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="relative rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur"
                >
                  <div className="sg-data mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/38 bg-[#D4AF37]/10 text-lg font-black text-[#D4AF37] shadow-[0_0_26px_rgba(212,175,55,0.12)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="sg-heading text-2xl font-black text-[#e8f5e9]">
                    {step.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[#94a3b8]">
                    {step.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="bg-[#0a2a1c] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-4xl text-center">
          <div className="sg-reveal">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="sg-heading text-4xl font-black leading-tight text-[#e8f5e9] sm:text-5xl">
              One plan. Full access. No noise.
            </h2>
          </div>

          <div className="sg-card sg-reveal mx-auto mt-12 max-w-xl rounded-[2rem] p-6 text-left sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="w-fit rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
                ✦ Core Plan
              </p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94a3b8]">
                Full access
              </p>
            </div>

            <div className="mt-8 flex items-end gap-3">
              <p className="sg-data text-5xl font-black text-[#e8f5e9] sm:text-6xl">
                £18.99
              </p>
              <p className="pb-2 text-base font-bold text-[#94a3b8]">
                / month
              </p>
            </div>

            <ul className="mt-8 space-y-4 text-base font-bold text-[#e8f5e9]">
              {[
                `Full AI stock rankings: ${metrics.totalStocks.toLocaleString(
                  "en-GB",
                )} stocks`,
                "Daily AI scores and rank movements",
                "World news and stock market impact",
                "AI Portfolio Builder and alerts",
                "Ask StockGPT chatbot",
                "Research guidance and market context",
                "Live market updates",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-[#00ff88]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <CheckoutButton full>Unlock Access</CheckoutButton>
            </div>

            <form
              action="/api/premium-waitlist"
              method="post"
              className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
            >
              <p className="text-sm font-bold text-[#94a3b8]">
                ◻ Executive tier coming soon — join the waitlist.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email address"
                  className="min-h-11 flex-1 rounded-full border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/60 focus:border-[#D4AF37]/50"
                />
                <button
                  type="submit"
                  className="rounded-full border border-[#D4AF37]/35 px-5 py-3 text-sm font-black text-[#D4AF37] transition hover:bg-[#D4AF37]/10"
                >
                  Join →
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section id="affiliate" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="sg-reveal mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-[#D4AF37]/20 bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(255,255,255,0.035)_38%,rgba(0,255,136,0.035))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-8 md:p-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-[#D4AF37]/28 bg-[#D4AF37]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
              Affiliate Program
            </p>
            <h2 className="sg-heading text-4xl font-black text-[#e8f5e9] sm:text-5xl">
              Earn with StockGPT.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#94a3b8]">
              Apply to partner with StockGPT and earn commission on approved
              subscriber referrals. Built for investors, creators and finance
              communities.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#D4AF37]">
              Creator partner route
            </p>
            <p className="mt-4 text-sm leading-7 text-[#94a3b8]">
              The dedicated affiliate page collects applications directly. No
              missing external link is required.
            </p>
            <Link
              href="/affiliate"
              className="mt-7 inline-flex w-full justify-center rounded-full border border-[#D4AF37]/55 px-6 py-3 text-sm font-black uppercase tracking-[0.15em] text-[#D4AF37] transition hover:-translate-y-1 hover:bg-[#D4AF37]/10 hover:shadow-[0_20px_60px_rgba(212,175,55,0.12)] sm:w-auto"
            >
              Become an Affiliate →
            </Link>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/[0.08] bg-[#03140c] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="sg-hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="sg-reveal relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="sg-heading text-5xl font-black leading-tight text-[#e8f5e9] sm:text-6xl">
            Stop guessing. Start ranking.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#94a3b8]">
            Join investors who let the AI organise the market — and focus on the
            decisions that matter.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CheckoutButton>Unlock Access</CheckoutButton>
            <GhostButton href="/login">Log In</GhostButton>
          </div>
        </div>
      </section>

      <footer className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 border-b border-white/[0.08] pb-10 md:grid-cols-[1.15fr_1fr_1fr]">
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
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#94a3b8]">
              AI-powered stock rankings, portfolio tools and market intelligence.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="h-6 w-6 rounded-md border border-white/[0.08] bg-[#072116]" />
              <span className="sg-data text-xs font-bold text-[#4a6a5a]">
                #072116
              </span>
              <span className="h-6 w-6 rounded-md border border-white/[0.08] bg-[#D4AF37]" />
              <span className="sg-data text-xs font-bold text-[#4a6a5a]">
                #D4AF37
              </span>
            </div>
          </div>

          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-[#D4AF37]">
              Platform
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm font-bold text-[#94a3b8]">
              <Link href="/" className="hover:text-[#D4AF37]">
                Dashboard
              </Link>
              <Link href="/rankings" className="hover:text-[#D4AF37]">
                Rankings
              </Link>
              <Link href="/portfolio" className="hover:text-[#D4AF37]">
                Portfolio
              </Link>
              <Link href="/world-news" className="hover:text-[#D4AF37]">
                News
              </Link>
              <Link href="/pricing" className="hover:text-[#D4AF37]">
                Pricing
              </Link>
              <Link href="/affiliate" className="hover:text-[#D4AF37]">
                Affiliate
              </Link>
              <Link href="/about" className="hover:text-[#D4AF37]">
                About
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-[#D4AF37]">
              Access
            </p>
            <div className="space-y-3 text-sm font-bold text-[#94a3b8]">
              <Link href="/login" className="block hover:text-[#D4AF37]">
                Log In →
              </Link>
              <Link href="/affiliate" className="block hover:text-[#D4AF37]">
                Apply as affiliate →
              </Link>
              <Link href="/pricing" className="block hover:text-[#D4AF37]">
                Subscription →
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl pt-8">
          <p className="text-[11px] leading-6 text-[#4a6a5a]">
            StockGPT is an AI-powered research and ranking tool. All content is
            for informational and educational purposes only. Nothing on this
            platform constitutes financial advice, investment advice, or a
            recommendation to buy or sell any security. Always conduct your own
            research and consult a qualified financial professional before making
            investment decisions. Past performance of AI rankings is not
            indicative of future results.
          </p>
        </div>
      </footer>
    </main>
  );
}
